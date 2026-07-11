import { Outlet, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { StudentSidebar } from "@/components/StudentSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePrefetchCriticalData } from "@/hooks/useSupabaseQuery";
import { useTelemetry } from "@/hooks/useTelemetry";
import { ActiveTimeContext } from "@/contexts/ActiveTimeContext";
import { UserProfileModal } from "@/components/UserProfileModal";

export default function StudentLayout() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { prefetch } = usePrefetchCriticalData();
  // ── Global session-wide time tracker ───────────────────────────
  const telemetry = useTelemetry({ endpoint: "/api/telemetry" });

  // Prefetch critical data once on layout mount (after auth resolves)
  useEffect(() => {
    prefetch();
  }, [prefetch]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <ActiveTimeContext.Provider value={{ activeTimeMs: telemetry.activeTimeMs, isActive: telemetry.isActive }}>
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <StudentSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-4">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="mr-2" />
              <span className="text-sm text-muted-foreground font-display">
                Student Portal
              </span>
            </div>
            <div className="flex items-center gap-3">
              {profile && (
                <UserProfileModal
                  trigger={
                    <button className="flex items-center gap-2 px-2.5 py-1 rounded-full hover:bg-muted/40 transition-all text-xs font-semibold text-muted-foreground hover:text-foreground border border-transparent hover:border-border/40">
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                        {profile.full_name ? profile.full_name[0].toUpperCase() : "U"}
                      </div>
                      <span className="hidden sm:inline">{profile.full_name}</span>
                    </button>
                  }
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-muted-foreground hover:text-foreground gap-2"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
    </ActiveTimeContext.Provider>
  );
}
