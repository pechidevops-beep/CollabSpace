import React from 'react';
import Skeleton from '../../../components/ui/Skeleton';
import EmptyState from '../../../components/ui/EmptyState';
import { Activity } from 'lucide-react';

function formatActivityTime(dateString) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;

    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}

export default function ActivityFeed({ items = [], loading = false, error = '', resolveMessage }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex gap-3 items-center py-2">
            <Skeleton className="h-2 w-2 rounded-full shrink-0" />
            <Skeleton className="h-4 w-full rounded-[6px]" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-[10px] border border-semantic-danger/20 bg-semantic-danger/10 text-semantic-danger text-xs">
        {error}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="py-8 text-center text-xs text-text-dim">
        No recent workspace activity yet.
      </div>
    );
  }

  return (
    <div className="relative pl-3 space-y-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[1px] before:bg-border-dim">
      {items.map((item) => (
        <div key={item.id} className="relative pl-4 text-xs group">
          <div className="absolute -left-[11px] top-1.5 h-2 w-2 rounded-full bg-accent ring-4 ring-canvas" />
          <div className="text-text-main font-medium leading-relaxed">
            {resolveMessage ? resolveMessage(item) : item.message}
          </div>
          <div className="text-[11px] text-text-dim mt-0.5">
            {formatActivityTime(item.created_at)}
          </div>
        </div>
      ))}
    </div>
  );
}
