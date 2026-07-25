import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

type AllowedRole = "student" | "lecturer" | "admin";

interface ProtectedRouteProps {
  requiredRole?: AllowedRole;
}

/** Returns the home path for a given role */
export function roleHomePath(role: AllowedRole | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "lecturer") return "/lecturer";
  return "/dashboard";
}

export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading, profileLoading } = useAuth();
  const location = useLocation();

  // Wait for both auth session AND profile to resolve before making role decisions
  if (loading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking session…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user && requiredRole && profile && profile.role !== requiredRole) {
    // Role mismatch: redirect to their appropriate home
    const target = roleHomePath(profile.role as AllowedRole);
    if (location.pathname !== target) {
      return <Navigate to={target} replace />;
    }
  }

  return <Outlet />;
}
