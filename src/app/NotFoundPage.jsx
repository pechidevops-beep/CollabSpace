import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center text-slate-50">
      <h1 className="text-3xl font-semibold">404</h1>
      <p className="mt-2 text-sm text-slate-400">
        The page you are looking for could not be found.
      </p>
      <div className="mt-4 flex gap-3 text-xs">
        <Link
          to="/"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-slate-100 hover:bg-slate-800"
        >
          Back to landing
        </Link>
        <Link
          to="/app"
          className="rounded-md bg-brand-500 px-3 py-1.5 text-white hover:bg-brand-600"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
