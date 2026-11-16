import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const v2Client = axios.create({
  baseURL: `${API_BASE}/v2/production`,
  timeout: 120000,
  withCredentials: true,
});

v2Client.interceptors.request.use((config) => {
  const token = localStorage.getItem('northstar_token') || localStorage.getItem('sb_auth_token') || localStorage.getItem('supabase_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export const productionV2Api = {
  // 1. Health & diagnostics
  getHealth: async () => {
    const res = await v2Client.get('/health');
    return res.data;
  },

  // 2. Manuscript upload & versions
  uploadManuscript: async (projectId, file) => {
    const formData = new FormData();
    formData.append('project_id', projectId);
    formData.append('file', file);
    const res = await v2Client.post('/manuscripts/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getVersions: async (manuscriptId) => {
    const res = await v2Client.get(`/manuscripts/${manuscriptId}/versions`);
    return res.data;
  },

  rollbackVersion: async (manuscriptId, targetVersion, reason = 'Author rollback') => {
    const res = await v2Client.post(`/manuscripts/${manuscriptId}/rollback/${targetVersion}`, { reason });
    return res.data;
  },

  compareVersions: async (manuscriptId, baseVersion, targetVersion) => {
    const res = await v2Client.get(`/manuscripts/${manuscriptId}/compare`, {
      params: { base_version: baseVersion, target_version: targetVersion },
    });
    return res.data;
  },

  // 3. Durable jobs
  getJobStatus: async (jobId) => {
    const res = await v2Client.get(`/jobs/${jobId}`);
    return res.data;
  },

  retryJob: async (jobId) => {
    const res = await v2Client.post(`/jobs/${jobId}/retry`);
    return res.data;
  },

  // 4. Strict evidence verification
  verifyEvidence: async (projectId, quote, chapterId = null, versionNumber = null) => {
    const res = await v2Client.post('/evidence/verify', {
      project_id: projectId,
      quote,
      chapter_id: chapterId,
      version_number: versionNumber,
    });
    return res.data;
  },

  // 5. Canon review
  getPendingCanon: async (projectId) => {
    const res = await v2Client.get(`/canon/${projectId}/pending`);
    return res.data;
  },

  reviewCanon: async (factId, action, correctedClaim = null) => {
    const res = await v2Client.post('/canon/review', {
      fact_id: factId,
      action,
      corrected_claim: correctedClaim,
    });
    return res.data;
  },

  // 6. Continuity report
  getContinuityReport: async (projectId) => {
    const res = await v2Client.get(`/continuity/${projectId}`);
    return res.data;
  },
};

export default productionV2Api;
