import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Lock,
  ShieldCheck,
  ArrowLeft,
  ArrowRight,
  Shield,
  FileText
} from 'lucide-react';
import { animate, scroll, inView } from 'motion';
import Navbar from '../components/Navbar';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function PrivacyPolicy() {
  useDocumentTitle('Privacy Policy | NorthStar');
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
            <span className="text-[#1c1815] dark:text-[#f0f6fc] font-semibold">Privacy Policy</span>
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
              to="/terms"
              className="inline-flex items-center space-x-1 text-[#7b2d3b] dark:text-[#fca5a5] hover:underline font-semibold"
            >
              <span>Terms of Service</span>
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
              Legal Documentation &bull; Privacy &amp; Data Protection
            </span>
          </div>

          <h1 className="font-fraunces text-3xl sm:text-5xl lg:text-[52px] font-medium tracking-tight text-[#1c1815] dark:text-[#f0f6fc] leading-[1.08] mb-3">
            Privacy Policy
          </h1>

          <p className="font-inter text-sm sm:text-base text-[#636366] dark:text-[#8e8e93] max-w-2xl leading-relaxed mb-6">
            How NorthStar protects your creative prose, manuscript vaults, and identity with AES-256 encryption, zero training
            on author manuscripts, and transparent data practices.
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-md bg-white dark:bg-[#1c1c1e] border border-[#1c1815]/10 dark:border-white/10 text-[#636366] dark:text-[#8e8e93]">
              Effective Date: <strong>November 2026</strong>
            </span>
            <span className="px-3 py-1 rounded-md bg-white dark:bg-[#1c1c1e] border border-[#1c1815]/10 dark:border-white/10 text-[#636366] dark:text-[#8e8e93]">
              Version: <strong>1.0</strong>
            </span>
            <span className="px-3 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>AES-256 Vault Encrypted</span>
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
              1. Information We Collect
            </h2>
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
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              2. Account and Registration Information
            </h2>
            <p>
              When you create an account, we collect:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Personal Identifiers:</strong> Your full name and email address.</li>
              <li><strong>Authentication Credentials:</strong> Securely salted and hashed passwords (passwords are never stored in plaintext).</li>
              <li><strong>Federated Identity Data:</strong> If signing in with Google SSO, we receive your email and verified identity profile identifier.</li>
              <li><strong>Guest Author Sessions:</strong> Temporary session tokens for anonymous exploration without permanent profile creation.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              3. Manuscript and Uploaded File Information
            </h2>
            <p>
              When you upload files (.docx, .pdf, .txt, .md) or draft chapters in the TipTap editor:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>We store your manuscript prose, chapter partitions, and revision histories.</li>
              <li>We extract narrative entity metadata: character names, aliases, traits, factions, locations, and timeline facts.</li>
              <li>We generate relationship links and continuity issue reports (e.g. classification of contradictions vs. intentional twists).</li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              4. How We Use Your Information
            </h2>
            <p>
              We use collected information solely to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Authenticate your identity and provide secure access to your writing projects.</li>
              <li>Extract entities, build Knowledge Graphs, and calculate continuity audits.</li>
              <li>Maintain point-in-time Story Architect snapshots and world-building canvases.</li>
              <li>Respond to support inquiries and technical requests submitted to our support team.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              5. AI Processing and Content Analysis
            </h2>
            <p>
              In our verified software implementation:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Manuscript text segments are transmitted via encrypted API connections to AI providers (specifically Google Gemini models) for the purpose of entity extraction and continuity auditing.</li>
              <li><strong>Zero Training on Author Prose:</strong> User manuscript prose is processed transiently for extraction and is not utilized to train public foundation models.</li>
              <li>Extraction prompts focus strictly on entity detection, chronology, and physical trait consistency.</li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              6. Data Storage and Security
            </h2>
            <p>
              NorthStar implements robust technical safeguards to protect author data:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>AES-256-GCM Vault Encryption:</strong> Raw uploaded manuscript files are encrypted on disk with 256-bit AES-GCM encryption before storage in your project's vault.</li>
              <li><strong>Database Protection:</strong> Relational metadata is managed in structured database tables partitioned by project ID and author ownership.</li>
              <li><strong>Vector Indexing:</strong> Semantic vector embeddings are persisted in local ChromaDB storage for continuity retrieval.</li>
              <li><strong>Transport Security:</strong> All client-to-server traffic is encrypted using HTTPS / TLS.</li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              7. Cookies and Session Management
            </h2>
            <p>
              NorthStar utilizes essential session cookies and local browser storage (such as <code className="px-1.5 py-0.5 rounded bg-[#1c1815]/5 dark:bg-white/5 font-mono text-[11px]">northstar_token</code>)
              strictly to maintain authenticated user sessions and preserve client interface settings (such as light or dark theme preferences). We do not deploy third-party advertising tracking cookies.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              8. Third-Party Services
            </h2>
            <p>
              The platform interfaces with select infrastructure providers:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>AI Providers:</strong> Google Gemini API for narrative entity extraction and auditing.</li>
              <li><strong>Authentication / Cloud:</strong> Optional Firebase authentication and Supabase database / storage integration.</li>
              <li><strong>Email Dispatch:</strong> SMTP email services for customer support ticket routing to <code className="px-1.5 py-0.5 rounded bg-[#1c1815]/5 dark:bg-white/5 font-mono text-[11px]">codebrew@gmail.com</code>.</li>
            </ul>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              9. Data Sharing and Disclosure
            </h2>
            <p>
              <strong>We do not sell, rent, or commercialize your manuscripts, outlines, or personal data to third parties.</strong>
            </p>
            <p>
              Data is shared only with trusted infrastructure subprocessors strictly as needed to deliver the application, or if
              required to comply with a valid legal obligation or court order.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              10. Data Retention and Deletion
            </h2>
            <p>
              Your projects and manuscripts are retained for as long as your account remains active. When you delete a chapter or
              project within NorthStar, its corresponding database records, vector passages, and encrypted vault files are removed.
              You may also request complete account deletion by contacting support.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              11. User Rights and Choices
            </h2>
            <p>
              Depending on your location, you may have rights under applicable privacy legislation (such as GDPR or CCPA):
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Access &amp; Portability:</strong> You can export your full story bible as JSON or CSV using the Narrative Vault export tool.</li>
              <li><strong>Rectification:</strong> You can modify or update project entities and account profile details at any time.</li>
              <li><strong>Deletion ("Right to be Forgotten"):</strong> You can delete projects or request total account removal.</li>
            </ul>
            <p className="text-[11.5px] italic text-[#1c1815]/60 dark:text-[#8b949e]">
              [Regional DPO contact and jurisdictional compliance details to be confirmed by legal counsel].
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              12. Children's Privacy
            </h2>
            <p>
              NorthStar is intended for general audiences and professional storytellers. The Service is not directed to individuals
              under the age of 13 (or under 16 in the European Economic Area). We do not knowingly collect personal data from children.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              13. Policy Updates
            </h2>
            <p>
              We may update this Privacy Policy from time to time to reflect operational or regulatory changes. We will notify users
              of material modifications by revising the "Effective Date" at the top of this document.
            </p>
          </section>

          {/* Section 14 */}
          <section className="space-y-3">
            <h2 className="font-fraunces text-lg sm:text-xl font-semibold text-[#1c1815] dark:text-[#f0f6fc] border-b border-[#1c1815]/10 dark:border-white/10 pb-2">
              14. Contact Information
            </h2>
            <p>
              For privacy inquiries, data access requests, or questions regarding data handling practices:
            </p>
            <div className="bg-[#f6f6f4] dark:bg-[#121214] p-4 rounded-xl border border-[#1c1815]/10 dark:border-white/10 space-y-1.5 mt-2">
              <div>
                <strong>Privacy &amp; Support Email:</strong>{' '}
                <a href="mailto:codebrew@gmail.com" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">
                  codebrew@gmail.com
                </a>
              </div>
              <div>
                <strong>Telephone Helpline:</strong>{' '}
                <a href="tel:+18005550199" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">
                  +919231456311
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
            <Link to="/terms" className="hover:text-[#1c1815] dark:hover:text-[#f5f5f7] transition-colors">
              Terms of Service
            </Link>
            <Link to="/privacy" className="text-[#7b2d3b] dark:text-[#fca5a5] font-semibold">
              Privacy Policy
            </Link>
            <Link to="/support" className="hover:text-[#1c1815] dark:hover:text-[#f5f5f7] transition-colors">
              Help &amp; Support
            </Link>
            <a href="mailto:codebrew@gmail.com" className="hover:text-[#1c1815] dark:hover:text-[#f5f5f7] transition-colors">
              codebrew@gmail.com
            </a>
            <span className="text-[#8e8e93]/60">&copy; {new Date().getFullYear()} NorthStar AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
