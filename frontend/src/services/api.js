import axios from 'axios';

// API client - points to backend via env variable or local proxy
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2-minute safety window for manuscript indexing
});

export const projectService = {
  getProjects: async () => {
    const res = await api.get('/projects');
    return res.data;
  },
  getProject: async (id) => {
    const res = await api.get(`/projects/${id}`);
    return res.data;
  },
  createProject: async (data) => {
    const res = await api.post('/projects', data);
    return res.data;
  },
  deleteProject: async (id) => {
    const res = await api.delete(`/projects/${id}`);
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
    return res.data;
  },
  getGraph: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/graph`);
    return res.data;
  },
  getTimeline: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/timeline`);
    return res.data;
  },
  getIssues: async (projectId, params = {}) => {
    const res = await api.get(`/projects/${projectId}/issues`, { params });
    return res.data;
  },
  seedDemo: async () => {
    const res = await api.post('/seed-demo');
    return res.data;
  },
};

export const chapterService = {
  getChapters: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/chapters`);
    return res.data;
  },
  createChapter: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/chapters`, data);
    return res.data;
  },
  getChapter: async (chapterId) => {
    const res = await api.get(`/chapters/${chapterId}`);
    return res.data;
  },
  updateChapter: async (chapterId, data) => {
    const res = await api.put(`/chapters/${chapterId}`, data);
    return res.data;
  },
  analyzeChapter: async (chapterId) => {
    const res = await api.post(`/chapters/${chapterId}/analyze`);
    return res.data;
  },
};

export const entityService = {
  getEntities: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/entities`);
    return res.data;
  },
  getEntity: async (entityId) => {
    const res = await api.get(`/entities/${entityId}`);
    return res.data;
  },
  createEntity: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/entities`, data);
    return res.data;
  },
  updateEntity: async (entityId, data) => {
    const res = await api.patch(`/entities/${entityId}`, data);
    return res.data;
  },
};

export const continuityService = {
  updateIssue: async (issueId, data) => {
    const res = await api.patch(`/issues/${issueId}`, data);
    return res.data;
  },
};

export default api;
