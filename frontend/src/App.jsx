import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Workspace from './pages/Workspace';
import KnowledgeGraph from './pages/KnowledgeGraph';
import ContinuityReport from './pages/ContinuityReport';
import CharacterProfiles from './pages/CharacterProfiles';
import Timeline from './pages/Timeline';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/workspace/:projectId" element={<Workspace />} />
        <Route path="/graph/:projectId" element={<KnowledgeGraph />} />
        <Route path="/continuity/:projectId" element={<ContinuityReport />} />
        <Route path="/characters/:projectId" element={<CharacterProfiles />} />
        <Route path="/timeline/:projectId" element={<Timeline />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
