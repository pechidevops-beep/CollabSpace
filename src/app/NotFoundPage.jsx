import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 text-center text-text-main animate-fade-up">
      <h1 className="text-4xl font-bold tracking-tight text-text-main">404</h1>
      <p className="mt-2 text-xs text-text-sub">
        The page you are looking for could not be found.
      </p>
      <div className="mt-5 flex items-center gap-3">
        <Link to="/">
          <Button variant="secondary" size="sm">
            Back to Home
          </Button>
        </Link>
        <Link to="/app">
          <Button variant="primary" size="sm">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
