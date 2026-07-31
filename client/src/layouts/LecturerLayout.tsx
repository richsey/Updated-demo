import { Outlet, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { LecturerSidebar } from "@/components/LecturerSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { usePrefetchCriticalData } from "@/hooks/useSupabaseQuery";
import { User, LogOut, ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LecturerLayout() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const { prefetch } = usePrefetchCriticalData();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    prefetch();
  }, [prefetch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await signOut();
    navigate("/login");
  };

  const initials = profile?.full_name
    ? profile.full_name[0].toUpperCase()
    : "L";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-secondary">
        <LecturerSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-background px-4 shadow-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="mr-2" />
              <span className="text-sm text-muted-foreground font-display">
                Lecturer Portal
              </span>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {/* Profile dropdown */}
              {profile && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-full hover:bg-muted/40 transition-all text-xs font-semibold text-muted-foreground hover:text-foreground border border-transparent hover:border-border/40"
                  >
                    <div className="h-6 w-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                      {initials}
                    </div>
                    <span className="hidden sm:inline text-foreground/80">
                      {profile.full_name}
                    </span>
                    <span className="hidden sm:inline text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                      Lecturer
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 mt-2 w-44 rounded-xl border border-border/60 bg-background shadow-lg z-50 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-150">
                      <Link
                        to="/lecturer/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        View Profile
                      </Link>
                      <div className="h-px bg-border/60 mx-2" />
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
