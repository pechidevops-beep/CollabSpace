import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Link } from "react-router-dom";
import NotificationBell from "@/components/NotificationBell";

const AppLayout = () => {
  return (
    <div className="dark">
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 flex items-center gap-3 border-b border-border px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-30">
              <SidebarTrigger className="shrink-0" />
              <Link to="/dashboard" className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  alt="CollabSpace Logo"
                  className="h-7 w-7 object-contain rounded-md"
                  onError={(e) => {
                    // Fallback: hide img and show emoji
                    e.currentTarget.style.display = "none";
                  }}
                />
                <span className="font-semibold text-sm text-foreground">CollabSpace</span>
              </Link>
              <div className="flex-1" />
              <NotificationBell />
            </header>
            <main className="flex-1 p-4 md:p-6 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
};

export default AppLayout;
