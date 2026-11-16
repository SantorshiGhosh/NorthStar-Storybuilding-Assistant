import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle, Search } from 'lucide-react';
import { productionV2Api } from '../api';

export default function StrictEvidenceInspector({ projectId, initialQuote = '', chapterId = null }) {
  const [quote, setQuote] = useState(initialQuote);
  const [result, setResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    if (!quote.trim() || !projectId) return;

    try {
      setVerifying(true);
      setError(null);
      const res = await productionV2Api.verifyEvidence(projectId, quote, chapterId);
      setResult(res);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Quote verification request failed.');
    } finally {
      setVerifying(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'EXACT_VERIFIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> EXACT VERIFIED (100%)
          </span>
        );
      case 'NORMALIZED_VERIFIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> NORMALIZED VERIFIED (95%)
          </span>
        );
      case 'CANDIDATE_MATCH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" /> CANDIDATE MATCH ({Math.round((result?.confidence || 0) * 100)}%)
          </span>
        );
      case 'SOURCE_VERSION_MISMATCH':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <AlertOctagon className="w-3.5 h-3.5" /> DRAFT VERSION MISMATCH
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <HelpCircle className="w-3.5 h-3.5" /> UNVERIFIED / FABRICATED
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 text-slate-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          <h4 className="font-semibold text-sm text-slate-100">Strict Source-Span Inspector</h4>
          <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
            Zero False-Fuzzy Engine
          </span>
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-3">
        <div className="relative">
          <textarea
            rows={2}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="Paste citation or claimed quotation to verify against manuscript..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex justify-between items-center">
          <span className="text-[11px] text-slate-500">
            Checks active and historical drafts for exact verbatim character offsets.
          </span>
          <button
            type="submit"
            disabled={verifying || !quote.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            {verifying ? 'Verifying Spans...' : 'Certify Citation'}
          </button>
        </div>
      </form>

      {error && (
        <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded">
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-lg space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Certification Outcome:</span>
            {getStatusBadge(result.status)}
          </div>

          <p className="text-slate-300 leading-relaxed">{result.explanation}</p>

          {result.chapter_number && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
              <div>
                <span>Chapter: </span>
                <strong className="text-slate-200">{result.chapter_number}</strong>
              </div>
              {result.start_char !== null && result.end_char !== null && (
                <div>
                  <span>Span Offsets: </span>
                  <strong className="text-slate-200 font-mono">[{result.start_char}:{result.end_char}]</strong>
                </div>
              )}
            </div>
          )}

          {result.matched_text && result.status !== 'EXACT_VERIFIED' && (
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded text-slate-300">
              <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                Matched In Manuscript:
              </span>
              <p className="italic font-mono text-[11px]">"{result.matched_text}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
