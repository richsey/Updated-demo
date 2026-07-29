import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Register() {
  const navigate = useNavigate();
  const { signUp, verifyEmailCode } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

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
      setError(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setIsVerifying(true);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await verifyEmailCode(email, code);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Success! Redirect to login or auto-login
    navigate("/login");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 20% 10%, hsl(204 80% 88% / 0.70) 0%, transparent 60%), " +
          "radial-gradient(ellipse 70% 50% at 80% 80%, hsl(199 70% 82% / 0.55) 0%, transparent 60%), " +
          "radial-gradient(ellipse 50% 40% at 60% 10%, hsl(210 60% 90% / 0.50) 0%, transparent 55%), " +
          "linear-gradient(160deg, #ffffff 0%, #e8f4fd 60%, #d0e9f7 100%)",
      }}
    >
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-sky-200/80 bg-white/90 backdrop-blur-sm p-8 shadow-xl">
        {/* Heading */}
        {/* Heading */}
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold font-display">
            {isVerifying ? "Verify Email" : "Sign Up"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isVerifying ? (
              <>Enter the 6-digit code sent to {email}</>
            ) : (
              <>
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {isVerifying ? (
          <form onSubmit={handleVerify} className="space-y-4">
            <input
              id="code"
              type="text"
              placeholder="6-digit Verification Code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              disabled={loading}
              className="w-full h-11 rounded-xl bg-secondary/50 border border-border/60 px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-50 text-center tracking-[0.2em] font-mono text-lg"
              maxLength={6}
            />

            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full h-11 gradient-primary border-0 glow-sm text-white font-semibold hover:opacity-90 transition-opacity"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>Verify Account <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </form>
        ) : (
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Verification Code...
                </>
              ) : (
                <>
                  Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}