import React from 'react';
import { Link } from 'react-router-dom';
import { HeroGeometric } from '../components/ui/shape-landing-hero';

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#030303] text-slate-50">
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 z-20">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-600 to-brand-400 text-sm font-bold">
            CS
          </div>
          <span className="text-sm font-semibold tracking-tight">CollabSpace</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            to="/auth/login"
            className="text-slate-300 hover:text-slate-50"
          >
            Login
          </Link>
          <Link
            to="/auth/signup"
            className="button-glow rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-600"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-12 pt-2">
        <div className="w-full max-w-3xl">
          <HeroGeometric
            badge="CollabSpace"
            title1="One workspace for"
            title2="Code, Assessments & Collaboration"
          />
        </div>
      </main>
    </div>
  );
}
