import { useTelemetry } from "@/hooks/useTelemetry";
import { RecommendationCard } from "@/components/RecommendationCard";
import { TelemetryDebugPanel } from "@/components/TelemetryDebugPanel";
import { Activity, Brain, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SAMPLE_RECOMMENDATIONS = [
  {
    id: "rec-1",
    title: "Introduction to Neural Networks",
    description: "Build intuition for how neural networks learn, from perceptrons to backpropagation.",
    category: "Deep Learning",
    estimatedMinutes: 25,
    reason: "Based on your quiz results",
  },
  {
    id: "rec-2",
    title: "Data Cleaning with Pandas",
    description: "Practical techniques for handling missing values, outliers, and inconsistent formatting.",
    category: "Data Science",
    estimatedMinutes: 18,
    reason: "Fills a knowledge gap",
  },
  {
    id: "rec-3",
    title: "Attention Is All You Need — Paper Walkthrough",
    description: "A guided reading of the transformer paper with interactive code examples.",
    category: "NLP",
    estimatedMinutes: 40,
    reason: "Next in your learning path",
  },
];

const Index = () => {
  const telemetry = useTelemetry({
    endpoint: "/api/telemetry",
    batchIntervalMs: 30_000,
    idleTimeoutMs: 1200_000,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Brain className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">
              StudySync
            </span>
          </div>
          <Badge variant="outline" className="gap-1.5 font-mono text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-primary telemetry-pulse" />
            Telemetry Active
          </Badge>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-12">
        {/* Hero section */}
        <div className="mb-12 max-w-2xl">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-accent" />
            <span className="text-sm font-semibold text-accent uppercase tracking-wider">
              Smart Recommendations
            </span>
          </div>
          <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground">
            Your personalized
            <br />
            learning path
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Recommendations powered by ground-truth behavioral telemetry — not vanity metrics.
            Try switching tabs or going idle to see the tracker respond.
          </p>
        </div>

        {/* Stats bar */}
        <div className="mb-8 flex flex-wrap gap-6">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5">
            <Activity className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Active Time</p>
              <p className="font-mono text-sm font-semibold text-foreground">
                {Math.floor(telemetry.activeTimeMs / 1000)}s
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5">
            <div className={`h-2.5 w-2.5 rounded-full ${telemetry.isActive ? "bg-primary" : "bg-muted-foreground"}`} />
            <div>
              <p className="text-xs text-muted-foreground">Focus State</p>
              <p className="text-sm font-semibold text-foreground">
                {telemetry.isActive ? "Focused" : "Away"}
              </p>
            </div>
          </div>
        </div>

        {/* Recommendation cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_RECOMMENDATIONS.map((rec) => (
            <RecommendationCard
              key={rec.id}
              {...rec}
              telemetry={telemetry}
            />
          ))}
        </div>

        {/* Code explanation */}
        <div className="mt-16 max-w-2xl rounded-lg border border-border bg-card p-6">
          <h2 className="mb-3 text-xl font-bold text-foreground">How it works</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-mono text-primary">01</span>
              <span><strong className="text-foreground">Page Visibility API</strong> — Timer pauses instantly when you switch tabs. No inflated "time on page."</span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-primary">02</span>
              <span><strong className="text-foreground">Idle Detection</strong> — 3 minutes of no input triggers an idle event and pauses tracking.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-primary">03</span>
              <span><strong className="text-foreground">Batched Transport</strong> — Events queue up and flush every 30s, preventing server DDoS.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-primary">04</span>
              <span><strong className="text-foreground">sendBeacon on Unload</strong> — Remaining events fire via sendBeacon when closing the tab. Zero data loss.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-mono text-primary">05</span>
              <span><strong className="text-foreground">Priority Channel</strong> — Explicit feedback (👍/👎) sends immediately, bypassing the batch queue.</span>
            </li>
          </ul>
        </div>
      </main>

      {/* Debug panel */}
      <TelemetryDebugPanel telemetry={telemetry} />
    </div>
  );
};

export default Index;
