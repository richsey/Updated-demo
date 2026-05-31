import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Brain,
  ArrowRight,
  Zap,
  BarChart3,
  Target,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const perks = [
  { icon: Zap, text: "Adaptive learning paths" },
  { icon: BarChart3, text: "Real engagement tracking" },
  { icon: Target, text: "Personalized recommendations" },
];

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

    // Navigate based on role; fall back to email heuristic if profile not yet loaded
    if (signedInProfile?.role === "admin" || email.toLowerCase().includes("admin")) {
      navigate("/admin");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden gradient-hero flex-col justify-between p-12">
        <div className="absolute inset-0 mesh-bg opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/15 rounded-full blur-[80px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-[80px]" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary glow-sm">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold font-display gradient-text">
              AI Learning Guide
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div className="space-y-3">
            <h2 className="text-4xl font-extrabold font-display leading-tight">
              Master any skill with{" "}
              <span className="gradient-text">AI precision</span>
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              The platform that learns how <em>you</em> learn — and adapts every
              recommendation accordingly.
            </p>
          </div>
          <div className="space-y-3">
            {perks.map((p) => (
              <div
                key={p.text}
                className="flex items-center gap-3 glass rounded-xl px-4 py-3"
              >
                <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary/20 text-primary flex-shrink-0">
                  <p.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{p.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-muted-foreground">
          © 2026 AI Learning Guide — Built for serious learners.
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold font-display gradient-text">
              AI Learning Guide
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold font-display">Welcome back</h1>
            <p className="text-muted-foreground">
              Sign in to continue your learning journey
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-11 bg-secondary/50 border-border/60 focus:border-primary/60 focus:ring-primary/20 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-11 bg-secondary/50 border-border/60 focus:border-primary/60 focus:ring-primary/20 transition-colors"
              />
            </div>

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

          <div className="space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Create one free
              </Link>
            </p>
            <div className="glass rounded-xl px-4 py-3 text-xs text-muted-foreground">
              💡 Use <code className="text-primary font-mono">admin@</code> in
              your email to access the admin dashboard
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
