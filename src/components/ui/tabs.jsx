import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

// Lightweight tab model: { title, value, content }
export function Tabs({
  tabs: propTabs,
  containerClassName,
  activeTabClassName,
  tabClassName,
  contentClassName,
}) {
  const [active, setActive] = useState(propTabs[0]);
  const [tabs, setTabs] = useState(propTabs);
  const [hovering, setHovering] = useState(false);

  const moveSelectedTabToTop = (idx) => {
    const newTabs = [...propTabs];
    const selectedTab = newTabs.splice(idx, 1);
    newTabs.unshift(selectedTab[0]);
    setTabs(newTabs);
    setActive(newTabs[0]);
  };

  return (
    <>
      <div
        className={cn(
          'flex flex-row items-center justify-start [perspective:1000px] relative overflow-auto sm:overflow-visible no-visible-scrollbar max-w-full w-full',
          containerClassName,
        )}
      >
        {propTabs.map((tab, idx) => (
          <button
            key={tab.title}
            type="button"
            onClick={() => {
              moveSelectedTabToTop(idx);
            }}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            className={cn('relative px-4 py-2 rounded-full', tabClassName)}
            style={{
              transformStyle: 'preserve-3d',
            }}
          >
            {active.value === tab.value && (
              <motion.div
                layoutId="clickedbutton"
                transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
                className={cn(
                  'absolute inset-0 bg-slate-200/90 dark:bg-zinc-800 rounded-full',
                  activeTabClassName,
                )}
              />
            )}

            <span className="relative block text-slate-900 dark:text-slate-50 text-xs md:text-sm">
              {tab.title}
            </span>
          </button>
        ))}
      </div>
      <FadeInDiv
        tabs={tabs}
        // active is not strictly needed by the animation logic but kept for API parity
        active={active}
        hovering={hovering}
        className={cn('mt-10 md:mt-16', contentClassName)}
      />
    </>
  );
}

export function FadeInDiv({ className, tabs, hovering }) {
  const isActive = (tab) => {
    if (!tabs || tabs.length === 0) return false;
    return tab.value === tabs[0].value;
  };

  return (
    <div className="relative w-full h-full">
      {tabs.map((tab, idx) => (
        <motion.div
          key={tab.value}
          layoutId={tab.value}
          style={{
            scale: 1 - idx * 0.1,
            top: hovering ? idx * -40 : 0,
            zIndex: -idx,
            opacity: idx < 3 ? 1 - idx * 0.1 : 0,
          }}
          animate={{
            y: isActive(tab) ? [0, 24, 0] : 0,
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('w-full h-full absolute top-0 left-0', className)}
        >
          {tab.content}
        </motion.div>
      ))}
    </div>
  );
}


