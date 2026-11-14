import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Clock,
  MapPin,
  Users,
  FileText,
  Calendar,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { projectService, getCached } from '../services/api';

export default function Timeline() {
  const { projectId } = useParams();

  const cachedProj = getCached(`project:${projectId}`);
  const cachedEvents = getCached(`timeline:${projectId}`);

  const [project, setProject] = useState(() => cachedProj || null);
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
    <div className="min-h-screen bg-[#fbfbf9] flex flex-col">
      <Navbar currentProject={project} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Bar */}
        <div className="pb-6 border-b border-neutral-200/80 mb-8 text-left">
          <div className="flex items-center space-x-2 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full w-fit mb-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Story Chronology Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight">
            Narrative Timeline & Sequence
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Chronological progression of story events, character whereabouts, and temporal milestones extracted across chapters.
          </p>
        </div>

        {/* Timeline Sequence */}
        {loading && events.length === 0 ? (
          <div className="relative border-l-2 border-neutral-200 ml-4 sm:ml-8 space-y-8 text-left pb-12 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="relative pl-6 sm:pl-8">
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-neutral-200" />
                <div className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-xs space-y-3">
                  <div className="h-5 w-20 bg-neutral-200 rounded" />
                  <div className="h-5 w-48 bg-neutral-200 rounded" />
                  <div className="h-4 w-full bg-neutral-100 rounded" />
                  <div className="h-4 w-32 bg-neutral-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center text-xs text-neutral-400">
            No timeline events extracted yet. Upload a manuscript or analyze a chapter to populate chronology.
          </div>
        ) : (
          <div className="relative border-l-2 border-neutral-200 ml-4 sm:ml-8 space-y-8 text-left pb-12">
            {events.map((event, index) => (
              <div key={event.id || index} className="relative pl-6 sm:pl-8 group">
                {/* Timeline node dot */}
                <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-white border-2 border-blue-600 shadow-2xs group-hover:scale-125 transition-transform" />

                <div className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-xs hover:border-neutral-300 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                      Chapter {event.chapter_number || index + 1}
                    </span>

                    {event.date_or_time_label && (
                      <span className="text-xs text-neutral-400 flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{event.date_or_time_label}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-neutral-900 mb-1.5">
                    {event.title}
                  </h3>

                  {event.description && (
                    <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed mb-3">
                      {event.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-neutral-100 text-[11px] text-neutral-500">
                    {event.location && (
                      <span className="flex items-center space-x-1 text-emerald-700 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{event.location}</span>
                      </span>
                    )}

                    {event.participants && event.participants.length > 0 && (
                      <span className="flex items-center space-x-1">
                        <Users className="w-3.5 h-3.5 text-neutral-400" />
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
