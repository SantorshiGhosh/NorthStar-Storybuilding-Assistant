import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Shield,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Lock,
  Compass,
  CheckCircle2
} from 'lucide-react';
import { animate, scroll, inView } from 'motion';
import Navbar from '../components/Navbar';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function TermsOfService() {
  useDocumentTitle('Terms of Service | NorthStar');
  const navigate = useNavigate();
  const progressBarRef = useRef(null);
  const contentRef = useRef(null);

  // Initialize Motion.dev scroll-linked animation and section transitions
  useEffect(() => {
    // Reset window scroll on mount/navigation
    window.scrollTo({ top: 0, behavior: 'instant' });

    const progressBar = progressBarRef.current;
    if (!progressBar) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Motion.dev Scroll Progress Indicator linked to window scroll
    const stopScroll = scroll(
      animate(
        progressBar,
        { scaleX: [0, 1] },
        { ease: 'linear' }
      )
    );

    // 2. Motion.dev Section-based scroll-triggered transitions
    const cleanups = [];
    if (!prefersReducedMotion && contentRef.current) {
      const sections = contentRef.current.querySelectorAll('section');
      sections.forEach((section) => {
        const stopInView = inView(
          section,
          () => {
            animate(
              section,
              { opacity: [0.35, 1], y: [18, 0] },
              { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
            );
          },
          { margin: '0px 0px -50px 0px' }
        );
        cleanups.push(stopInView);
      });
    }

    // Cleanup animations on unmount or page change
    return () => {
      stopScroll();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#161618] text-[#1c1815] dark:text-[#f0f6fc] font-inter selection:bg-[#7b2d3b] selection:text-[#faf6ef] transition-colors duration-200 flex flex-col scroll-smooth">
      {/* Motion.dev Scroll Progress Indicator */}
      <div
        ref={progressBarRef}
        className="fixed top-0 left-0 right-0 h-[3.5px] bg-[#7b2d3b] dark:bg-[#fca5a5] z-[99999] pointer-events-none"
        style={{ transformOrigin: '0 50%', transform: 'scaleX(0)' }}
        aria-hidden="true"
      />

      {/* Top Application Navbar */}
      <Navbar isDashboard={true} />

      {/* Breadcrumb & Navigation Sub-bar */}
      <div className="border-b border-[#1c1815]/10 dark:border-white/10 bg-[#f6f6f4]/60 dark:bg-[#121214]/60 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-2.5 transition-colors">
        <div className="max-w-[1180px] mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-[#636366] dark:text-[#8e8e93]">
            <Link to="/" className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors font-medium">
              Home
            </Link>
            <span>/</span>
            <span className="text-[#1c1815] dark:text-[#f0f6fc] font-semibold">Terms of Service</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 2) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}
              className="inline-flex items-center space-x-1.5 text-[#636366] dark:text-[#8e8e93] hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to previous page</span>
            </button>
            <span className="text-[#1c1815]/20 dark:text-white/20">&bull;</span>
            <Link
              to="/privacy"
              className="inline-flex items-center space-x-1 text-[#7b2d3b] dark:text-[#fca5a5] hover:underline font-semibold"
            >
              <span>Privacy Policy</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Header / Hero Section */}
      <section className="relative border-b border-[#1c1815]/10 dark:border-white/10 bg-[#f6f6f4] dark:bg-[#161618] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 bg-[radial-gradient(#1c1815_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f6f6f4]/40 to-[#f6f6f4] dark:via-[#161618]/40 dark:to-[#161618] pointer-events-none" />

        <div className="relative max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-10 sm:pt-14 sm:pb-12">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7b2d3b]/20 dark:border-[#7b2d3b]/40 bg-[#7b2d3b]/5 dark:bg-[#7b2d3b]/20 px-3 py-1 shadow-2xs mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7b2d3b] dark:bg-[#fca5a5] animate-pulse" />
            <span className="text-[12px] font-semibold text-[#7b2d3b] dark:text-[#fca5a5] uppercase tracking-wider font-mono-cap">
              Legal Documentation &bull; Terms of Service
            </span>
          </div>

          <h1 className="font-fraunces text-3xl sm:text-5xl lg:text-[52px] font-medium tracking-tight text-[#1c1815] dark:text-[#f0f6fc] leading-[1.08] mb-3">
            Terms of Service
          </h1>

          <p className="font-inter text-sm sm:text-base text-[#636366] dark:text-[#8e8e93] max-w-2xl leading-relaxed mb-6">
            Clear, transparent terms governing your use of NorthStar's AI continuity platform, private manuscript vaults,
            and narrative world-building architecture.
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-md bg-white dark:bg-[#1c1c1e] border border-[#1c1815]/10 dark:border-white/10 text-[#636366] dark:text-[#8e8e93]">
              Effective Date: <strong>November 2026</strong>
            </span>
            <span className="px-3 py-1 rounded-md bg-white dark:bg-[#1c1c1e] border border-[#1c1815]/10 dark:border-white/10 text-[#636366] dark:text-[#8e8e93]">
              Version: <strong>1.0</strong>
            </span>
            <span className="px-3 py-1 rounded-md bg-[#7b2d3b]/10 dark:bg-[#7b2d3b]/25 border border-[#7b2d3b]/20 text-[#7b2d3b] dark:text-[#fca5a5] font-semibold">
              100% Author Content Sovereignty
            </span>
          </div>
        </div>
      </section>

      {/* Main Document Body */}
      <main className="flex-1 max-w-[860px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div
          ref={contentRef}
          className="bg-white dark:bg-[#1c1c1e] border border-[#1c1815]/10 dark:border-[#30363d] rounded-[24px] p-6 sm:p-12 shadow-sm space-y-10 font-inter text-xs sm:text-[13.5px] leading-relaxed text-[#1c1815]/80 dark:text-[#c9d1d9]"
        >
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              1. Introduction and Acceptance of Terms
            </h2>
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
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              2. Description of NorthStar
            </h2>
            <p>
              NorthStar is an intelligent narrative continuity guardian and world-building platform designed specifically for novelists,
              screenwriters, and story architects. The Service parses manuscripts (.docx, .pdf, .txt, .md), extracts narrative
              entities (characters, locations, traits, timeline events), models story relationships into an interactive
              Knowledge Graph, provides multi-perspective Story Architect tools, and performs automated cross-chapter continuity checks.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              3. User Account Registration and Security
            </h2>
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
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              4. User Responsibilities and Acceptable Use
            </h2>
            <p>
              You agree to use NorthStar strictly in compliance with applicable laws and regulations. You shall not:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Upload malicious code, viruses, or harmful components designed to disrupt the platform infrastructure.</li>
              <li>Attempt to reverse-engineer, decompile, or access unauthorized components of the system.</li>
              <li>Upload material that infringes upon the intellectual property, privacy, or proprietary rights of third parties.</li>
              <li>Use automated scripts to scrape, harvest, or overload NorthStar servers or APIs.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              5. Manuscript Uploads and User Content Ownership
            </h2>
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
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              6. AI-Generated Content and Its Limitations
            </h2>
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
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              7. Intellectual Property Rights
            </h2>
            <p>
              The NorthStar brand name, visual design, user interfaces, codebases, graph algorithms, and documentation are the
              exclusive intellectual property of NorthStar and its licensors. You may not copy, reproduce, or create derivative
              works of the NorthStar platform without prior written authorization.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              8. Data Storage and Privacy
            </h2>
            <p>
              Your data is processed and stored in accordance with our Privacy Policy. In the implemented NorthStar architecture,
              manuscript files uploaded to your private vault are protected using AES-256-GCM symmetric encryption on disk. Relational
              narrative metadata and continuity records are partitioned by project and authenticated user credentials.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              9. Third-Party Services and Integrations
            </h2>
            <p>
              The Service may integrate with third-party providers for authentication (such as Google / Firebase), cloud database
              storage (such as Supabase), or AI processing (such as Google Gemini). Your use of such integrations is subject to
              the respective third-party terms and privacy standards.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              10. Service Availability and Modifications
            </h2>
            <p>
              We strive to ensure reliable, high-availability service. However, we do not warrant that the Service will be
              uninterrupted, error-free, or available at all times. We reserve the right to deploy updates, improvements, or
              bug fixes, or temporarily suspend access for scheduled system maintenance.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              11. Account Suspension and Termination
            </h2>
            <p>
              You may terminate your account at any time through account settings or by contacting our support team. We reserve
              the right to suspend or terminate accounts that engage in fraudulent activity, security violations, or material breaches
              of these Terms.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              12. Disclaimer of Warranties
            </h2>
            <p>
              THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
              IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              13. Limitation of Liability
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL NORTHSTAR, ITS DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE
              FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR CREATIVE
              CONTENT, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
            </p>
          </section>

          {/* Section 14 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              14. Changes to These Terms
            </h2>
            <p>
              We may update these Terms periodically to reflect product evolutions, operational improvements, or statutory updates.
              We will notify authors of material changes by posting the revised document with an updated effective date. Continued
              use of NorthStar following the publication of changes constitutes your acceptance of the revised Terms.
            </p>
          </section>

          {/* Section 15 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              15. Governing Law and Contact Information
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable laws.
              <em> [Governing jurisdiction to be confirmed by legal counsel].</em>
            </p>
            <p>
              If you have questions regarding these Terms, please contact our support team:
            </p>
            <div className="bg-[#f6f6f4] dark:bg-[#121214] p-4 rounded-xl border border-[#1c1815]/10 dark:border-white/10 space-y-1.5 mt-2">
              <div>
                <strong>Official Support Email:</strong>{' '}
                <a href="mailto:support@storybible.ai" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">
                  support@storybible.ai
                </a>
              </div>
              <div>
                <strong>Telephone Helpline:</strong>{' '}
                <a href="tel:+18005550199" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">
                  +1 (800) 555-0199
                </a>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1c1815]/10 dark:border-white/10 bg-[#f6f6f4] dark:bg-[#161618] py-8 transition-colors mt-auto">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-xs">
          <div className="flex items-center space-x-2.5">
            <Link
              to="/"
              className="h-6 w-6 rounded-[6px] bg-[#1c1815] dark:bg-[#f5f5f7] text-white dark:text-[#1c1815] flex items-center justify-center font-bold text-xs tracking-tighter"
            >
              N
            </Link>
            <span className="font-medium text-[#636366] dark:text-[#8e8e93]">
              NorthStar &bull; AI Continuity Guardian
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[#8e8e93]">
            <Link to="/terms" className="text-[#7b2d3b] dark:text-[#fca5a5] font-semibold">
              Terms of Service
            </Link>
            <Link to="/privacy" className="hover:text-[#1c1815] dark:hover:text-[#f5f5f7] transition-colors">
              Privacy Policy
            </Link>
            <Link to="/support" className="hover:text-[#1c1815] dark:hover:text-[#f5f5f7] transition-colors">
              Help &amp; Support
            </Link>
            <a href="mailto:support@storybible.ai" className="hover:text-[#1c1815] dark:hover:text-[#f5f5f7] transition-colors">
              support@storybible.ai
            </a>
            <span className="text-[#8e8e93]/60">&copy; {new Date().getFullYear()} NorthStar AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
