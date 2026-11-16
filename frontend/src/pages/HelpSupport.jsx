import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  Wrench,
  Mail,
  Phone,
  Clock,
  ChevronDown,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Sparkles,
  Compass,
  GitFork,
  AlertTriangle,
  FolderOpen,
  Feather,
  ShieldCheck,
  Send,
  UserCheck,
  LogIn,
  FileUp,
  LayoutDashboard,
  Check
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { supportService } from '../services/api';

export default function HelpSupport() {
  useDocumentTitle('Help & Support | NorthStar');
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, faqs, guide, troubleshooting, contact

  // FAQ Accordion State (all collapsed initially or first one open)
  const [expandedFaq, setExpandedFaq] = useState({ 0: true });

  // Contact Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General Inquiry');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [submitResult, setSubmitResult] = useState(null); // { success: true, ticket_id, message } or { success: false, error }

  // Sync authenticated user info if it loads later
  React.useEffect(() => {
    if (user) {
      if (!fullName && user.full_name) setFullName(user.full_name);
      if (!email && user.email) setEmail(user.email);
    }
  }, [user]);

  // Toggle FAQ expansion
  const toggleFaq = (index) => {
    setExpandedFaq((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const expandAllFaqs = () => {
    const all = {};
    FAQS.forEach((_, idx) => {
      all[idx] = true;
    });
    setExpandedFaq(all);
  };

  const collapseAllFaqs = () => {
    setExpandedFaq({});
  };

  // ========================================================
  // B. FREQUENTLY ASKED QUESTIONS (FAQS)
  // Covering all 10 required questions accurately based on actual implementation
  // ========================================================
  const FAQS = [
    {
      q: 'What is NorthStar?',
      category: 'General',
      answer: (
        <div className="space-y-2 text-[13.5px] leading-relaxed">
          <p>
            <strong>NorthStar</strong> is an intelligent, browser-based AI Continuity Guardian and world-building
            workspace engineered specifically for novelists, screenwriters, and narrative architects.
          </p>
          <p>
            Unlike generic text editors, NorthStar ingests your manuscript (.docx, .pdf, .txt, .md), extracts characters,
            traits, locations, timelines, and narrative canon into a persistent <strong>Knowledge Graph</strong>, and
            continuously audits your prose for continuity contradictions, timeline paradoxes, and character anomalies in real time.
          </p>
        </div>
      ),
    },
    {
      q: 'How do I create a new account?',
      category: 'Account',
      answer: (
        <div className="space-y-2 text-[13.5px] leading-relaxed">
          <p>
            Creating a NorthStar author account takes less than a minute:
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Click <strong>Sign In</strong> in the top navigation bar or go directly to <Link to="/auth" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">/auth</Link>.</li>
            <li>Click the <strong>Create account</strong> pill button in the top right or above the form.</li>
            <li>Enter your Full Name, Email Address, and choose a Password (minimum 6 characters), then confirm your password.</li>
            <li>Click <strong>Create account</strong>. Your private workspace is instantly initialized!</li>
          </ol>
          <p className="text-xs text-[#8e8e93] pt-1">
            Alternatively, click <strong>Continue with Google</strong> for instant Single Sign-On, or test the platform immediately using <strong>Instant Guest Author</strong> mode.
          </p>
        </div>
      ),
    },
    {
      q: 'How do I log in to my account?',
      category: 'Login',
      answer: (
        <div className="space-y-2 text-[13.5px] leading-relaxed">
          <p>
            To log in to your existing NorthStar account:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Navigate to the authentication page at <Link to="/auth" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">/auth</Link>.</li>
            <li>Enter your registered email address and password, then click <strong>Sign in to NorthStar</strong>.</li>
            <li>If you registered using Google, simply click the <strong>Continue with Google</strong> button.</li>
            <li>Once authenticated, you will be automatically redirected to your personal <strong>All Projects Dashboard</strong>.</li>
          </ul>
        </div>
      ),
    },
    {
      q: 'How do I create a new writing project?',
      category: 'Projects',
      answer: (
        <div className="space-y-2 text-[13.5px] leading-relaxed">
          <p>
            Creating a story project initializes an isolated universe with its own narrative memory and knowledge graph:
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Go to the <strong>All Projects Dashboard</strong> (<Link to="/dashboard" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">/dashboard</Link>).</li>
            <li>Click the dark <strong>+ New Project</strong> button in the upper right.</li>
            <li>Enter your story's title and an optional premise, logline, or genre description.</li>
            <li>Click <strong>Create Project</strong> to instantly initialize your isolated world canon and workspace.</li>
          </ol>
          <p className="text-xs text-[#8e8e93] pt-1">
            Tip: You can also click <em>Load Demo Manuscript</em> on the dashboard to explore the pre-analyzed high fantasy universe "The Last Kingdom".
          </p>
        </div>
      ),
    },
    {
      q: 'How do I upload a manuscript?',
      category: 'Manuscripts',
      answer: (
        <div className="space-y-2 text-[13.5px] leading-relaxed">
          <p>
            NorthStar accepts manuscripts in <strong>.docx</strong>, <strong>.pdf</strong>, <strong>.md</strong>, and <strong>.txt</strong> formats up to 50MB per file:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>From Dashboard:</strong> Click <em>Upload Manuscript</em> directly inside any project card or when creating a project.</li>
            <li><strong>From Manuscript Workspace:</strong> Inside your project workspace (<span className="font-mono text-xs">/workspace/:projectId</span>), click the <em>Upload</em> button on the left sidebar to add new chapters or revisions.</li>
            <li><strong>From Attachment Vault:</strong> Access your project's encrypted private vault (<span className="font-mono text-xs">/vault/:projectId</span>) to securely store source documents and character art.</li>
          </ul>
          <p className="text-xs text-[#8e8e93] pt-1">
            Every uploaded file is protected with confidential AES-256-GCM encryption in your private vault before being segmented into chapters and extracted into narrative memory.
          </p>
        </div>
      ),
    },
    {
      q: 'What is Story Architect?',
      category: 'Features',
      answer: (
        <div className="space-y-2 text-[13.5px] leading-relaxed">
          <p>
            <strong>Story Architect</strong> (<span className="font-mono text-xs">/architect/:projectId</span>) is your universe canon command center.
            It provides a visual, multi-perspective canvas to design and oversee your story's world:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>2D Force Directed Graph:</strong> Interactive physics simulation displaying how characters, places, and factions cluster together.</li>
            <li><strong>Radial Hierarchy:</strong> Circular orbital view showcasing primary protagonists and their secondary relational circles.</li>
            <li><strong>Narrative Chronology:</strong> Sequential timeline mapping out chapter events, character introductions, and major conflicts.</li>
            <li><strong>Universe Canon Inspector:</strong> Review established story facts, adjust entity protection levels, and approve or reject canon updates.</li>
          </ul>
        </div>
      ),
    },
    {
      q: 'What happens if I lose my account password?',
      category: 'Account',
      answer: (
        <div className="space-y-2 text-[13.5px] leading-relaxed">
          <p>
            Account recovery options depend on how you signed up:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Google Sign-In:</strong> If you created your account with Google Single Sign-On, you do not have a separate NorthStar password. Use Google's standard password recovery service.</li>
            <li><strong>Email &amp; Password:</strong> Use the <strong>Contact Support</strong> form below (select category <em>Account</em> or <em>Login</em>) or email us directly at <a href="mailto:codebrew@gmail.com" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">codebrew@gmail.com</a> from your registered address. Our engineering team will assist in verifying ownership and restoring access.</li>
          </ul>
        </div>
      ),
    },
    {
      q: 'How does NorthStar maintain story continuity?',
      category: 'Continuity',
      answer: (
        <div className="space-y-2 text-[13.5px] leading-relaxed">
          <p>
            NorthStar maintains story continuity through an integrated multi-agent intelligence pipeline:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Living Story Bible:</strong> As prose is written or uploaded, background agents extract characters, physical traits (e.g. eye color, dominant hand, injuries), timeline markers, and relationship shifts.</li>
            <li><strong>Vector &amp; Graph Memory:</strong> Narrative facts are embedded into ChromaDB vector memory and connected within a relational graph database.</li>
            <li><strong>Continuity Audit Engine:</strong> The system continuously scans cross-chapter text to detect <em>Direct Contradictions</em> (e.g. character appearing after death), <em>Likely Conflicts</em>, and <em>Timeline Paradoxes</em>, highlighting the exact contrasting quotes side-by-side.</li>
          </ul>
        </div>
      ),
    },
    {
      q: 'Can I access my projects after logging out?',
      category: 'Projects',
      answer: (
        <div className="space-y-2 text-[13.5px] leading-relaxed">
          <p>
            <strong>Yes, absolutely.</strong> All projects, manuscripts, knowledge graphs, and continuity audit reports for registered users are permanently and securely stored in the database.
          </p>
          <p>
            Whenever you log back into your NorthStar account from any computer or browser, your complete story portfolio and continuity state are immediately restored.
          </p>
          <p className="text-xs text-[#8e8e93] pt-1">
            Note: If you use <em>Instant Guest Author</em> mode, guest data is session-based and cleaned up upon logout to preserve sandbox hygiene. Register a free account to ensure permanent cloud persistence.
          </p>
        </div>
      ),
    },
    {
      q: 'How can I report a technical issue?',
      category: 'Technical',
      answer: (
        <div className="space-y-2 text-[13.5px] leading-relaxed">
          <p>
            You can report technical issues, bug sightings, or feature difficulties in multiple ways:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Contact Support Form:</strong> Fill out the form at the bottom of this page, select the <em>Technical Issue</em> category, describe what happened, and click Submit.</li>
            <li><strong>Direct Support Email:</strong> Email <a href="mailto:codebrew@gmail.com" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">codebrew@gmail.com</a> directly with relevant details or screenshots.</li>
            <li><strong>Telephone Helpline:</strong> Call our official support hotline at <a href="tel:+18005550199" className="text-[#7b2d3b] dark:text-[#fca5a5] underline font-medium">+919231456311</a>.</li>
          </ul>
        </div>
      ),
    },
  ];

  // ========================================================
  // C. GETTING STARTED GUIDE
  // 6 simple steps for new users
  // ========================================================
  const GETTING_STARTED_STEPS = [
    {
      step: 1,
      title: 'Create a NorthStar account',
      icon: UserCheck,
      description: 'Sign up with your email and password, or use Google Single Sign-On for instant access to your private author vault.',
      actionText: 'Create Account',
      actionLink: '/auth',
    },
    {
      step: 2,
      title: 'Sign in to the application',
      icon: LogIn,
      description: 'Log into your secure session to access your personal writing environment and isolated narrative databases.',
      actionText: 'Sign In',
      actionLink: '/auth',
    },
    {
      step: 3,
      title: 'Navigate to the workplace dashboard',
      icon: LayoutDashboard,
      description: 'Your central hub displays all your active story universes, chapter metrics, word counts, and quick-action shortcuts.',
      actionText: 'Open Dashboard',
      actionLink: '/dashboard',
    },
    {
      step: 4,
      title: 'Create a new project',
      icon: FolderOpen,
      description: 'Click "+ New Project" to initialize a blank story universe, or load the pre-configured high fantasy demo to explore instantly.',
      actionText: 'New Project',
      actionLink: '/dashboard',
    },
    {
      step: 5,
      title: 'Upload your manuscript',
      icon: FileUp,
      description: 'Import your Word (.docx), PDF, Markdown, or plain text draft. NorthStar automatically parses chapters into encrypted storage.',
      actionText: 'Learn Uploads',
      actionLink: '#faqs',
    },
    {
      step: 6,
      title: 'Explore writing & continuity tools',
      icon: Sparkles,
      description: 'Switch between the TipTap Manuscript Workspace, the visual Story Architect graph, and the cross-chapter Continuity Report audit.',
      actionText: 'Explore Features',
      actionLink: '/dashboard',
    },
  ];

  // ========================================================
  // D. TROUBLESHOOTING SECTION
  // Common problems and practical solutions
  // ========================================================
  const TROUBLESHOOTING_ITEMS = [
    {
      issue: 'Unable to log in',
      badge: 'Authentication',
      category: 'Login',
      symptoms: 'Invalid credentials error, session expired loop, or Google pop-up blocked.',
      solutions: [
        'Verify your email spelling and check that Caps Lock is disabled.',
        'If using Google Sign-In, ensure pop-up blockers or strict third-party cookie restrictions are disabled for the site.',
        'Try logging in via "Instant Guest Author" to verify your browser can establish WebSocket and API sessions.',
        'Clear browser cookies and localStorage for the domain, then refresh.',
      ],
    },
    {
      issue: 'Password reset issues',
      badge: 'Account Access',
      category: 'Account',
      symptoms: 'Did not receive reset link, or unable to remember registered credentials.',
      solutions: [
        'Check your email Spam and Promotions folders for messages from NorthStar Support.',
        'If you created your account with Google Sign-In, you do not have a separate password — use "Continue with Google".',
        'Contact support via the form below or directly email codebrew@gmail.com with your registered email.',
      ],
    },
    {
      issue: 'Manuscript upload failures',
      badge: 'File Ingestion',
      category: 'Manuscript Upload',
      symptoms: 'Upload gets stuck, "File parsing error", or timeout on large document.',
      solutions: [
        'Confirm the file format is supported: .docx, .pdf, .md, or .txt (convert legacy .doc files to .docx).',
        'Ensure file size is under 50MB. For larger manuscripts, consider uploading in parts.',
        'Verify the document is not password-protected or DRM-locked.',
        'If uploading a PDF, ensure the text is selectable (not scanned raster images without OCR).',
      ],
    },
    {
      issue: 'Project not loading',
      badge: 'Database / API',
      category: 'Technical Issue',
      symptoms: 'Endless loading skeleton, blank workspace, or 404 Project Not Found.',
      solutions: [
        'Verify your internet connection and check if the backend service is healthy at /api/health.',
        'Ensure you are logged in with the author account that created the project (project isolation prevents cross-account viewing).',
        'Hard refresh the page using Ctrl+F5 (or Cmd+Shift+R) to clear stale cached client bundles.',
        'Check the All Projects Dashboard to see if the project appears in your project list.',
      ],
    },
    {
      issue: 'Dashboard not displaying correctly',
      badge: 'UI & Layout',
      category: 'Technical Issue',
      symptoms: 'Missing project cards, overlapping navigation buttons, or theme glitches.',
      solutions: [
        'Toggle between light and dark themes using the sun/moon toggle in the top navbar to trigger theme re-rendering.',
        'Check your browser zoom level (Ctrl+0 or Cmd+0 to reset to 100%).',
        'Ensure modern browser support: latest Chrome, Firefox, Safari, or Edge are recommended.',
        'If issues persist, disable conflicting third-party browser extensions or ad-blockers.',
      ],
    },
    {
      issue: 'Unexpected application errors',
      badge: 'System Error',
      category: 'Technical Issue',
      symptoms: '"Something went wrong" crash screen or unexpected error toast alert.',
      solutions: [
        'Click the "Reload Page" button on the error screen to trigger fresh component re-mounting.',
        'Check browser developer console (F12) for detailed network error codes.',
        'If an AI analysis request failed, retry the chapter continuity check — rate limits may occasionally trigger a brief backoff.',
        'Submit a detailed bug report using the contact form below with the error message text.',
      ],
    },
  ];

  // Filtered FAQs based on search query
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return FAQS;
    const q = searchQuery.toLowerCase();
    return FAQS.filter(
      (item) => item.q.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Filtered Troubleshooting based on search query
  const filteredTroubleshooting = useMemo(() => {
    if (!searchQuery.trim()) return TROUBLESHOOTING_ITEMS;
    const q = searchQuery.toLowerCase();
    return TROUBLESHOOTING_ITEMS.filter(
      (t) =>
        t.issue.toLowerCase().includes(q) ||
        t.symptoms.toLowerCase().includes(q) ||
        t.badge.toLowerCase().includes(q) ||
        t.solutions.some((s) => s.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  // Form Validation & Submission
  const validateForm = () => {
    const errors = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full Name is required (at least 2 characters).';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = 'Email Address is required.';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please provide a valid email address (e.g. author@example.com).';
    }
    if (!subject.trim()) {
      errors.subject = 'Subject is required (at least 3 characters).';
    } else if (subject.trim().length < 3) {
      errors.subject = 'Subject must be at least 3 characters long.';
    }
    if (!category.trim()) {
      errors.category = 'Please select an issue category.';
    }
    if (!description.trim()) {
      errors.description = 'Detailed description of the problem is required.';
    } else if (description.trim().length < 10) {
      errors.description = 'Please provide at least 10 characters to describe the issue.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSubmitResult(null);

    if (!validateForm()) {
      toast.error('Please fill in all required fields correctly before submitting.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await supportService.submitContactForm({
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        subject: subject.trim(),
        category: category.trim(),
        description: description.trim(),
      });

      setSubmitResult({
        success: true,
        ticket_id: response.ticket_id,
        message: response.message || 'Your support inquiry has been successfully received.',
        category: response.category || category,
      });
      toast.success('Your support request has been submitted successfully!');

      // Reset fields (preserve user identity)
      setSubject('');
      setDescription('');
      setFormErrors({});
    } catch (err) {
      console.error('Support form submission failed:', err);
      const errorMsg =
        err?.response?.data?.detail ||
        err?.message ||
        'Unable to deliver inquiry right now. Please reach out to codebrew@gmail.com directly.';
      setSubmitResult({
        success: false,
        error: errorMsg,
      });
      toast.error('Submission failed: ' + errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTroubleshootingPrefill = (troubleItem) => {
    setActiveTab('all');
    setCategory(troubleItem.category || 'Technical Issue');
    setSubject(`Assistance needed: ${troubleItem.issue}`);
    setDescription(`I am experiencing issues with "${troubleItem.issue}". Symptoms: ${troubleItem.symptoms}`);
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-[#161618] text-[#1c1815] dark:text-[#f5f5f7] flex flex-col font-inter selection:bg-[#7b2d3b] selection:text-[#faf6ef] transition-colors duration-200">
      {/* Top Application Navbar */}
      <Navbar isDashboard={true} />

      {/* Return Navigation & Breadcrumb Bar */}
      <div className="border-b border-[#1c1815]/10 dark:border-white/10 bg-[#f6f6f4]/60 dark:bg-[#121214]/60 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-2.5 transition-colors">
        <div className="max-w-[1180px] mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-[#636366] dark:text-[#8e8e93]">
            <Link
              to={user ? "/dashboard" : "/"}
              className="hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors font-medium"
            >
              {user ? 'Dashboard' : 'Home'}
            </Link>
            <span>/</span>
            <span className="text-[#1c1815] dark:text-[#f5f5f7] font-semibold">Help &amp; Support</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 2) {
                  navigate(-1);
                } else {
                  navigate(user ? '/dashboard' : '/');
                }
              }}
              className="inline-flex items-center space-x-1.5 text-[#636366] dark:text-[#8e8e93] hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] font-medium transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to previous page</span>
            </button>
            <span className="text-[#1c1815]/20 dark:text-white/20">&bull;</span>
            <Link
              to="/"
              className="text-[#636366] dark:text-[#8e8e93] hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] font-medium transition-colors"
            >
              Landing Page
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================
          A. HEADER SECTION
          Heading: "How can we help you?"
          Subtitle: "Find answers, learn how to use NorthStar, or get in touch with our support team."
          Search field to help users find relevant FAQs.
          ======================================================== */}
      <section className="relative border-b border-[#1c1815]/10 dark:border-white/10 overflow-hidden bg-[#f6f6f4] dark:bg-[#161618]">
        {/* Subtle grid accent */}
        <div className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20 bg-[radial-gradient(#1c1815_1px,transparent_1px)] dark:bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f6f6f4]/40 to-[#f6f6f4] dark:via-[#161618]/40 dark:to-[#161618] pointer-events-none" />

        <div className="relative max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-10 sm:pt-14 sm:pb-12">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7b2d3b]/20 dark:border-[#7b2d3b]/40 bg-[#7b2d3b]/5 dark:bg-[#7b2d3b]/20 px-3 py-1 shadow-2xs mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7b2d3b] dark:bg-[#fca5a5] animate-pulse" />
            <span className="text-[12px] font-semibold text-[#7b2d3b] dark:text-[#fca5a5] uppercase tracking-wider font-mono-cap">
              NorthStar Help &amp; Support System
            </span>
          </div>

          {/* Heading strictly as specified */}
          <h1 className="font-fraunces text-3xl sm:text-5xl lg:text-[54px] font-medium tracking-tight text-[#1c1815] dark:text-[#f0f6fc] leading-[1.08] mb-3">
            How can we help you?
          </h1>

          {/* Subtitle strictly as specified */}
          <p className="font-inter text-sm sm:text-base text-[#636366] dark:text-[#8e8e93] max-w-2xl leading-relaxed mb-8">
            Find answers, learn how to use NorthStar, or get in touch with our support team.
          </p>

          {/* Search Field */}
          <div className="max-w-2xl relative mb-6">
            <Search className="w-4 h-4 text-[#8e8e93] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search FAQs, guides, errors, or keywords (e.g. upload, password, architect)..."
              className="w-full pl-10 pr-12 py-3 rounded-xl border border-[#1c1815]/15 dark:border-white/15 bg-white dark:bg-[#1c1c1e] text-sm text-[#1c1815] dark:text-[#f5f5f7] placeholder-[#8e8e93] shadow-xs focus:outline-none focus:ring-2 focus:ring-[#7b2d3b]/30 focus:border-[#7b2d3b] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8e8e93] hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Section Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {[
              { id: 'faqs', label: 'FAQs', icon: HelpCircle },
              { id: 'guide', label: 'Getting Started Guide', icon: Compass },
              { id: 'troubleshooting', label: 'Troubleshooting', icon: Wrench },
              { id: 'contact', label: 'Contact Support', icon: Mail },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (activeTab === tab.id) {
                      setActiveTab('all');
                    } else {
                      setActiveTab(tab.id);
                      document.getElementById(tab.id)?.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#7b2d3b] text-white shadow-xs font-semibold'
                      : 'bg-white/80 dark:bg-[#1c1c1e]/80 text-[#636366] dark:text-[#8e8e93] border border-[#1c1815]/10 dark:border-white/10 hover:bg-[#7b2d3b]/10 hover:text-[#7b2d3b] dark:hover:text-[#fca5a5]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================
          MAIN CONTENT CONTAINER
          ======================================================== */}
      <main className="flex-1 max-w-[1180px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">

        {/* ========================================================
            B. FREQUENTLY ASKED QUESTIONS (FAQS)
            Interactive expandable/collapsible accordion components
            ======================================================== */}
        {(activeTab === 'all' || activeTab === 'faqs') && (
          <section id="faqs" className="scroll-mt-24 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-[#1c1815]/10 dark:border-white/10">
              <div>
                <div className="flex items-center space-x-2 text-[#7b2d3b] dark:text-[#fca5a5] text-xs font-semibold uppercase tracking-wider font-mono-cap mb-1">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Section B &bull; Interactive Knowledge Base</span>
                </div>
                <h2 className="font-fraunces text-2xl sm:text-3xl font-medium tracking-tight text-[#1c1815] dark:text-[#f0f6fc]">
                  Frequently Asked Questions
                </h2>
                <p className="text-xs sm:text-sm text-[#636366] dark:text-[#8e8e93] mt-1">
                  Explore answers to common questions about NorthStar accounts, writing projects, manuscripts, and story continuity.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={expandAllFaqs}
                  className="px-3 py-1.5 text-xs font-medium text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1815] dark:hover:text-[#f5f5f7] border border-[#1c1815]/15 dark:border-white/15 rounded-lg bg-white dark:bg-[#1c1c1e] transition-colors cursor-pointer shadow-2xs"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAllFaqs}
                  className="px-3 py-1.5 text-xs font-medium text-[#636366] dark:text-[#8e8e93] hover:text-[#1c1c1e] dark:hover:text-[#f5f5f7] border border-[#1c1815]/15 dark:border-white/15 rounded-lg bg-white dark:bg-[#1c1c1e] transition-colors cursor-pointer shadow-2xs"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {filteredFaqs.length === 0 ? (
              <div className="bg-white dark:bg-[#1c1c1e] rounded-xl border border-[#1c1815]/10 dark:border-white/10 p-8 text-center text-sm text-[#8e8e93]">
                No questions found matching "{searchQuery}". Try a different search term or submit an inquiry via Contact Support below.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFaqs.map((faq, index) => {
                  const isOpen = !!expandedFaq[index];
                  return (
                    <div
                      key={faq.q}
                      className={`rounded-xl border transition-all duration-200 bg-white dark:bg-[#1c1c1e] ${
                        isOpen
                          ? 'border-[#7b2d3b]/40 dark:border-[#7b2d3b]/60 shadow-xs'
                          : 'border-[#1c1815]/10 dark:border-white/10 hover:border-[#1c1815]/20 dark:hover:border-white/20'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleFaq(index)}
                        className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 cursor-pointer"
                        aria-expanded={isOpen}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <span className="text-[11px] font-mono-cap px-2.5 py-0.5 rounded-full bg-[#7b2d3b]/10 dark:bg-[#7b2d3b]/25 text-[#7b2d3b] dark:text-[#fca5a5] border border-[#7b2d3b]/20 dark:border-[#7b2d3b]/30 shrink-0 font-medium">
                            {faq.category}
                          </span>
                          <span className="font-semibold text-sm sm:text-[15px] text-[#1c1815] dark:text-[#f0f6fc]">
                            {faq.q}
                          </span>
                        </div>
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center text-[#8e8e93] transition-transform duration-200 shrink-0 ${
                            isOpen ? 'rotate-180 text-[#7b2d3b] dark:text-[#fca5a5]' : ''
                          }`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 text-[#636366] dark:text-[#8e8e93] border-t border-[#1c1815]/5 dark:border-white/5 animate-fadeIn">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ========================================================
            C. GETTING STARTED GUIDE
            Step-by-step guide for new users:
            1. Create a NorthStar account
            2. Sign in to the application
            3. Navigate to the workplace dashboard
            4. Create a new project
            5. Upload your manuscript
            6. Explore the available writing and continuity tools
            ======================================================== */}
        {(activeTab === 'all' || activeTab === 'guide') && (
          <section id="guide" className="scroll-mt-24 space-y-6">
            <div className="pb-3 border-b border-[#1c1815]/10 dark:border-white/10">
              <div className="flex items-center space-x-2 text-[#7b2d3b] dark:text-[#fca5a5] text-xs font-semibold uppercase tracking-wider font-mono-cap mb-1">
                <Compass className="w-3.5 h-3.5" />
                <span>Section C &bull; New User Walkthrough</span>
              </div>
              <h2 className="font-fraunces text-2xl sm:text-3xl font-medium tracking-tight text-[#1c1815] dark:text-[#f0f6fc]">
                Getting Started Guide
              </h2>
              <p className="text-xs sm:text-sm text-[#636366] dark:text-[#8e8e93] mt-1">
                Follow this simple step-by-step roadmap to start writing with AI continuity intelligence in minutes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {GETTING_STARTED_STEPS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.step}
                    className="rounded-2xl border border-[#1c1815]/10 dark:border-white/10 bg-white dark:bg-[#1c1c1e] p-6 shadow-xs flex flex-col justify-between hover:shadow-sm hover:border-[#7b2d3b]/30 dark:hover:border-[#7b2d3b]/50 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="w-8 h-8 rounded-full bg-[#7b2d3b] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                          {item.step}
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-[#7b2d3b]/10 text-[#7b2d3b] dark:text-[#fca5a5] flex items-center justify-center">
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>

                      <h3 className="font-bold text-base text-[#1c1815] dark:text-[#f0f6fc] pt-1">
                        {item.title}
                      </h3>

                      <p className="text-xs text-[#636366] dark:text-[#8e8e93] leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-[#1c1815]/5 dark:border-white/5 flex items-center justify-between">
                      <span className="text-[11px] font-mono-cap text-[#8e8e93]">Step {item.step} of 6</span>
                      <Link
                        to={item.actionLink}
                        className="text-xs font-semibold text-[#7b2d3b] dark:text-[#fca5a5] hover:underline inline-flex items-center space-x-1"
                      >
                        <span>{item.actionText}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ========================================================
            D. TROUBLESHOOTING SECTION
            Common problems and their solutions:
            - Unable to log in.
            - Password reset issues.
            - Manuscript upload failures.
            - Project not loading.
            - Dashboard not displaying correctly.
            - Unexpected application errors.
            ======================================================== */}
        {(activeTab === 'all' || activeTab === 'troubleshooting') && (
          <section id="troubleshooting" className="scroll-mt-24 space-y-6">
            <div className="pb-3 border-b border-[#1c1815]/10 dark:border-white/10">
              <div className="flex items-center space-x-2 text-[#7b2d3b] dark:text-[#fca5a5] text-xs font-semibold uppercase tracking-wider font-mono-cap mb-1">
                <Wrench className="w-3.5 h-3.5" />
                <span>Section D &bull; Diagnostic Solutions</span>
              </div>
              <h2 className="font-fraunces text-2xl sm:text-3xl font-medium tracking-tight text-[#1c1815] dark:text-[#f0f6fc]">
                Troubleshooting &amp; Common Issues
              </h2>
              <p className="text-xs sm:text-sm text-[#636366] dark:text-[#8e8e93] mt-1">
                Practical solutions for authentication hurdles, upload delays, and workspace rendering anomalies.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTroubleshooting.map((item) => (
                <div
                  key={item.issue}
                  className="rounded-2xl border border-[#1c1815]/10 dark:border-white/10 bg-white dark:bg-[#1c1c1e] p-5 shadow-xs flex flex-col justify-between hover:border-[#1c1815]/20 dark:hover:border-white/20 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono-cap uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1c1815]/5 dark:bg-white/5 border border-[#1c1815]/10 dark:border-white/10 text-[#8e8e93]">
                        {item.badge}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                    </div>

                    <h3 className="font-bold text-base text-[#1c1815] dark:text-[#f0f6fc]">
                      {item.issue}
                    </h3>

                    <div className="text-[11.5px] text-[#8e8e93] bg-[#f6f6f4] dark:bg-[#121214] p-2.5 rounded-lg border border-[#1c1815]/5 dark:border-white/5">
                      <span className="font-semibold text-[#1c1815] dark:text-[#f5f5f7] block mb-0.5">Symptoms:</span>
                      {item.symptoms}
                    </div>

                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] font-semibold text-[#1c1815] dark:text-[#f5f5f7] block">
                        Practical Fixes:
                      </span>
                      <ul className="space-y-1.5 text-xs text-[#636366] dark:text-[#8e8e93]">
                        {item.solutions.map((sol, i) => (
                          <li key={i} className="flex items-start space-x-2">
                            <span className="text-[#7b2d3b] dark:text-[#fca5a5] font-bold">&bull;</span>
                            <span className="leading-relaxed">{sol}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[#1c1815]/5 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => handleTroubleshootingPrefill(item)}
                      className="text-[11px] font-semibold text-[#7b2d3b] dark:text-[#fca5a5] hover:underline inline-flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Problem persists? Contact support</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================
            E. CONTACT SUPPORT SECTION
            Official contact info:
            - Email: codebrew@gmail.com (clickable mailto link)
            - Phone: +919231456311 (clickable tel link)
            Contact Support form with fields:
            - Full Name
            - Email Address
            - Subject
            - Issue Category (Account, Login, Manuscript Upload, Technical Issue, General Inquiry, Other)
            - Detailed Description of the Problem
            Validation, loading state, success confirmation, clear error messages.
            ======================================================== */}
        {(activeTab === 'all' || activeTab === 'contact') && (
          <section id="contact" className="scroll-mt-24 space-y-6">
            <div className="pb-3 border-b border-[#1c1815]/10 dark:border-white/10">
              <div className="flex items-center space-x-2 text-[#7b2d3b] dark:text-[#fca5a5] text-xs font-semibold uppercase tracking-wider font-mono-cap mb-1">
                <Mail className="w-3.5 h-3.5" />
                <span>Section E &bull; Direct Author Assistance</span>
              </div>
              <h2 className="font-fraunces text-2xl sm:text-3xl font-medium tracking-tight text-[#1c1815] dark:text-[#f0f6fc]">
                Contact Support
              </h2>
              <p className="text-xs sm:text-sm text-[#636366] dark:text-[#8e8e93] mt-1">
                Reach our dedicated author support team directly via email, telephone hotline, or the validated contact dispatch form below.
              </p>
            </div>

            {/* Official Contact Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Email Card (mailto:codebrew@gmail.com) */}
              <div className="rounded-2xl border border-[#1c1c1e]/10 dark:border-white/10 bg-white dark:bg-[#1c1c1e] p-6 shadow-xs flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#7b2d3b]/10 text-[#7b2d3b] dark:text-[#fca5a5] flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono-cap uppercase tracking-wider text-[#8e8e93] block">
                      Official Email
                    </span>
                    <a
                      href="mailto:codebrew@gmail.com"
                      className="text-base sm:text-lg font-bold text-[#1c1815] dark:text-[#f5f5f7] hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors break-all"
                    >
                      codebrew@gmail.com
                    </a>
                  </div>
                  <p className="text-xs text-[#636366] dark:text-[#8e8e93] leading-relaxed">
                    Direct inquiries, enterprise account restoration, and general support. Click to open your default email client.
                  </p>
                </div>
                <div className="pt-4 mt-3 border-t border-[#1c1815]/5 dark:border-white/5">
                  <a
                    href="mailto:codebrew@gmail.com"
                    className="btn btn-outline btn-sm w-full text-xs"
                  >
                    <span>Send Email (mailto)</span>
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </div>

              {/* Phone Card (tel:+18005550199) */}
              <div className="rounded-2xl border border-[#1c1c1e]/10 dark:border-white/10 bg-white dark:bg-[#1c1c1e] p-6 shadow-xs flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#7b2d3b]/10 text-[#7b2d3b] dark:text-[#fca5a5] flex items-center justify-center">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono-cap uppercase tracking-wider text-[#8e8e93] block">
                      Telephone Helpline
                    </span>
                    <a
                      href="tel:+18005550199"
                      className="text-base sm:text-lg font-bold text-[#1c1815] dark:text-[#f5f5f7] hover:text-[#7b2d3b] dark:hover:text-[#fca5a5] transition-colors"
                    >
                      +919231456311
                    </a>
                  </div>
                  <p className="text-xs text-[#636366] dark:text-[#8e8e93] leading-relaxed">
                    Direct telephone assistance for urgent inquiries. Click to initiate a phone call from mobile or VoIP software.
                  </p>
                </div>
                <div className="pt-4 mt-3 border-t border-[#1c1815]/5 dark:border-white/5">
                  <a
                    href="tel:+18005550199"
                    className="btn btn-outline btn-sm w-full text-xs"
                  >
                    <span>Call Hotline (tel)</span>
                    <Phone className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </div>

              {/* Hours & Response Card */}
              <div className="rounded-2xl border border-[#1c1c1e]/10 dark:border-white/10 bg-white dark:bg-[#1c1c1e] p-6 shadow-xs flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#7b2d3b]/10 text-[#7b2d3b] dark:text-[#fca5a5] flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono-cap uppercase tracking-wider text-[#8e8e93] block">
                      Availability &amp; Response
                    </span>
                    <span className="text-base sm:text-lg font-bold text-[#1c1815] dark:text-[#f5f5f7]">
                      Mon &ndash; Fri, 9am &ndash; 6pm EST
                    </span>
                  </div>
                  <p className="text-xs text-[#636366] dark:text-[#8e8e93] leading-relaxed">
                    Automated continuity logging is active 24/7. All submitted support tickets are securely routed to our engineering queue.
                  </p>
                </div>
                <div className="pt-4 mt-3 border-t border-[#1c1815]/5 dark:border-white/5 flex items-center justify-between text-[11px] text-[#8e8e93]">
                  <span>Average Ticket Response:</span>
                  <span className="font-semibold text-[#1c1815] dark:text-[#f5f5f7]">&lt; 4 hours</span>
                </div>
              </div>
            </div>

            {/* Dedicated Contact Support Form Container */}
            <div className="rounded-2xl border border-[#1c1c1e]/10 dark:border-white/10 bg-white dark:bg-[#1c1c1e] p-6 sm:p-8 shadow-sm">
              <div className="max-w-3xl">
                <div className="mb-6">
                  <h3 className="font-fraunces text-xl sm:text-2xl font-medium tracking-tight text-[#1c1815] dark:text-[#f0f6fc]">
                    Send a Message to Support
                  </h3>
                  <p className="text-xs sm:text-sm text-[#636366] dark:text-[#8e8e93] mt-1">
                    Please provide full details of your request. Submitted inquiries are safely stored in our support database and dispatched to{' '}
                    <span className="font-semibold text-[#7b2d3b] dark:text-[#fca5a5]">codebrew@gmail.com</span>.
                  </p>
                </div>

                {/* Success Confirmation Card */}
                {submitResult?.success && (
                  <div className="mb-6 p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 space-y-2 animate-fadeIn">
                    <div className="flex items-center space-x-2 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Support Request Received Successfully!</span>
                    </div>
                    <p className="text-xs leading-relaxed">
                      {submitResult.message}
                    </p>
                    <div className="text-[12px] font-mono pt-1 text-emerald-800 dark:text-emerald-300">
                      Support Request ID: <span className="font-bold underline">{submitResult.ticket_id}</span>
                      {submitResult.category && (
                        <span className="ml-3 px-2 py-0.5 rounded bg-emerald-200/50 dark:bg-emerald-900/60 text-[11px]">
                          Category: {submitResult.category}
                        </span>
                      )}
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setSubmitResult(null)}
                        className="text-xs font-semibold underline text-emerald-700 dark:text-emerald-400 hover:opacity-80 cursor-pointer"
                      >
                        Submit another support query
                      </button>
                    </div>
                  </div>
                )}

                {/* Failure Error Alert Card */}
                {submitResult?.error && (
                  <div className="mb-6 p-5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-500/30 text-red-900 dark:text-red-200 space-y-2 animate-fadeIn">
                    <div className="flex items-center space-x-2 font-bold text-sm">
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
                      <span>Submission Notice</span>
                    </div>
                    <p className="text-xs leading-relaxed">
                      {submitResult.error}
                    </p>
                    <p className="text-xs text-red-800 dark:text-red-300">
                      You can also contact us directly at{' '}
                      <a href="mailto:codebrew@gmail.com" className="underline font-bold text-[#7b2d3b] dark:text-[#fca5a5]">
                        codebrew@gmail.com
                      </a>{' '}
                      or call{' '}
                      <a href="tel:+18005550199" className="underline font-bold text-[#7b2d3b] dark:text-[#fca5a5]">
                        +919231456311
                      </a>.
                    </p>
                  </div>
                )}

                <form onSubmit={handleContactSubmit} className="space-y-5" noValidate>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Full Name */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#1c1815] dark:text-[#f5f5f7]">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (formErrors.fullName) {
                            setFormErrors((prev) => ({ ...prev, fullName: null }));
                          }
                        }}
                        placeholder="e.g. Jane Author"
                        className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-all ${
                          formErrors.fullName
                            ? 'border-red-500 ring-1 ring-red-500'
                            : 'border-[#1c1815]/15 dark:border-white/15 focus:border-[#7b2d3b] focus:ring-1 focus:ring-[#7b2d3b]'
                        } bg-white dark:bg-[#121214] text-[#1c1815] dark:text-[#f5f5f7]`}
                      />
                      {formErrors.fullName && (
                        <p className="text-[11px] text-red-500">{formErrors.fullName}</p>
                      )}
                    </div>

                    {/* Email Address */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#1c1815] dark:text-[#f5f5f7]">
                        Email Address <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (formErrors.email) {
                            setFormErrors((prev) => ({ ...prev, email: null }));
                          }
                        }}
                        placeholder="author@example.com"
                        className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-all ${
                          formErrors.email
                            ? 'border-red-500 ring-1 ring-red-500'
                            : 'border-[#1c1815]/15 dark:border-white/15 focus:border-[#7b2d3b] focus:ring-1 focus:ring-[#7b2d3b]'
                        } bg-white dark:bg-[#121214] text-[#1c1815] dark:text-[#f5f5f7]`}
                      />
                      {formErrors.email && (
                        <p className="text-[11px] text-red-500">{formErrors.email}</p>
                      )}
                    </div>
                  </div>

                  {/* Subject and Issue Category */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Subject */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#1c1815] dark:text-[#f5f5f7]">
                        Subject <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => {
                          setSubject(e.target.value);
                          if (formErrors.subject) {
                            setFormErrors((prev) => ({ ...prev, subject: null }));
                          }
                        }}
                        placeholder="Brief summary of your question or issue..."
                        className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition-all ${
                          formErrors.subject
                            ? 'border-red-500 ring-1 ring-red-500'
                            : 'border-[#1c1815]/15 dark:border-white/15 focus:border-[#7b2d3b] focus:ring-1 focus:ring-[#7b2d3b]'
                        } bg-white dark:bg-[#121214] text-[#1c1815] dark:text-[#f5f5f7]`}
                      />
                      {formErrors.subject && (
                        <p className="text-[11px] text-red-500">{formErrors.subject}</p>
                      )}
                    </div>

                    {/* Issue Category (Account, Login, Manuscript Upload, Technical Issue, General Inquiry, Other) */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#1c1815] dark:text-[#f5f5f7]">
                        Issue Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value);
                          if (formErrors.category) {
                            setFormErrors((prev) => ({ ...prev, category: null }));
                          }
                        }}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#1c1815]/15 dark:border-white/15 bg-white dark:bg-[#121214] text-[#1c1815] dark:text-[#f5f5f7] text-sm focus:border-[#7b2d3b] focus:ring-1 focus:ring-[#7b2d3b]"
                      >
                        <option value="General Inquiry">General Inquiry</option>
                        <option value="Account">Account</option>
                        <option value="Login">Login</option>
                        <option value="Manuscript Upload">Manuscript Upload</option>
                        <option value="Technical Issue">Technical Issue</option>
                        <option value="Other">Other</option>
                      </select>
                      {formErrors.category && (
                        <p className="text-[11px] text-red-500">{formErrors.category}</p>
                      )}
                    </div>
                  </div>

                  {/* Detailed Description of the Problem */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-[#1c1815] dark:text-[#f5f5f7]">
                        Detailed Description of the Problem <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[11px] font-mono-cap text-[#8e8e93]">
                        {description.length} / 5000 chars (min 10)
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        if (formErrors.description) {
                          setFormErrors((prev) => ({ ...prev, description: null }));
                        }
                      }}
                      placeholder="Please explain the issue or question in detail. Include any relevant steps, error messages, or manuscript details to help us assist you quickly..."
                      className={`w-full px-3.5 py-3 rounded-lg border text-sm leading-relaxed transition-all resize-y ${
                        formErrors.description
                          ? 'border-red-500 ring-1 ring-red-500'
                          : 'border-[#1c1815]/15 dark:border-white/15 focus:border-[#7b2d3b] focus:ring-1 focus:ring-[#7b2d3b]'
                      } bg-white dark:bg-[#121214] text-[#1c1815] dark:text-[#f5f5f7]`}
                    />
                    {formErrors.description && (
                      <p className="text-[11px] text-red-500">{formErrors.description}</p>
                    )}
                  </div>

                  {/* Submit Action & Loading State */}
                  <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-2 text-xs text-[#8e8e93]">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Encrypted transmission &bull; Dispatches to codebrew@gmail.com</span>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn btn-solid btn-md text-xs font-semibold shadow-2xs flex items-center justify-center space-x-2 px-6 py-2.5 cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: '#7b2d3b', color: '#ffffff' }}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting Request...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Submit Support Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ========================================================
          PERSISTENT SUPPORT FOOTER (Matching Dashboard & Landing)
          ======================================================== */}
      <footer className="border-t border-[#1c1815]/10 dark:border-white/10 bg-[#f6f6f4] dark:bg-[#161618] py-8 transition-colors mt-auto">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center space-x-2.5">
            <Link
              to={user ? "/dashboard" : "/"}
              className="h-6 w-6 rounded-[6px] bg-[#1c1815] dark:bg-[#f5f5f7] text-white dark:text-[#1c1815] flex items-center justify-center font-bold text-xs tracking-tighter shadow-2xs hover:opacity-90 transition-opacity"
            >
              N
            </Link>
            <span className="text-[13px] font-medium text-[#636366] dark:text-[#8e8e93]">
              NorthStar &bull; AI Continuity Guardian
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-[#8e8e93]">
            <Link to={user ? "/dashboard" : "/auth"} className="hover:text-[#1c1815] dark:hover:text-[#f5f5f7] transition-colors">
              {user ? 'My Workspaces' : 'Author Sign In'}
            </Link>
            <Link to="/support" className="text-[#7b2d3b] dark:text-[#fca5a5] font-semibold">
              Help &amp; Support
            </Link>
            <a href="mailto:codebrew@gmail.com" className="hover:text-[#1c1815] dark:hover:text-[#f5f5f7] transition-colors">
              codebrew@gmail.com
            </a>
            <a href="tel:+18005550199" className="hover:text-[#1c1815] dark:hover:text-[#f5f5f7] transition-colors">
              +919231456311
            </a>
            <span className="text-[#8e8e93]/60">&copy; {new Date().getFullYear()} NorthStar AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
