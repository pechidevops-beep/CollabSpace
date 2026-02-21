import React from 'react';
import Skeleton from '../../../components/ui/Skeleton';

export default function ActivityFeed({ items = [], loading = false, error = '', resolveMessage }) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-10 w-full rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-slate-500 text-sm">{error}</p>;
  }

  if (!items.length) {
    return <p className="text-slate-500 text-sm">No recent activity found.</p>;
  }

  return (
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.id} className="activity-item relative pl-4 border-l border-slate-800">
          <div className="absolute -left-1 top-1.5 w-2 h-2 rounded-full bg-brand-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
          <p className="text-sm text-slate-200 leading-snug">
            {resolveMessage ? resolveMessage(item) : item.message}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {new Date(item.created_at).toLocaleDateString()} at{' '}
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      ))}
    </div>
  );
}
