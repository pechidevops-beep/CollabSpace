import React from 'react';

// Lightweight tab implementation for demo purposes

export default function WorkspaceTabsDemo() {
  const [activeTab, setActiveTab] = React.useState('overview');

  return (
    <div className="w-full">
      <div className="flex space-x-1 rounded-xl bg-slate-900/20 p-1 mb-4">
        {['Overview', 'Activity', 'Settings'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase())}
            className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 ring-white/60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2 ${activeTab === tab.toLowerCase()
              ? 'bg-white text-slate-900 shadow'
              : 'text-slate-100 hover:bg-white/[0.12] hover:text-white'
              }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="rounded-xl bg-slate-900/40 p-3">
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <div className="h-24 rounded-lg bg-slate-800/50 animate-pulse" />
            <div className="h-24 rounded-lg bg-slate-800/50 animate-pulse" />
          </div>
        )}
        {activeTab === 'activity' && <p className="text-slate-400">Activity content placeholder</p>}
        {activeTab === 'settings' && <p className="text-slate-400">Settings content placeholder</p>}
      </div>
    </div>
  );
}

