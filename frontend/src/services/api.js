import axios from 'axios';

// API client - points to backend via env variable or local proxy
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2-minute safety window for manuscript indexing
});

// Request interceptor to attach JWT if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sb_auth_token') || localStorage.getItem('supabase_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// -------------------------------------------------------------
// SWR In-Memory Cache & Request Deduplication
// -------------------------------------------------------------
const cache = new Map();
const inFlightRequests = new Map();

/**
 * Synchronously retrieves cached data if available.
 * Used for zero-latency component initialization.
 */
export function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  return entry.data;
}

/**
 * Manually populates or updates cache entry.
 */
export function setCached(key, data, ttl = 60000) {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

/**
 * Invalidates cache by exact key, prefix, or regex pattern.
 */
export function invalidateCache(pattern) {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of Array.from(cache.keys())) {
    if (
      key === pattern ||
      key.startsWith(pattern) ||
      (pattern instanceof RegExp && pattern.test(key))
    ) {
      cache.delete(key);
    }
  }
}

/**
 * Stale-While-Revalidate fetch helper:
 * - Returns cached data instantly (<10ms) if present.
 * - Silently triggers a background refresh if stale or on demand.
 * - Deduplicates in-flight promises across concurrent callers.
 */
export async function fetchWithCache(key, fetcherFn, options = {}) {
  const { ttl = 60000, forceRefresh = false, onBackgroundUpdate } = options;
  const cached = cache.get(key);
  const now = Date.now();
  const isFresh = cached && (now - cached.timestamp < (cached.ttl || ttl));

  // Fresh cache hit -> return immediately
  if (cached && !forceRefresh && isFresh) {
    return cached.data;
  }

  const executeFetch = async () => {
    try {
      const data = await fetcherFn();
      cache.set(key, { data, timestamp: Date.now(), ttl });
      window.dispatchEvent(new CustomEvent('swr:update', { detail: { key, data } }));
      if (onBackgroundUpdate) {
        onBackgroundUpdate(data);
      }
      return data;
    } finally {
      inFlightRequests.delete(key);
    }
  };

  // Stale-While-Revalidate: We have cached data, but it's expired or needs revalidation.
  // Return cached data immediately and refresh silently in background.
  if (cached && !forceRefresh) {
    if (!inFlightRequests.has(key)) {
      const bgPromise = executeFetch().catch((err) => {
        console.warn(`[SWR] Silent background refresh failed for ${key}:`, err?.message);
      });
      inFlightRequests.set(key, bgPromise);
    }
    return cached.data;
  }

  // Cold cache or forced refresh -> await network
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const promise = executeFetch();
  inFlightRequests.set(key, promise);
  return promise;
}

// -------------------------------------------------------------
// Prefetching Helper
// -------------------------------------------------------------
export function prefetchProjectWorkspace(projectId) {
  if (!projectId) return;
  // Parallel non-blocking prefetch of core workspace datasets
  Promise.allSettled([
    projectService.getProject(projectId),
    projectService.getProjectBundle(projectId),
    chapterService.getChapters(projectId),
    projectService.getIssues(projectId),
    projectService.getGraph(projectId),
  ]).catch(() => {});
}

// -------------------------------------------------------------
// API Services with Automatic SWR Caching & Invalidation
// -------------------------------------------------------------

export const projectService = {
  getProjects: async (options = {}) => {
    return fetchWithCache('projects:list', async () => {
      const res = await api.get('/projects');
      return res.data;
    }, { ttl: 30000, ...options });
  },

  getProject: async (id, options = {}) => {
    return fetchWithCache(`project:${id}`, async () => {
      const res = await api.get(`/projects/${id}`);
      return res.data;
    }, { ttl: 60000, ...options });
  },

  getProjectBundle: async (id, options = {}) => {
    return fetchWithCache(`project:bundle:${id}`, async () => {
      const res = await api.get(`/projects/${id}/bundle`);
      return res.data;
    }, { ttl: 60000, ...options });
  },

  createProject: async (data) => {
    const res = await api.post('/projects', data);
    invalidateCache('projects:list');
    return res.data;
  },

  deleteProject: async (id) => {
    const res = await api.delete(`/projects/${id}`);
    invalidateCache('projects:list');
    invalidateCache(`project:${id}`);
    invalidateCache(`project:bundle:${id}`);
    invalidateCache(`chapters:${id}`);
    invalidateCache(`issues:${id}`);
    invalidateCache(`graph:${id}`);
    invalidateCache(`entities:${id}`);
    return res.data;
  },

  uploadManuscript: async (projectId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/projects/${projectId}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    // Invalidate everything relating to this project
    invalidateCache(`project:${projectId}`);
    invalidateCache(`project:bundle:${projectId}`);
    invalidateCache(`chapters:${projectId}`);
    invalidateCache(`issues:${projectId}`);
    invalidateCache(`graph:${projectId}`);
    invalidateCache(`entities:${projectId}`);
    invalidateCache(`timeline:${projectId}`);
    invalidateCache('projects:list');
    return res.data;
  },

  getGraph: async (projectId, options = {}) => {
    return fetchWithCache(`graph:${projectId}`, async () => {
      const res = await api.get(`/projects/${projectId}/graph`);
      return res.data;
    }, { ttl: 60000, ...options });
  },

  getTimeline: async (projectId, options = {}) => {
    return fetchWithCache(`timeline:${projectId}`, async () => {
      const res = await api.get(`/projects/${projectId}/timeline`);
      return res.data;
    }, { ttl: 60000, ...options });
  },

  getIssues: async (projectId, params = {}, options = {}) => {
    const paramKey = JSON.stringify(params);
    return fetchWithCache(`issues:${projectId}:${paramKey}`, async () => {
      const res = await api.get(`/projects/${projectId}/issues`, { params });
      return res.data;
    }, { ttl: 30000, ...options });
  },

  seedDemo: async () => {
    const res = await api.post('/seed-demo');
    invalidateCache('projects:list');
    return res.data;
  },
};

export const chapterService = {
  getChapters: async (projectId, options = {}) => {
    return fetchWithCache(`chapters:${projectId}`, async () => {
      const res = await api.get(`/projects/${projectId}/chapters`);
      return res.data;
    }, { ttl: 60000, ...options });
  },

  createChapter: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/chapters`, data);
    invalidateCache(`chapters:${projectId}`);
    invalidateCache(`project:bundle:${projectId}`);
    invalidateCache(`project:${projectId}`);
    invalidateCache('projects:list');
    return res.data;
  },

  getChapter: async (chapterId, options = {}) => {
    return fetchWithCache(`chapter:${chapterId}`, async () => {
      const res = await api.get(`/chapters/${chapterId}`);
      return res.data;
    }, { ttl: 60000, ...options });
  },

  updateChapter: async (chapterId, data) => {
    const res = await api.put(`/chapters/${chapterId}`, data);
    invalidateCache(`chapter:${chapterId}`);
    invalidateCache('chapters:');
    invalidateCache('project:bundle:');
    return res.data;
  },

  analyzeChapter: async (chapterId, content = null, projectId = null) => {
    const payload = content ? { content } : {};
    const res = await api.post(`/chapters/${chapterId}/analyze`, payload);
    invalidateCache('issues:');
    invalidateCache('project:bundle:');
    invalidateCache('projects:list');
    invalidateCache('graph:');
    invalidateCache('entities:');
    if (projectId) {
      invalidateCache(`issues:${projectId}`);
      invalidateCache(`project:bundle:${projectId}`);
    }
    return res.data;
  },
};

export const entityService = {
  getEntities: async (projectId, params = {}, options = {}) => {
    const paramKey = JSON.stringify(params);
    return fetchWithCache(`entities:${projectId}:${paramKey}`, async () => {
      const res = await api.get(`/projects/${projectId}/entities`, { params });
      return res.data;
    }, { ttl: 60000, ...options });
  },

  getEntity: async (entityId, options = {}) => {
    return fetchWithCache(`entity:${entityId}`, async () => {
      const res = await api.get(`/entities/${entityId}`);
      return res.data;
    }, { ttl: 60000, ...options });
  },

  createEntity: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/entities`, data);
    invalidateCache(`entities:${projectId}`);
    invalidateCache(`graph:${projectId}`);
    invalidateCache(`project:${projectId}`);
    invalidateCache('projects:list');
    return res.data;
  },

  updateEntity: async (entityId, data) => {
    const res = await api.patch(`/entities/${entityId}`, data);
    invalidateCache(`entity:${entityId}`);
    invalidateCache('entities:');
    invalidateCache('graph:');
    return res.data;
  },
};

export const relationshipService = {
  getRelationships: async (projectId, options = {}) => {
    return fetchWithCache(`relationships:${projectId}`, async () => {
      const res = await api.get(`/projects/${projectId}/relationships`);
      return res.data;
    }, { ttl: 60000, ...options });
  },

  createRelationship: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/relationships`, data);
    invalidateCache(`relationships:${projectId}`);
    invalidateCache(`graph:${projectId}`);
    return res.data;
  },

  updateRelationship: async (relationshipId, data) => {
    const res = await api.patch(`/relationships/${relationshipId}`, data);
    invalidateCache('relationships:');
    invalidateCache('graph:');
    return res.data;
  },
};

export const continuityService = {
  updateIssue: async (issueId, data) => {
    const res = await api.patch(`/issues/${issueId}`, data);
    invalidateCache('issues:');
    invalidateCache('projects:list');
    invalidateCache('project:bundle:');
    invalidateCache('project:');
    return res.data;
  },
};

export default api;
