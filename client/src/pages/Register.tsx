import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { PasswordStrength, isPasswordValid } from "@/components/ui/PasswordStrength";

export default function Register() {
  const navigate = useNavigate();
  const { signUp } = useAuth(); // verifyEmailCode removed — email verification not active yet
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // --- EMAIL VERIFICATION STATE (commented out — not in use yet) ---
  // const [code, setCode] = useState("");
  // const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isPasswordValid(password)) {
      setError("Please ensure your password meets all requirements.");
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, name);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Account created — redirect to login directly (no verification step)
    setLoading(false);
    navigate("/login");
  };

  // --- EMAIL VERIFICATION HANDLER (commented out — not in use yet) ---
  // const handleVerify = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setError(null);
  //   setLoading(true);
  //   const { error } = await verifyEmailCode(email, code);
  //   if (error) {
  //     setError(error.message);
  //     setLoading(false);
  //     return;
  //   }
  //   navigate("/login");
  // };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 gradient-hero">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border bg-card p-8 shadow-xl">
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

        {/* --- EMAIL VERIFICATION FORM (commented out — not in use yet) --- */}
        {/* {isVerifying ? (
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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</>
              ) : (
                <>Verify Account <ArrowRight className="ml-2 h-4 w-4" /></>
              )}
            </Button>
          </form>
        ) : ( */}

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
          <PasswordInput
            id="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
          {password && <PasswordStrength password={password} />}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 gradient-primary border-0 glow-sm text-white font-semibold hover:opacity-90 transition-opacity"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Account...
              </>
            ) : (
              <>
                Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        {/* )} */}{/* closes isVerifying ternary when verification is re-enabled */}
      </div>
    </div>
  );
}