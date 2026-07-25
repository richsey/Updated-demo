import { Outlet, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { UserProfileModal } from "@/components/UserProfileModal";
import { LogOut, ChevronDown } from "lucide-react";

export default function AdminLayout() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    : "A";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-secondary">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-white px-4 shadow-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="mr-2" />
              <span className="text-sm text-muted-foreground font-display">Admin Portal</span>
            </div>

            {/* Profile dropdown */}
            {profile && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex items-center gap-2 px-2.5 py-1 rounded-full hover:bg-muted/40 transition-all text-xs font-semibold text-muted-foreground hover:text-foreground border border-transparent hover:border-border/40"
                >
                  <div className="h-6 w-6 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold text-xs">
                    {initials}
                  </div>
                  <span className="hidden sm:inline">{profile.full_name}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border/60 bg-white shadow-lg z-50 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2.5">
                      <UserProfileModal
                        trigger={
                          <button className="flex w-full items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors">
                            <div className="h-4 w-4 rounded-full bg-accent/15 text-accent flex items-center justify-center font-bold text-[10px]">
                              {initials}
                            </div>
                            View Profile
                          </button>
                        }
                      />
                    </div>
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
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
