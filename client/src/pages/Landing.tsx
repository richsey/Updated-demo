import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Brain,
  BarChart3,
  Target,
  Zap,
  BookOpen,
  ArrowRight,
  Sparkles,
  Shield,
  TrendingUp,
} from "lucide-react";

const features = [
  {
    icon: Target,
    title: "Adaptive Recommendations",
    desc: "Detects when a recommendation leads to poor outcomes and automatically adjusts the learning strategy in real time.",
    gradient: "from-success/20 to-success/10",
    iconColor: "text-success",
    border: "border-success/20",
  },
  {
    icon: BarChart3,
    title: "Deep Engagement Tracking",
    desc: "Tracks real behavior — video rewinds, idle time, quiz hesitation — not just page views or clicks.",
    gradient: "from-accent/20 to-accent/10",
    iconColor: "text-accent",
    border: "border-accent/20",
  },
  {
    icon: BookOpen,
    title: "Learning Style Detection",
    desc: "Classifies you as a visual, reading, or interactive learner and automatically adapts content format.",
    gradient: "from-primary/20 to-primary/10",
    iconColor: "text-primary",
    border: "border-primary/20",
  },
];

const stats = [
  { value: "1,200+", label: "Active Students", icon: "👨‍🎓" },
  { value: "94%", label: "Recommendation Accuracy", icon: "🎯" },
  { value: "2.5×", label: "Faster Mastery", icon: "⚡" },
];

const trust = [
  { icon: Shield, label: "Privacy First" },
  { icon: TrendingUp, label: "Proven Results" },
  { icon: Sparkles, label: "AI-Powered" },
];

export default function Landing() {
  return (
    <div className="min-h-screen text-foreground overflow-x-hidden bg-background">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full blur-[120px] bg-primary/20" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full blur-[100px] bg-accent/20" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full blur-[80px] bg-info/20" />
      </div>

      {/* ── Nav ── */}
      <header className="glass sticky top-0 z-50 border-b border-border/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary glow-sm">
              <Brain
                className="h-4.5 w-4.5 text-white"
                style={{ height: "18px", width: "18px" }}
              />
            </div>
            <span className="text-lg font-bold font-display gradient-text">
              StudySync
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a
              href="#features"
              className="hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#stats"
              className="hover:text-foreground transition-colors"
            >
              Results
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button
              variant="ghost"
              asChild
              className="text-muted-foreground hover:text-foreground"
            >
              <Link to="/login">Log in</Link>
            </Button>
            <Button
              asChild
              className="gradient-primary border-0 glow-sm hover:opacity-90 transition-opacity"
            >
              <Link to="/register">
                Get Started <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative container py-28 text-center">
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2 text-sm text-primary font-medium shadow-lg shadow-primary/10">
            <Zap className="h-3.5 w-3.5 animate-pulse-slow" />
            Adaptive AI-Powered Learning Platform
          </div>

          <h1 className="text-6xl font-extrabold leading-[1.08] tracking-tight font-display md:text-7xl lg:text-8xl">
            Learn smarter,{" "}
            <span className="gradient-text text-glow">not harder</span>
          </h1>

          <p className="mx-auto max-w-2xl text-xl text-muted-foreground leading-relaxed">
            StudySync detects when recommendations fail and corrects
            them automatically. Get personalized study paths based on your{" "}
            <span className="text-foreground font-medium">real engagement</span>
            , not vanity metrics.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
            <Button
              size="lg"
              asChild
              className="gradient-primary border-0 glow-primary text-base h-12 px-8 hover:opacity-90 transition-opacity"
            >
              <Link to="/register">
                Start Learning Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-border/60 text-base h-12 px-8 hover:bg-secondary/80"
            >
              <Link to="/login">Sign In to Dashboard</Link>
            </Button>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-6 pt-4">
            {trust.map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <t.icon className="h-4 w-4 text-primary" />
                {t.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 relative">
        <div className="container">
          <div className="text-center mb-16 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent font-medium">
              <Sparkles className="h-3.5 w-3.5" /> Why StudySync?
            </div>
            <h2 className="text-4xl font-bold font-display">
              Everything you need to{" "}
              <span className="gradient-text">master any skill</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Engineered for learners who demand more than progress bars and
              certificates.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`group relative rounded-2xl border ${f.border} bg-gradient-to-br ${f.gradient} p-8 card-hover overflow-hidden`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.05), transparent 70%)`,
                  }}
                />
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl bg-card border border-border/60 mb-5 ${f.iconColor} group-hover:scale-110 transition-transform duration-300`}
                >
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold font-display mb-3">
                  {f.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section id="stats" className="py-24">
        <div className="container">
          <div className="glass rounded-3xl border border-border/60 p-12">
            <div className="grid gap-8 md:grid-cols-3 text-center">
              {stats.map((s) => (
                <div key={s.label} className="space-y-2">
                  <div className="text-4xl mb-2">{s.icon}</div>
                  <div className="text-5xl font-extrabold font-display gradient-text">
                    {s.value}
                  </div>
                  <div className="text-muted-foreground font-medium">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24">
        <div className="container text-center space-y-6">
          <h2 className="text-4xl font-bold font-display">
            Ready to transform{" "}
            <span className="gradient-text">how you learn?</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Join over 1,200 students already getting smarter recommendations
            every day.
          </p>
          <Button
            size="lg"
            asChild
            className="gradient-primary border-0 glow-primary text-base h-12 px-10 hover:opacity-90 transition-opacity"
          >
            <Link to="/register">
              Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/60 py-10">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md gradient-primary">
              <Brain className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-display font-semibold text-foreground">
              StudySync
            </span>
          </div>
          <span>© 2026 StudySync. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
