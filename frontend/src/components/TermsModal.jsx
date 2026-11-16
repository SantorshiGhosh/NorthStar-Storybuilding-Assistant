import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X, FileText, Shield, ExternalLink } from 'lucide-react';
import { animate, scroll, inView } from 'motion';

export default function TermsModal({ isOpen, onClose }) {
  const modalRef = useRef(null);
  const progressBarRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scrolling while modal is open
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';

    // Handle Escape key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Focus close button on open
    const timer = setTimeout(() => {
      modalRef.current?.focus();
    }, 50);

    // Motion.dev scroll-linked animation on internal container
    let stopScroll = () => {};
    const cleanups = [];

    const progressBar = progressBarRef.current;
    const container = scrollContainerRef.current;

    if (progressBar && container) {
      container.scrollTop = 0;

      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // 1. Motion.dev scroll progress indicator for container
      stopScroll = scroll(
        animate(
          progressBar,
          { scaleX: [0, 1] },
          { ease: 'linear' }
        ),
        { container }
      );

      // 2. Motion.dev section transitions
      if (!prefersReducedMotion) {
        const sections = container.querySelectorAll('section');
        sections.forEach((section) => {
          const stopInView = inView(
            section,
            () => {
              animate(
                section,
                { opacity: [0.4, 1], y: [14, 0] },
                { duration: 0.45, ease: [0.16, 1, 0.3, 1] }
              );
            },
            { root: container, margin: '0px 0px -40px 0px' }
          );
          cleanups.push(stopInView);
        });
      }
    }

    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
      stopScroll();
      cleanups.forEach((c) => c());
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[88vh] bg-[#fcfcfb] dark:bg-[#161b22] text-[#1c1815] dark:text-[#f0f6fc] rounded-[24px] border border-[#1c1815]/10 dark:border-[#30363d] shadow-2xl flex flex-col overflow-hidden focus:outline-none transition-colors duration-200"
      >
        {/* Motion.dev Scroll Progress Indicator */}
        <div
          ref={progressBarRef}
          className="absolute top-0 left-0 right-0 h-[3.5px] bg-[#7b2d3b] dark:bg-[#fca5a5] z-[60] pointer-events-none"
          style={{ transformOrigin: '0 50%', transform: 'scaleX(0)' }}
          aria-hidden="true"
        />

        {/* Fixed Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-[#1c1815]/10 dark:border-[#30363d] bg-[#f6f6f4]/80 dark:bg-[#161b22]/90 backdrop-blur-xs flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#7b2d3b]/10 dark:bg-[#7b2d3b]/25 text-[#7b2d3b] dark:text-[#fca5a5] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="terms-modal-title"
                className="font-fraunces text-xl sm:text-2xl font-medium tracking-tight text-[#1c1815] dark:text-[#f0f6fc]"
              >
                Terms of Service
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
            aria-label="Close Terms of Service modal"
            className="w-8 h-8 rounded-lg border border-[#1c1815]/15 dark:border-[#30363d] flex items-center justify-center text-[#1c1815]/60 dark:text-[#8b949e] hover:text-[#1c1815] dark:hover:text-[#f0f6fc] hover:bg-[#1c1815]/5 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Document Content with Smooth Scrolling */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-7 font-inter text-xs sm:text-[13px] leading-relaxed text-[#1c1815]/80 dark:text-[#c9d1d9] scroll-smooth"
        >
          {/* Section 1 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              1. Introduction and Acceptance of Terms
            </h3>
            <p>
              Welcome to <strong>NorthStar</strong> ("NorthStar", "we", "our", or "us"). By accessing or using the NorthStar
              writing platform, applications, APIs, or associated web services (collectively, the "Service"), you agree to be
              bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not access or use the Service.
            </p>
            <p>
              These Terms constitute a legally binding agreement between you ("User", "Author", or "you") and NorthStar.
              <em> [Corporate entity name and registration details to be confirmed by legal counsel].</em>
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              2. Description of NorthStar
            </h3>
            <p>
              NorthStar is an intelligent narrative continuity guardian and world-building platform designed for novelists,
              screenwriters, and storytellers. The Service parses manuscripts (.docx, .pdf, .txt, .md), extracts narrative
              entities (characters, locations, traits, timeline events), models story relationships into an interactive
              Knowledge Graph, provides multi-perspective Story Architect tools, and performs automated cross-chapter continuity checks.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              3. User Account Registration and Security
            </h3>
            <p>
              To access full features of NorthStar, you may create an account using your email address or third-party authentication
              (e.g., Google Single Sign-On). You agree to provide accurate, current, and complete registration information. You are
              solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur
              under your account.
            </p>
            <p>
              If you use NorthStar in "Instant Guest Author" mode, a temporary workspace session is initialized for evaluation purposes.
              Guest sessions are isolated, and temporary data may not be permanently retained upon session termination.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              4. User Responsibilities and Acceptable Use
            </h3>
            <p>
              You agree to use NorthStar strictly in compliance with applicable laws and regulations. You shall not:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Upload malicious code, viruses, or harmful components designed to disrupt the platform infrastructure.</li>
              <li>Attempt to reverse-engineer, decompile, or access unauthorized components of the system.</li>
              <li>Upload material that infringes upon the intellectual property, privacy, or proprietary rights of third parties.</li>
              <li>Use automated scripts to scrape, harvest, or overload NorthStar servers or APIs.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              5. Manuscript Uploads and User Content Ownership
            </h3>
            <p>
              <strong>You retain 100% full ownership, copyright, and title to all manuscripts, chapters, character notes,
              outlines, and prose you upload or write within NorthStar.</strong>
            </p>
            <p>
              NorthStar does not claim any ownership rights over your creative work. By uploading content, you grant NorthStar
              only the limited, revocable license strictly necessary to store, segment, process, and display your work back to
              you to deliver the continuity analysis and Story Architect features.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              6. AI-Generated Content and Its Limitations
            </h3>
            <p>
              NorthStar utilizes automated artificial intelligence models (such as Google Gemini APIs) to perform entity extraction,
              character trait indexing, and continuity conflict detection.
            </p>
            <p>
              You acknowledge that AI continuity suggestions, entity classifications, and timeline observations are provided as
              creative assistance tools. NorthStar does not guarantee that continuity reports are 100% exhaustive or error-free.
              Authors maintain final creative discretion and editorial authority over all canon decisions and resolutions.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              7. Intellectual Property Rights
            </h3>
            <p>
              The NorthStar brand name, visual design, user interfaces, codebases, graph algorithms, and documentation are the
              exclusive intellectual property of NorthStar and its licensors. You may not copy, reproduce, or create derivative
              works of the NorthStar platform without prior written authorization.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              8. Data Storage and Privacy
            </h3>
            <p>
              Your data is processed and stored in accordance with our Privacy Policy. In the implemented NorthStar architecture,
              manuscript files uploaded to your private vault are protected using AES-256-GCM symmetric encryption on disk. Relational
              narrative metadata and continuity records are partitioned by project and authenticated user credentials.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              9. Third-Party Services and Integrations
            </h3>
            <p>
              The Service may integrate with third-party providers for authentication (such as Google / Firebase), cloud database
              storage (such as Supabase), or AI processing (such as Google Gemini). Your use of such integrations is subject to
              the respective third-party terms and privacy standards.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              10. Service Availability and Modifications
            </h3>
            <p>
              We strive to ensure reliable, high-availability service. However, we do not warrant that the Service will be
              uninterrupted, error-free, or available at all times. We reserve the right to deploy updates, improvements, or
              bug fixes, or temporarily suspend access for scheduled system maintenance.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              11. Account Suspension and Termination
            </h3>
            <p>
              You may terminate your account at any time through account settings or by contacting our support team. We reserve
              the right to suspend or terminate accounts that engage in fraudulent activity, security violations, or material breaches
              of these Terms.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              12. Disclaimer of Warranties
            </h3>
            <p>
              THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              13. Limitation of Liability
            </h3>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL NORTHSTAR, ITS DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR CREATIVE
              CONTENT, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
            </p>
          </section>

          {/* Section 14 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              14. Changes to These Terms
            </h3>
            <p>
              We may update these Terms periodically to reflect product evolutions, operational improvements, or statutory updates.
              We will notify authors of material changes by posting the revised document with an updated effective date. Continued
              use of NorthStar following the publication of changes constitutes your acceptance of the revised Terms.
            </p>
          </section>

          {/* Section 15 */}
          <section className="space-y-2">
            <h3 className="font-fraunces text-base sm:text-lg font-semibold text-[#1c1815] dark:text-[#f0f6fc]">
              15. Governing Law and Contact Information
            </h3>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws.
              <em> [Governing jurisdiction to be confirmed by legal counsel].</em>
            </p>
            <p>
              If you have any questions or feedback regarding these Terms, please contact our support team:
            </p>
            <div className="bg-[#f6f6f4] dark:bg-[#121214] p-3.5 rounded-xl border border-[#1c1815]/10 dark:border-[#30363d] text-xs space-y-1">
              <div><strong>Official Support Email:</strong> <a href="mailto:codebrew@gmail.com" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">codebrew@gmail.com</a></div>
              <div><strong>Telephone Helpline:</strong> <a href="tel:+18005550199" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">+919231456311</a></div>
            </div>
          </section>
        </div>

        {/* Fixed Footer */}
        <div className="px-6 sm:px-8 py-4 border-t border-[#1c1815]/10 dark:border-[#30363d] bg-[#f6f6f4]/60 dark:bg-[#161b22]/90 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-[11px] text-[#1c1815]/60 dark:text-[#8b949e]">
            <Shield className="w-3.5 h-3.5 text-[#7b2d3b] dark:text-[#fca5a5]" />
            <span>Author content sovereignty and copyright preserved</span>
            <span className="hidden sm:inline">&bull;</span>
            <Link
              to="/terms"
              onClick={onClose}
              className="hidden sm:inline-flex items-center space-x-1 text-[#7b2d3b] dark:text-[#fca5a5] hover:underline"
            >
              <span>Open full page</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
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
