import React, { useId } from 'react';
import { motion } from 'framer-motion';

export function Tabs({
  tabs = [],
  activeTab,
  onChange,
  variant = 'pill',
  className = '',
  tabClassName = '',
}) {
  const instanceId = useId().replace(/:/g, '');

  return (
    <div
      role="tablist"
      aria-label="Tabs"
      className={`inline-flex items-center gap-1 p-1 rounded-md ${
        variant === 'pill' ? 'bg-subtle border border-border-dim' : 'border-b border-border-dim p-0 rounded-none w-full'
      } ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${instanceId}-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`panel-${instanceId}-${tab.id}`}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium transition-colors select-none z-10
              ${variant === 'pill' ? 'rounded-sm' : 'border-b-2 border-transparent pb-2.5 px-4'}
              ${isActive ? 'text-text-main font-semibold' : 'text-text-sub hover:text-text-main'}
              ${tabClassName}`}
          >
            {isActive && variant === 'pill' && (
              <motion.div
                layoutId={`active-pill-${instanceId}`}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="absolute inset-0 bg-surface rounded-sm border border-border-dim shadow-subtle -z-10"
              />
            )}

            {isActive && variant === 'underline' && (
              <motion.div
                layoutId={`active-underline-${instanceId}`}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand -z-10"
              />
            )}

            {Icon && <Icon size={14} className="shrink-0" />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span
                className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-brand/10 text-brand' : 'bg-surface text-text-dim'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, activeTab, children, className = '' }) {
  if (activeTab !== id) return null;

  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      className={`pt-4 animate-fadeIn ${className}`}
    >
      {children}
    </div>
  );
}

export default Tabs;
