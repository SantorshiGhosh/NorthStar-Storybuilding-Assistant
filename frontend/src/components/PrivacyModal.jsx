import React, { useEffect, useRef } from 'react';
import { X, Lock, ShieldCheck } from 'lucide-react';

export default function PrivacyModal({ isOpen, onClose }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Prevent background scrolling while modal is open
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    // Handle Escape key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const timer = setTimeout(() => {
      modalRef.current?.focus();
    }, 50);

    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[88vh] bg-[#faf6ef] dark:bg-[#161b22] text-[#1c1815] dark:text-[#f0f6fc] rounded-[24px] border border-[#1c1815]/10 dark:border-[#30363d] shadow-2xl flex flex-col overflow-hidden focus:outline-none transition-colors duration-200"
      >
        {/* Fixed Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-[#1c1815]/10 dark:border-[#30363d] bg-[#f3ece0]/80 dark:bg-[#161b22]/90 backdrop-blur-xs flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#7b2d3b]/10 dark:bg-[#7b2d3b]/25 text-[#7b2d3b] dark:text-[#fca5a5] flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="privacy-modal-title"
                className="font-fraunces text-xl sm:text-2xl font-medium tracking-tight text-[#1c1815] dark:text-[#f0f6fc]"
              >
                Privacy Policy
              </h2>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-[11px] font-mono-cap text-[#7b2d3b] dark:text-[#fca5a5] uppercase tracking-wider font-semibold">
                  NorthStar AI Continuity Guardian
                </span>
                <span className="text-[11px] text-[#1c1815]/40 dark:text-[#8b949e]">&bull;</span>
                <span className="text-[11px] text-[#1c1815]/60 dark:text-[#8b949e]">
                  Effective Date: November 2026
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Privacy Policy modal"
            className="w-8 h-8 rounded-lg border border-[#1c1815]/15 dark:border-[#30363d] flex items-center justify-center text-[#1c1815]/60 dark:text-[#8b949e] hover:text-[#1c1815] dark:hover:text-[#f0f6fc] hover:bg-[#1c1815]/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Document Content */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-7 font-inter text-xs sm:text-[13px] leading-relaxed text-[#1c1815]/80 dark:text-[#c9d1d9]">
          {/* Section 1 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              1. Information We Collect
            </h3>
            <p>
              At NorthStar, we prioritize author privacy and data sovereignty. This Privacy Policy describes how we collect,
              handle, and safeguard your data when you use the NorthStar writing platform, AI continuity auditing, and Story Architect features.
            </p>
            <p>
              We collect information that you directly provide to us, as well as necessary technical metadata required to operate
              and protect the platform.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              2. Account and Registration Information
            </h3>
            <p>
              When you create an account, we collect:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Personal Identifiers:</strong> Your full name and email address.</li>
              <li><strong>Authentication Credentials:</strong> Securely salted and hashed passwords (passwords are never stored in plaintext).</li>
              <li><strong>Federated Identity Data:</strong> If signing in with Google SSO, we receive your email and verified identity profile identifier.</li>
              <li><strong>Guest Author Sessions:</strong> Temporary session tokens for anonymous exploration without permanent profile creation.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              3. Manuscript and Uploaded File Information
            </h3>
            <p>
              When you upload files (.docx, .pdf, .txt, .md) or draft chapters in the TipTap editor:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>We store your manuscript prose, chapter partitions, and revision histories.</li>
              <li>We extract narrative entity metadata: character names, aliases, traits, factions, locations, and timeline facts.</li>
              <li>We generate relationship links and continuity issue reports (e.g. classification of contradictions vs. intentional twists).</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              4. How We Use Your Information
            </h3>
            <p>
              We use collected information solely to:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Authenticate your identity and provide secure access to your writing projects.</li>
              <li>Extract entities, build Knowledge Graphs, and calculate continuity audits.</li>
              <li>Maintain point-in-time Story Architect snapshots and world-building canvases.</li>
              <li>Respond to support inquiries and technical requests submitted to our support team.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              5. AI Processing and Content Analysis
            </h3>
            <p>
              In our verified software implementation:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Manuscript text segments are transmitted via encrypted API connections to AI providers (specifically Google Gemini models) for the purpose of entity extraction and continuity auditing.</li>
              <li><strong>Zero Training on Author Prose:</strong> User manuscript prose is processed transiently for extraction and is not utilized to train public foundation models.</li>
              <li>Extraction prompts focus strictly on entity detection, chronology, and physical trait consistency.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              6. Data Storage and Security
            </h3>
            <p>
              NorthStar implements robust technical safeguards to protect author data:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>AES-256-GCM Vault Encryption:</strong> Raw uploaded manuscript files are encrypted on disk with 256-bit AES-GCM encryption before storage in your project's vault.</li>
              <li><strong>Database Protection:</strong> Relational metadata is managed in structured database tables partitioned by project ID and author ownership.</li>
              <li><strong>Vector Indexing:</strong> Semantic vector embeddings are persisted in local ChromaDB storage for continuity retrieval.</li>
              <li><strong>Transport Security:</strong> All client-to-server traffic is encrypted using HTTPS / TLS.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              7. Cookies and Session Management
            </h3>
            <p>
              NorthStar utilizes essential session cookies and local browser storage (such as <code className="px-1.5 py-0.5 rounded bg-[#1c1815]/5 dark:bg-white/5 font-mono text-[11px]">northstar_token</code>)
              strictly to maintain authenticated user sessions and preserve client interface settings (such as light or dark theme preferences). We do not deploy third-party advertising tracking cookies.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              8. Third-Party Services
            </h3>
            <p>
              The platform interfaces with select infrastructure providers:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>AI Providers:</strong> Google Gemini API for narrative entity extraction and auditing.</li>
              <li><strong>Authentication / Cloud:</strong> Optional Firebase authentication and Supabase database / storage integration.</li>
              <li><strong>Email Dispatch:</strong> SMTP email services for customer support ticket routing to <code className="px-1.5 py-0.5 rounded bg-[#1c1815]/5 dark:bg-white/5 font-mono text-[11px]">codebrew@gmail.com</code>.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              9. Data Sharing and Disclosure
            </h3>
            <p>
              <strong>We do not sell, rent, or commercialize your manuscripts, outlines, or personal data to third parties.</strong>
            </p>
            <p>
              Data is shared only with trusted infrastructure subprocessors strictly as needed to deliver the application, or if
              required to comply with a valid legal obligation or court order.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              10. Data Retention and Deletion
            </h3>
            <p>
              Your projects and manuscripts are retained for as long as your account remains active. When you delete a chapter or
              project within NorthStar, its corresponding database records, vector passages, and encrypted vault files are removed.
              You may also request complete account deletion by contacting support.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              11. User Rights and Choices
            </h3>
            <p>
              Depending on your location, you may have rights under applicable privacy legislation (such as GDPR or CCPA):
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access &amp; Portability:</strong> You can export your full story bible as JSON or CSV using the Narrative Vault export tool.</li>
              <li><strong>Rectification:</strong> You can modify or update project entities and account profile details at any time.</li>
              <li><strong>Deletion ("Right to be Forgotten"):</strong> You can delete projects or request total account removal.</li>
            </ul>
            <p className="text-[11.5px] italic text-[#1c1815]/60 dark:text-[#8b949e]">
              [Regional DPO contact and jurisdictional compliance details to be confirmed by legal counsel].
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              12. Children's Privacy
            </h3>
            <p>
              NorthStar is intended for general audiences and professional storytellers. The Service is not directed to individuals
              under the age of 13 (or under 16 in the European Economic Area). We do not knowingly collect personal data from children.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              13. Policy Updates
            </h3>
            <p>
              We may update this Privacy Policy from time to time to reflect operational or regulatory changes. We will notify users
              of material modifications by revising the "Effective Date" at the top of this document.
            </p>
          </section>

          {/* Section 14 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              14. Contact Information
            </h3>
            <p>
              For privacy inquiries, data access requests, or questions regarding data handling practices:
            </p>
            <div className="bg-[#f3ece0] dark:bg-[#121214] p-3.5 rounded-xl border border-[#1c1815]/10 dark:border-[#30363d] text-xs space-y-1">
              <div><strong>Privacy &amp; Support Email:</strong> <a href="mailto:codebrew@gmail.com" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">codebrew@gmail.com</a></div>
              <div><strong>Telephone Helpline:</strong> <a href="tel:+18005550199" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">9231456311</a></div>
            </div>
          </section>
        </div>

        {/* Fixed Footer */}
        <div className="px-6 sm:px-8 py-4 border-t border-[#1c1815]/10 dark:border-[#30363d] bg-[#f3ece0]/60 dark:bg-[#161b22]/90 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-[11px] text-[#1c1815]/60 dark:text-[#8b949e]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Encrypted storage &bull; Zero training on author prose</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#7b2d3b] hover:bg-[#5e1f2b] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            I Understand &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}
