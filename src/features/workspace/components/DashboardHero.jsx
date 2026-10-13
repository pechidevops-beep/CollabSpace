import React from 'react';
import { useAuth } from '../../../context/AuthContext';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardHero() {
  const { user, profile } = useAuth();
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const greeting = getGreeting();

  return (
    <div className="mb-6 pt-1">
      <h1 className="text-[28px] md:text-[32px] font-semibold text-text-main tracking-tight leading-tight">
        {greeting}, <span className="text-accent">{displayName}</span>
      </h1>
      <p className="mt-1 text-sm text-text-sub leading-normal">
        Here is what is happening in your collaborative workspace today.
      </p>
    </div>
  );
}
