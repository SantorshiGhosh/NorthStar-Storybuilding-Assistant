import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Clock,
  MapPin,
  Users,
  Calendar
} from 'lucide-react';
import Navbar from '../components/Navbar';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { projectService, getCached } from '../services/api';

export default function Timeline() {
  const { projectId } = useParams();

  const cachedProj = getCached(`project:${projectId}`);
  const cachedEvents = getCached(`timeline:${projectId}`);

  const [project, setProject] = useState(() => cachedProj || null);
  useDocumentTitle(project?.name ? `${project.name} | Timeline` : 'Story Timeline');
  const [events, setEvents] = useState(() => cachedEvents || []);
  const [loading, setLoading] = useState(() => !cachedEvents);

  useEffect(() => {
    if (projectId) {
      if (!cachedProj) {
        projectService.getProject(projectId).then(setProject).catch(console.error);
      }
      projectService
        .getTimeline(projectId)
        .then(setEvents)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [projectId]);

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#161618] text-[#1c1c1e] dark:text-[#f5f5f7] flex flex-col font-sans transition-colors duration-200">
      <Navbar currentProject={project} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Bar */}
        <div className="pb-6 border-b border-[#1c1c1e]/10 dark:border-white/10 mb-8 text-left">
          <div className="flex items-center space-x-2 text-xs font-semibold text-[#1c1c1e] dark:text-[#f5f5f7] bg-[#1c1c1e]/5 dark:bg-white/10 px-2.5 py-0.5 rounded-full w-fit mb-2 border border-[#1c1c1e]/10 dark:border-white/10">
            <Clock className="w-3.5 h-3.5" />
            <span>Story Chronology Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c1c1e] dark:text-[#f5f5f7]">
            Narrative Timeline &amp; Sequence
          </h1>
          <p className="text-xs sm:text-sm text-[#636366] dark:text-[#8e8e93] mt-1">
            Chronological progression of story events, character whereabouts, and temporal milestones extracted across chapters.
          </p>
        </div>

        {/* Timeline Sequence */}
        {loading && events.length === 0 ? (
          <div className="relative border-l-2 border-[#1c1c1e]/10 dark:border-white/10 ml-4 sm:ml-8 space-y-8 text-left pb-12 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="relative pl-6 sm:pl-8">
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-[#1c1c1e]/20 dark:bg-white/20" />
                <div className="bg-[#fcfcfb] dark:bg-[#222224] rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 p-5 shadow-xs space-y-3">
                  <div className="h-5 w-20 bg-[#1c1c1e]/10 dark:bg-white/10 rounded" />
                  <div className="h-5 w-48 bg-[#1c1c1e]/10 dark:bg-white/10 rounded" />
                  <div className="h-4 w-full bg-[#1c1c1e]/5 dark:bg-white/5 rounded" />
                  <div className="h-4 w-32 bg-[#1c1c1e]/5 dark:bg-white/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-[#fcfcfb] dark:bg-[#222224] rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 p-12 text-center text-xs text-[#8e8e93]">
            No timeline events extracted yet. Upload a manuscript or analyze a chapter to populate chronology.
          </div>
        ) : (
          <div className="relative border-l-2 border-[#1c1c1e]/10 dark:border-white/10 ml-4 sm:ml-8 space-y-8 text-left pb-12">
            {events.map((event, index) => (
              <div key={event.id || index} className="relative pl-6 sm:pl-8 group">
                {/* Timeline node dot */}
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white dark:bg-[#161618] border-2 border-[#1c1c1e] dark:border-[#f5f5f7] shadow-2xs group-hover:scale-125 transition-transform" />

                <div className="bg-[#fcfcfb] dark:bg-[#222224] rounded-xl border border-[#1c1c1e]/10 dark:border-white/10 p-5 shadow-xs hover:border-[#1c1c1e]/30 dark:hover:border-white/30 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#1c1c1e]/5 dark:bg-white/10 text-[#1c1c1e] dark:text-[#f5f5f7] border border-[#1c1c1e]/10 dark:border-white/10">
                      Chapter {event.chapter_number || index + 1}
                    </span>

                    {event.date_or_time_label && (
                      <span className="text-xs text-[#8e8e93] flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{event.date_or_time_label}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-[#1c1c1e] dark:text-[#f5f5f7] mb-1.5">
                    {event.title}
                  </h3>

                  {event.description && (
                    <p className="text-xs sm:text-sm text-[#636366] dark:text-[#8e8e93] leading-relaxed mb-3">
                      {event.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#1c1c1e]/10 dark:border-white/10 text-[11px] text-[#8e8e93]">
                    {event.location && (
                      <span className="flex items-center space-x-1 text-emerald-700 dark:text-emerald-400 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{event.location}</span>
                      </span>
                    )}

                    {event.participants && event.participants.length > 0 && (
                      <span className="flex items-center space-x-1 text-[#8e8e93]">
                        <Users className="w-3.5 h-3.5 text-[#8e8e93]" />
                        <span>{event.participants.join(', ')}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
