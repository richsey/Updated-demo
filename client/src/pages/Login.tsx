import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { roleHomePath } from "@/components/ProtectedRoute";
import { PasswordInput } from "@/components/ui/PasswordInput";

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error, profile: signedInProfile } = await signIn(email, password);

    if (error) {
      if (error.message === "USER_NOT_FOUND") {
        setError(
          "Account not found. Would you like to create one? Click 'Create one free' below.",
        );
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    // Navigate to the correct home for their role
    const destination = roleHomePath(signedInProfile?.role ?? "student");
    navigate(destination);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 gradient-hero">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold font-display">Sign In</h1>
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Create one free
            </Link>
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="w-full h-11 rounded-xl bg-secondary/50 border border-border/60 px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-50"
          />
          <PasswordInput
            id="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 gradient-primary border-0 glow-sm text-white font-semibold hover:opacity-90 transition-opacity"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
              </>
            ) : (
              <>
                Sign In <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
