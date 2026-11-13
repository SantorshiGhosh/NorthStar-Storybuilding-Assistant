import React from 'react';
import { User, Shield, BookOpen, Quote } from 'lucide-react';

export default function CharacterCard({ entity, onSelect }) {
  const isCharacter = entity.entity_type === 'character';

  return (
    <div
      onClick={() => onSelect && onSelect(entity)}
      className="bg-white rounded-xl border border-neutral-200/80 p-5 shadow-xs hover:border-neutral-300 hover:shadow-sm transition-all cursor-pointer text-left flex flex-col justify-between"
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-semibold text-sm">
              {entity.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 leading-tight">
                {entity.name}
              </h3>
              <span className="text-[11px] text-neutral-400 capitalize">
                {entity.entity_type} &bull; First seen Ch {entity.first_appearance_chapter || 1}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {entity.description && (
          <p className="text-xs text-neutral-600 line-clamp-2 mb-3 leading-relaxed">
            {entity.description}
          </p>
        )}

        {/* Traits */}
        {entity.traits && entity.traits.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {entity.traits.slice(0, 4).map((t, idx) => (
              <span
                key={idx}
                className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200/60"
              >
                {t}
              </span>
            ))}
            {entity.traits.length > 4 && (
              <span className="text-[10px] text-neutral-400 self-center">
                +{entity.traits.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Facts Footer */}
      <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
        <span className="flex items-center space-x-1 text-blue-600 font-medium">
          <Quote className="w-3 h-3" />
          <span>{entity.facts ? entity.facts.length : 0} canon facts</span>
        </span>
        <span className="text-neutral-400 hover:text-neutral-700">
          Inspect Profile &rarr;
        </span>
      </div>
    </div>
  );
}
