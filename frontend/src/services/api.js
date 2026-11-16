import axios from 'axios';

// API client - points to backend via env variable or local proxy
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2-minute safety window for manuscript indexing
  withCredentials: true,
});

// Request interceptor to attach JWT if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('northstar_token') || localStorage.getItem('sb_auth_token') || localStorage.getItem('supabase_token');
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
    let userId = 'anon';
    try {
      const userStr = localStorage.getItem('story_bible_user');
      if (userStr) userId = JSON.parse(userStr)?.id || 'anon';
    } catch (_) {}
    return fetchWithCache(`projects:list:${userId}`, async () => {
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

  uploadManuscript: async (projectId, file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    let lastError = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await api.post(`/projects/${projectId}/upload`, formData, {
          timeout: 180000, // 3-minute timeout window
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(percent);
            }
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
      } catch (err) {
        lastError = err;
        const isNetworkErr = err.message === 'Network Error' || !err.response || err.code === 'ECONNABORTED';
        if (isNetworkErr && attempt < maxRetries) {
          console.warn(`[Upload] Attempt ${attempt} encountered network drop/server waking up. Retrying in ${attempt * 3}s...`);
          await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
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

  deleteEntity: async (entityId) => {
    const res = await api.delete(`/entities/${entityId}`);
    invalidateCache(`entity:${entityId}`);
    invalidateCache('entities:');
    invalidateCache('graph:');
    invalidateCache('projects:list');
    invalidateCache('project:bundle:');
    return res.data;
  },

  getResolvedProperties: async (entityId) => {
    const res = await api.get(`/entities/${entityId}/resolved-properties`);
    return res.data;
  },

  // Relationship delegations for architectural compatibility
  getRelationships: async (projectId, options = {}) => {
    return relationshipService.getRelationships(projectId, options);
  },

  createRelationship: async (projectId, data) => {
    return relationshipService.createRelationship(projectId, data);
  },

  updateRelationship: async (relationshipId, data) => {
    return relationshipService.updateRelationship(relationshipId, data);
  },

  deleteRelationship: async (relationshipId) => {
    return relationshipService.deleteRelationship(relationshipId);
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
    invalidateCache(`project:bundle:${projectId}`);
    return res.data;
  },

  updateRelationship: async (relationshipId, data) => {
    const res = await api.patch(`/relationships/${relationshipId}`, data);
    invalidateCache('relationships:');
    invalidateCache('graph:');
    invalidateCache('project:bundle:');
    return res.data;
  },

  deleteRelationship: async (relationshipId) => {
    const res = await api.delete(`/relationships/${relationshipId}`);
    invalidateCache('relationships:');
    invalidateCache('graph:');
    invalidateCache('project:bundle:');
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

export const architectService = {
  getCategories: async (projectId, options = {}) => {
    return fetchWithCache(`categories:${projectId}`, async () => {
      const res = await api.get(`/projects/${projectId}/categories`);
      return res.data;
    }, { ttl: 60000, ...options });
  },

  createCategory: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/categories`, data);
    invalidateCache(`categories:${projectId}`);
    return res.data;
  },

  getCanvases: async (projectId, options = {}) => {
    return fetchWithCache(`canvases:${projectId}`, async () => {
      const res = await api.get(`/projects/${projectId}/canvases`);
      return res.data;
    }, { ttl: 60000, ...options });
  },

  createCanvas: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/canvases`, data);
    invalidateCache(`canvases:${projectId}`);
    return res.data;
  },

  getCanvasDetails: async (canvasId) => {
    const res = await api.get(`/canvases/${canvasId}`);
    return res.data;
  },

  updateCanvas: async (canvasId, data) => {
    const res = await api.patch(`/canvases/${canvasId}`, data);
    invalidateCache('canvases:');
    return res.data;
  },

  deleteCanvas: async (canvasId) => {
    const res = await api.delete(`/canvases/${canvasId}`);
    invalidateCache('canvases:');
    return res.data;
  },

  duplicateCanvas: async (canvasId) => {
    const res = await api.post(`/canvases/${canvasId}/duplicate`);
    invalidateCache('canvases:');
    return res.data;
  },

  saveCanvasNodes: async (canvasId, nodes) => {
    const res = await api.post(`/canvases/${canvasId}/nodes`, nodes);
    return res.data;
  },

  getGroups: async (projectId, options = {}) => {
    return fetchWithCache(`groups:${projectId}`, async () => {
      const res = await api.get(`/projects/${projectId}/groups`);
      return res.data;
    }, { ttl: 60000, ...options });
  },

  createGroup: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/groups`, data);
    invalidateCache(`groups:${projectId}`);
    return res.data;
  },

  deleteGroup: async (groupId) => {
    const res = await api.delete(`/groups/${groupId}`);
    invalidateCache('groups:');
    return res.data;
  },

  getAttachments: async (projectId, params = {}, options = {}) => {
    const paramKey = JSON.stringify(params);
    return fetchWithCache(`attachments:${projectId}:${paramKey}`, async () => {
      const res = await api.get(`/projects/${projectId}/attachments`, { params });
      return res.data;
    }, { ttl: 30000, ...options });
  },

  uploadAttachments: async (projectId, formData) => {
    const res = await api.post(`/projects/${projectId}/attachments/upload`, formData);
    invalidateCache(`attachments:${projectId}`);
    invalidateCache('attachments:');
    return res.data;
  },

  createAttachment: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/attachments`, data);
    invalidateCache(`attachments:${projectId}`);
    invalidateCache('attachments:');
    return res.data;
  },

  deleteAttachment: async (attachmentId, projectId = null) => {
    const res = await api.delete(`/attachments/${attachmentId}`);
    if (projectId) invalidateCache(`attachments:${projectId}`);
    invalidateCache('attachments:');
    return res.data;
  },

  linkEntityAttachment: async (entityId, attachmentId, role = 'reference') => {
    const res = await api.post(`/entities/${entityId}/attachments/${attachmentId}`, null, {
      params: { role }
    });
    invalidateCache('attachments:');
    return res.data;
  },

  unlinkEntityAttachment: async (entityId, attachmentId) => {
    const res = await api.delete(`/entities/${entityId}/attachments/${attachmentId}`);
    invalidateCache('attachments:');
    return res.data;
  },

  getAttachmentQuota: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/attachments/quota`);
    return res.data;
  },

  getAttachmentPreviewUrl: (attachmentId) => {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    return `${API_BASE}/attachments/${attachmentId}/preview`;
  },

  getAttachmentDownloadUrl: (attachmentId) => {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    return `${API_BASE}/attachments/${attachmentId}/download`;
  },

  analyzeAttachment: async (attachmentId) => {
    const res = await api.post(`/attachments/${attachmentId}/analyze`);
    return res.data;
  },

  getSnapshots: async (projectId, options = {}) => {
    return fetchWithCache(`snapshots:${projectId}`, async () => {
      const res = await api.get(`/projects/${projectId}/snapshots`);
      return res.data;
    }, { ttl: 30000, ...options });
  },

  createSnapshot: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/snapshots`, data);
    invalidateCache(`snapshots:${projectId}`);
    return res.data;
  },

  restoreSnapshot: async (snapshotId) => {
    const res = await api.post(`/snapshots/${snapshotId}/restore`);
    invalidateCache(); // Clear full cache on snapshot restore
    return res.data;
  },

  getAuditLogs: async (projectId, limit = 50) => {
    const res = await api.get(`/projects/${projectId}/audit-logs`, { params: { limit } });
    return res.data;
  },

  getMatchingCandidates: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/matching-candidates`);
    return res.data;
  },

  resolveMatchingCandidate: async (candidateId, data) => {
    const res = await api.post(`/matching-candidates/${candidateId}/resolve`, data);
    invalidateCache('entities:');
    invalidateCache('graph:');
    return res.data;
  },

  exportProject: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/export`);
    return res.data;
  },

  applyTemplate: async (projectId, templateType = 'fantasy') => {
    const res = await api.post(`/projects/${projectId}/apply-template`, null, { params: { template_type: templateType } });
    invalidateCache(`categories:${projectId}`);
    return res.data;
  },
};

export const authService = {
  register: async (data) => {
    invalidateCache();
    const res = await api.post('/auth/register', data);
    if (res.data?.token) {
      localStorage.setItem('northstar_token', res.data.token);
      localStorage.setItem('story_bible_user', JSON.stringify(res.data.user));
      invalidateCache();
    }
    return res.data;
  },

  login: async (data) => {
    invalidateCache();
    const res = await api.post('/auth/login', data);
    if (res.data?.token) {
      localStorage.setItem('northstar_token', res.data.token);
      localStorage.setItem('story_bible_user', JSON.stringify(res.data.user));
      invalidateCache();
    }
    return res.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (_) {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem('northstar_token');
      localStorage.removeItem('sb_auth_token');
      localStorage.removeItem('story_bible_user');
      invalidateCache();
    }
  },

  getCurrentUser: async () => {
    const res = await api.get('/auth/me');
    if (res.data) {
      localStorage.setItem('story_bible_user', JSON.stringify(res.data));
    }
    return res.data;
  },

  guestLogin: async () => {
    invalidateCache();
    const res = await api.post('/auth/guest');
    if (res.data?.token) {
      localStorage.setItem('northstar_token', res.data.token);
      localStorage.setItem('story_bible_user', JSON.stringify(res.data.user));
      invalidateCache();
    }
    return res.data;
  },

  loginWithFirebase: async (idToken, profile = {}) => {
    invalidateCache();
    const res = await api.post('/auth/firebase', {
      id_token: idToken,
      email: profile.email,
      full_name: profile.displayName || profile.name,
    });
    if (res.data?.token) {
      localStorage.setItem('northstar_token', res.data.token);
      localStorage.setItem('story_bible_user', JSON.stringify(res.data.user));
      invalidateCache();
    }
    return res.data;
  },
};

export default api;
