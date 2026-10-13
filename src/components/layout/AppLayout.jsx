import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar, { MobileNavBar } from './Topbar';
import { CommandPalette, useCommandPalette } from '../ui/CommandPalette';

export default function AppLayout() {
  const location = useLocation();
  const cmdPalette = useCommandPalette();

  const isEditorRoute = location.pathname.includes('/editor/');

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-canvas text-text-main">
      {/* Sidebar Icon Rail (Hidden on Editor route) */}
      {!isEditorRoute && <Sidebar onOpenCmd={cmdPalette.open} />}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Topbar (Hidden on Editor route to grant 100% IDE real estate) */}
        {!isEditorRoute && <Topbar onOpenCmd={cmdPalette.open} />}

        {/* Scrollable Main Viewport */}
        <main className={`flex-1 overflow-y-auto custom-scrollbar relative ${isEditorRoute ? 'p-0' : 'p-4 md:p-8 pb-20 md:pb-8'}`}>
          <div className={`${isEditorRoute ? 'h-full w-full' : 'mx-auto max-w-6xl min-h-full'}`}>
            <Outlet />
          </div>
        </main>

        {/* Mobile Navigation Bar */}
        {!isEditorRoute && <MobileNavBar />}
      </div>

      {/* Global Command Palette */}
      <CommandPalette isOpen={cmdPalette.isOpen} onClose={cmdPalette.close} />
    </div>
  );
}
