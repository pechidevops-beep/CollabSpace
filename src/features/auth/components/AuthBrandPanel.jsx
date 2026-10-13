import React from 'react';

export function AuthBrandPanel() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between w-1/2 p-12 bg-surface border-r border-border-dim overflow-hidden select-none">
      {/* Background glow accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand/5 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-brand/5 blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-text-main text-canvas flex items-center justify-center font-bold text-sm tracking-tighter shadow-sm">
            CS
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-text-main tracking-tight">CollabSpace</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-subtle border border-border-dim text-text-dim">
              v2.0
            </span>
          </div>
        </div>
      </div>

      {/* Hero statement and Mockup */}
      <div className="relative z-10 my-auto py-8">
        <div className="max-w-md mb-8">
          <p className="text-xs font-semibold tracking-wider uppercase text-text-dim mb-2">
            Cloud Collaborative Workspace
          </p>
          <h2 className="text-2xl font-semibold text-text-main tracking-tight leading-snug">
            Real-time code collaboration, assessments, and cloud execution in one place.
          </h2>
        </div>

        {/* Real Product Mockup (Editor UI) */}
        <div className="w-full rounded-xl bg-canvas border border-border-subtle shadow-2xl overflow-hidden font-mono text-xs">
          {/* Window Chrome */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-surface border-b border-border-dim">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]/90 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]/90 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]/90 inline-block" />
            </div>

            {/* Active Tabs */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-canvas border border-border-dim text-text-main text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                <span>quicksort.ts</span>
                <span className="text-text-dim text-[10px]">×</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-text-dim text-[11px] hover:text-text-sub">
                <span>tests.spec.ts</span>
              </div>
            </div>

            {/* Live Presence */}
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 text-[9px] font-sans font-medium flex items-center justify-center">
                  AK
                </span>
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[9px] font-sans font-medium flex items-center justify-center">
                  SJ
                </span>
              </div>
              <span className="text-[10px] text-text-dim font-sans font-medium">2 live</span>
            </div>
          </div>

          {/* Code Body */}
          <div className="p-3.5 space-y-1 bg-canvas/90 text-[11px] leading-5 text-text-sub overflow-x-hidden">
            <div className="flex items-center gap-3">
              <span className="text-text-dim/60 select-none w-4 text-right">1</span>
              <span className="text-text-dim italic">// In-place collaborative quicksort</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-dim/60 select-none w-4 text-right">2</span>
              <span>
                <span className="text-purple-400">export function</span>{' '}
                <span className="text-blue-400">quickSort</span>
                <span className="text-text-main">(arr: number[]): number[] {'{'}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-dim/60 select-none w-4 text-right">3</span>
              <span className="pl-3">
                <span className="text-purple-400">if</span> (arr.length &lt;={' '}
                <span className="text-amber-400">1</span>) <span className="text-purple-400">return</span> arr;
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-dim/60 select-none w-4 text-right">4</span>
              <span className="pl-3">
                <span className="text-purple-400">const</span> pivot = arr[arr.length -{' '}
                <span className="text-amber-400">1</span>];
              </span>
            </div>
            <div className="flex items-center gap-3 relative">
              <span className="text-text-dim/60 select-none w-4 text-right">5</span>
              <span className="pl-3">
                <span className="text-purple-400">const</span> left: number[] = [];
              </span>
              {/* Collaborative Cursor */}
              <div className="absolute right-8 top-0 flex items-center gap-1 pointer-events-none">
                <span className="w-0.5 h-4 bg-brand animate-pulse inline-block" />
                <span className="px-1.5 py-0.5 rounded bg-brand text-brand-fg text-[9px] font-sans font-medium">
                  Sarah K.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-dim/60 select-none w-4 text-right">6</span>
              <span className="pl-3">
                <span className="text-purple-400">const</span> right: number[] = [];
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-dim/60 select-none w-4 text-right">7</span>
              <span className="pl-3">
                <span className="text-purple-400">for</span> (<span className="text-purple-400">let</span> i ={' '}
                <span className="text-amber-400">0</span>; i &lt; arr.length -{' '}
                <span className="text-amber-400">1</span>; i++) {'{'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-dim/60 select-none w-4 text-right">8</span>
              <span className="pl-6">
                <span className="text-purple-400">if</span> (arr[i] &lt; pivot) left.push(arr[i]);
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-dim/60 select-none w-4 text-right">9</span>
              <span className="pl-6">
                <span className="text-purple-400">else</span> right.push(arr[i]);
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-dim/60 select-none w-4 text-right">10</span>
              <span className="pl-3">{'}'}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-dim/60 select-none w-4 text-right">11</span>
              <span className="pl-3">
                <span className="text-purple-400">return</span> [...quickSort(left), pivot, ...quickSort(right)];
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-text-dim/60 select-none w-4 text-right">12</span>
              <span>{'}'}</span>
            </div>
          </div>

          {/* Mini Terminal Output */}
          <div className="bg-surface/90 border-t border-border-dim p-2.5 text-[10px]">
            <div className="flex items-center justify-between pb-1.5 border-b border-border-dim/60 text-text-dim">
              <div className="flex items-center gap-2">
                <span className="text-text-main font-medium">Terminal</span>
                <span>•</span>
                <span>Isolated Sandbox</span>
              </div>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Exit code 0
              </span>
            </div>
            <div className="pt-2 text-text-sub space-y-0.5">
              <div className="text-emerald-400 font-medium">
                ✓ quicksort.spec.ts (14 test cases passed in 42ms)
              </div>
              <div className="text-text-dim">
                Sandbox execution completed. Zero memory leaks detected.
              </div>
            </div>
          </div>
        </div>

        {/* Feature Pills */}
        <div className="mt-6 flex flex-wrap gap-2 text-[11px] text-text-sub">
          <span className="px-2.5 py-1 rounded-full bg-subtle border border-border-dim">
            Monaco Editor
          </span>
          <span className="px-2.5 py-1 rounded-full bg-subtle border border-border-dim">
            Multi-file Workspaces
          </span>
          <span className="px-2.5 py-1 rounded-full bg-subtle border border-border-dim">
            Automated Grading
          </span>
        </div>
      </div>

      {/* Footer info */}
      <div className="relative z-10 flex items-center justify-between text-xs text-text-dim pt-4 border-t border-border-dim">
        <span>Protected by enterprise-grade isolation</span>
        <span>SOC 2 Type II Certified</span>
      </div>
    </div>
  );
}

export default AuthBrandPanel;
