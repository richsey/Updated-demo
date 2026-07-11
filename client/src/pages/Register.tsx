import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, name);

    if (error) {
      if (error.message === "REGISTRATION_SUCCESS_CONFIRM_EMAIL") {
        setError(
          `Account created! PLEASE CHECK YOUR EMAIL (${email}) to confirm before signing in.`,
        );
      } else if (error.message.includes("User already exists")) {
        setError(
          "Account already exists! Please click 'Sign in' below to continue.",
        );
      } else {
        setError(error.message);
      }
      setLoading(false);
      return;
    }

    navigate("/dashboard");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 20% 20%, hsl(var(--primary) / 0.25) 0%, transparent 60%), " +
          "radial-gradient(ellipse 70% 50% at 80% 80%, hsl(var(--accent) / 0.18) 0%, transparent 60%), " +
          "radial-gradient(ellipse 50% 40% at 60% 10%, hsl(var(--primary) / 0.12) 0%, transparent 55%), " +
          "hsl(var(--background))",
      }}
    >
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 shadow-xl">
        {/* Heading */}
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold font-display">Sign Up</h1>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Sign in
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
            id="name"
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
            className="w-full h-11 rounded-xl bg-secondary/50 border border-border/60 px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-50"
          />
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
          <input
            id="password"
            type="password"
            placeholder="Password (min. 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
            className="w-full h-11 rounded-xl bg-secondary/50 border border-border/60 px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-50"
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 gradient-primary border-0 glow-sm text-white font-semibold hover:opacity-90 transition-opacity"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account…
              </>
            ) : (
              <>
                Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}