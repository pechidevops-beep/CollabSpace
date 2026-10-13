import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import ThemeToggle from '../components/ui/ThemeToggle';
import Card from '../components/ui/Card';
import {
  Code2,
  FolderGit2,
  Terminal,
  BookOpen,
  Users,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

const chapters = [
  {
    id: 'repositories',
    name: 'Repositories',
    title: 'Git repositories built for collaboration',
    description:
      'Manage codebases, branch workflows, and team access with instant workspace synchronization.',
    image: '/screens/repositories.png',
    icon: FolderGit2,
    badge: 'Code Collaboration',
  },
  {
    id: 'assessments',
    name: 'Assessments',
    title: 'Automated coding assessments',
    description:
      'Design automated problem sets, test runners, and student progress metrics without leaving your workspace.',
    image: '/screens/assessments.png',
    icon: BookOpen,
    badge: 'Curriculum & Grading',
  },
  {
    id: 'editor',
    name: 'Editor',
    title: 'Browser-native IDE and code execution',
    description:
      'Edit, compile, and execute Python, JavaScript, and C++ directly with live terminal diagnostics.',
    image: '/screens/editor.png',
    icon: Terminal,
    badge: 'Monaco Environment',
  },
];

const bentoFeatures = [
  {
    icon: Layers,
    title: 'Multi-Workspace Architecture',
    description:
      'Isolate teams, classrooms, or hackathon squads into independent collaborative spaces with customized roles.',
  },
  {
    icon: Terminal,
    title: 'Live Containerized Execution',
    description:
      'Execute code directly in the browser with real-time compilation output, exit codes, and memory statistics.',
  },
  {
    icon: BookOpen,
    title: 'Structured Problem Harnesses',
    description:
      'Publish coding assignments with starter templates, automated test suites, and deadline enforcement.',
  },
  {
    icon: FolderGit2,
    title: 'Branch-Aware Version Control',
    description:
      'Track commits, switch branches, and view file changes with a fast, keyboard-first Monaco code editor.',
  },
  {
    icon: Users,
    title: 'Granular Team Permissions',
    description:
      'Assign Owner or Contributor roles, generate secure invite codes, and manage collaborator rosters easily.',
  },
];

export default function LandingPage() {
  const mockupRef = useRef(null);
  const pinnedSectionRef = useRef(null);
  const [activeChapter, setActiveChapter] = useState(0);

  useEffect(() => {
    let ctx;
    const initScrollAnimations = async () => {
      try {
        const { gsap } = await import('gsap');
        const { ScrollTrigger } = await import('gsap/ScrollTrigger');
        gsap.registerPlugin(ScrollTrigger);

        ctx = gsap.context(() => {
          // Perspective tilt flattening on scroll
          if (mockupRef.current) {
            gsap.fromTo(
              mockupRef.current,
              { rotateX: 12, scale: 0.94, transformPerspective: 1200 },
              {
                rotateX: 0,
                scale: 1,
                ease: 'power1.out',
                scrollTrigger: {
                  trigger: mockupRef.current,
                  start: 'top 85%',
                  end: 'top 35%',
                  scrub: true,
                },
              }
            );
          }

          // Pinned scroll chapters (only on desktop to avoid blank scroll traps on mobile)
          if (pinnedSectionRef.current && window.innerWidth >= 768) {
            ScrollTrigger.create({
              trigger: pinnedSectionRef.current,
              start: 'top top',
              end: '+=900',
              pin: true,
              scrub: 0.5,
              onUpdate: (self) => {
                const step = Math.min(
                  chapters.length - 1,
                  Math.floor(self.progress * chapters.length)
                );
                setActiveChapter(step);
              },
            });
          }
        });
      } catch (err) {
        console.warn('GSAP ScrollTrigger lazy initialization skipped:', err);
      }
    };

    initScrollAnimations();

    return () => {
      ctx?.revert();
    };
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-text-main selection:bg-accent/20 relative select-none overflow-x-hidden">
      {/* Soft Ambient Radial Glow */}
      <div className="page-accent-glow" aria-hidden="true" />

      {/* Sticky Blurred Nav */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-canvas/80 border-b border-border-subtle">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-on-accent shadow-sm group-hover:scale-105 transition-transform">
              <Code2 size={19} />
            </div>
            <span className="text-sm font-semibold tracking-tight text-text-main">
              CollabSpace
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs text-text-sub font-medium">
            <a href="#chapters" className="hover:text-text-main transition-colors">
              Platform
            </a>
            <a href="#features" className="hover:text-text-main transition-colors">
              Features
            </a>
            <Link to="/app/dashboard" className="hover:text-text-main transition-colors">
              Workspaces
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle size="sm" />
            <Link
              to="/auth/login"
              className="text-xs font-medium text-text-sub hover:text-text-main px-2.5 py-1.5 transition-colors"
            >
              Sign in
            </Link>
            <Link to="/auth/signup">
              <Button variant="primary" size="sm" magnetic={true}>
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-20 pb-16 text-center max-w-5xl mx-auto">
        {/* Subtle pill tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/5 dark:bg-white/6 border border-border-subtle text-[11px] font-medium text-text-sub mb-6">
          <Sparkles size={13} className="text-accent" />
          <span>Next-generation workspace for code and education</span>
        </div>

        {/* Hero headline with allowed white-to-60% gradient */}
        <h1
          className="font-semibold tracking-[-0.04em] leading-[1.05] mx-auto max-w-4xl bg-gradient-to-b from-text-main to-text-main/60 bg-clip-text text-transparent"
          style={{ fontSize: 'clamp(48px, 8vw, 96px)' }}
        >
          One workspace for code, assessments and collaboration.
        </h1>

        {/* Single line of subcopy */}
        <p className="mt-6 text-base sm:text-lg text-text-sub max-w-2xl mx-auto leading-relaxed">
          Unified code repositories, automated assessments, and real-time execution in one workspace.
        </p>

        {/* Two CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/auth/signup">
            <Button
              variant="primary"
              size="lg"
              magnetic={true}
              iconRight={ArrowRight}
              className="w-full sm:w-auto px-6 h-11"
            >
              Start collaborating
            </Button>
          </Link>
          <Link to="/auth/login">
            <Button
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto px-6 h-11"
            >
              Explore workspaces
            </Button>
          </Link>
        </div>

        {/* Under Hero: Framed perspective mockup */}
        <div className="mt-16 sm:mt-20 max-w-5xl mx-auto perspective-1000">
          <div
            ref={mockupRef}
            className="rounded-2xl border border-border-subtle bg-surface p-2 shadow-2xl transition-transform duration-200"
          >
            {/* Window chrome header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-semantic-danger/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-semantic-warning/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-semantic-success/60" />
              </div>
              <div className="text-[11px] text-text-dim font-mono">
                collabspace.app/workspace/editor/main.py
              </div>
              <div className="w-12" />
            </div>

            <div className="rounded-[10px] overflow-hidden bg-canvas aspect-[16/9] border border-border-subtle">
              <img
                src="/screens/editor.png"
                alt="CollabSpace Code Editor and Workspace"
                className="w-full h-full object-cover object-top"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pinned Scroll Chapters (Repositories / Assessments / Editor) */}
      <section
        id="chapters"
        ref={pinnedSectionRef}
        className="relative min-h-screen py-20 px-6 flex items-center justify-center bg-canvas"
      >
        <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Chapter Text Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-black/5 dark:bg-white/6 border border-border-subtle text-[11px] font-semibold text-accent uppercase tracking-wider">
              {chapters[activeChapter].badge}
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-text-main leading-tight transition-all duration-200">
                {chapters[activeChapter].title}
              </h2>
              <p className="text-sm text-text-sub leading-relaxed">
                {chapters[activeChapter].description}
              </p>
            </div>

            {/* Chapter Step Indicators */}
            <div className="flex items-center gap-2 pt-4">
              {chapters.map((ch, idx) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveChapter(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-xs font-medium transition-all ${
                    activeChapter === idx
                      ? 'bg-surface text-text-main border border-border-strong shadow-sm'
                      : 'text-text-dim hover:text-text-sub border border-transparent'
                  }`}
                >
                  <ch.icon size={14} className={activeChapter === idx ? 'text-accent' : ''} />
                  <span>{ch.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chapter Mockup Column (7 cols) with Crossfading Screenshot */}
          <div className="lg:col-span-7">
            <div className="card-signature p-2.5 shadow-2xl relative">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border-subtle mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-border-strong" />
                  <span className="w-2 h-2 rounded-full bg-border-strong" />
                  <span className="w-2 h-2 rounded-full bg-border-strong" />
                </div>
                <span className="text-[10px] text-text-dim font-mono">
                  {chapters[activeChapter].id}.collabspace
                </span>
                <div className="w-8" />
              </div>

              <div className="relative aspect-[16/10] rounded-[10px] overflow-hidden bg-subtle border border-border-subtle">
                {chapters.map((ch, idx) => (
                  <img
                    key={ch.id}
                    src={ch.image}
                    alt={ch.title}
                    className={`absolute inset-0 w-full h-full object-cover object-top transition-opacity duration-300 ${
                      activeChapter === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6-Tile Bento of Real Features */}
      <section id="features" className="py-24 px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-main">
            Engineered for real engineering teams.
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-text-sub">
            Everything you need to write code, review assignments, and execute workflows without third-party plugins.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {bentoFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <Card
                key={feat.title}
                spotlight={true}
                className={`p-6 flex flex-col justify-between ${
                  idx === 0 ? 'lg:col-span-2' : 'lg:col-span-1'
                }`}
              >
                <div>
                  <div className="h-10 w-10 rounded-[10px] bg-black/5 dark:bg-white/6 flex items-center justify-center text-accent mb-4">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-sm font-semibold text-text-main tracking-tight">
                    {feat.title}
                  </h3>
                  <p className="mt-2 text-xs text-text-sub leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 text-center max-w-4xl mx-auto border-t border-border-subtle">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-main">
          Ready to experience CollabSpace?
        </h2>
        <p className="mt-2 text-sm text-text-sub max-w-md mx-auto">
          Create an account in seconds. Build repositories, run assignments, and collaborate seamlessly.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/auth/signup">
            <Button variant="primary" size="md" magnetic={true} iconRight={ArrowRight}>
              Get started for free
            </Button>
          </Link>
          <Link to="/auth/login">
            <Button variant="secondary" size="md">
              Sign in to workspace
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-10 px-6 bg-surface/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-dim">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-[6px] bg-accent text-on-accent flex items-center justify-center text-[10px] font-bold">
              CS
            </div>
            <span className="font-semibold text-text-main">CollabSpace</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#chapters" className="hover:text-text-main transition-colors">
              Platform
            </a>
            <a href="#features" className="hover:text-text-main transition-colors">
              Features
            </a>
            <Link to="/auth/login" className="hover:text-text-main transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
