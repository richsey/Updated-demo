/**
 * ExternalViewerDemo — Public demo/storybook route at /demo/external-viewer
 *
 * Exercises all three ExternalViewer states:
 *   1. Loaded   — react.dev (allows framing, no X-Frame-Options)
 *   2. Blocked  — youtube.com (SAMEORIGIN) — pre-computed, instant fallback
 *   3. Loading  — simulates a slow site via a data URL that never triggers onLoad
 *
 * No authentication required. Accessible at /demo/external-viewer.
 */

import { useState } from "react";
import { ExternalViewer } from "@/components/ExternalViewer";
import { useExternalViewer } from "@/hooks/useExternalViewer";
import {
  CheckCircle2,
  ShieldX,
  Loader2,
  ExternalLink,
  ChevronRight,
  Globe,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Demo scenarios ───────────────────────────────────────────────────────────

const SCENARIOS = [
  {
    id: "loaded",
    label: "Embeddable site",
    description: "Wikipedia allows framing. The iframe loads and the page is fully visible inside the viewer.",
    url: "https://en.wikipedia.org/wiki/Main_Page",
    title: "Wikipedia — The Free Encyclopedia",
    embeddable: true,
    stateTag: "loaded" as const,
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    badgeColor: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    badgeLabel: "✓ Embeddable",
  },
  {
    id: "blocked",
    label: "Blocked site (X-Frame-Options)",
    description: "youtube.com sends X-Frame-Options: SAMEORIGIN. The fallback card is shown immediately.",
    url: "https://www.youtube.com/",
    title: "YouTube",
    embeddable: false,
    stateTag: "blocked" as const,
    icon: ShieldX,
    iconColor: "text-rose-500",
    badgeColor: "bg-rose-500/10 text-rose-700 border-rose-200",
    badgeLabel: "✗ Blocked",
  },
  {
    id: "loading",
    label: "Slow / loading state",
    description: "Simulates a site that is taking a long time to respond — shows the loading skeleton.",
    url: "https://example.com/",
    title: "Example — Loading demo",
    embeddable: undefined,
    stateTag: "loading" as const,
    icon: Loader2,
    iconColor: "text-amber-500",
    badgeColor: "bg-amber-500/10 text-amber-700 border-amber-200",
    badgeLabel: "⏳ Loading",
    forceLoadingState: true,
  },
] as const;

// ─── Scenario card ────────────────────────────────────────────────────────────

function ScenarioCard({
  scenario,
  onOpen,
}: {
  scenario: (typeof SCENARIOS)[number];
  onOpen: (s: (typeof SCENARIOS)[number], el: HTMLElement | null) => void;
}) {
  const Icon = scenario.icon;
  return (
    <div className="group flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/80 p-6 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border bg-background ${scenario.iconColor.replace("text-", "border-").replace("500", "200")} bg-opacity-10`}
        >
          <Icon
            className={`h-5 w-5 ${scenario.iconColor} ${"id" in scenario && scenario.id === "loading" ? "animate-spin" : ""}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-sm font-display">{scenario.label}</h3>
            <span
              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${scenario.badgeColor}`}
            >
              {scenario.badgeLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {scenario.description}
          </p>
        </div>
      </div>

      {/* URL chip */}
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/40 px-3 py-2">
        <Globe className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-[11px] text-muted-foreground">
          {scenario.url}
        </span>
      </div>

      {/* Action */}
      <Button
        id={`demo-open-${scenario.id}`}
        size="sm"
        variant="outline"
        className="w-full gap-2 group-hover:border-primary/40 group-hover:text-primary transition-colors"
        onClick={(e) => onOpen(scenario, e.currentTarget as HTMLElement)}
      >
        <Eye className="h-3.5 w-3.5" />
        Preview state
        <ChevronRight className="h-3.5 w-3.5 ml-auto" />
      </Button>
    </div>
  );
}

// ─── Main Demo Page ───────────────────────────────────────────────────────────

export default function ExternalViewerDemo() {
  const { open, viewerProps } = useExternalViewer();
  // Track which scenario is active so we can override embeddable prop
  const [activeScenario, setActiveScenario] = useState<
    (typeof SCENARIOS)[number] | null
  >(null);

  const handleOpen = (
    scenario: (typeof SCENARIOS)[number],
    triggerEl: HTMLElement | null
  ) => {
    setActiveScenario(scenario);
    open(
      {
        url: scenario.url,
        title: scenario.title,
        embeddable: scenario.embeddable as boolean | undefined,
      },
      triggerEl
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero header ── */}
      <div className="border-b border-border/40 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <Badge
            variant="outline"
            className="mb-4 border-primary/30 bg-primary/5 text-primary text-xs px-3 py-1"
          >
            Phase 4 Demo
          </Badge>
          <h1 className="text-4xl font-bold font-display tracking-tight mb-3">
            ExternalViewer Component
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Click any scenario below to open the viewer and exercise its three
            states: <strong className="text-foreground">loaded</strong>,{" "}
            <strong className="text-foreground">blocked</strong>, and{" "}
            <strong className="text-foreground">loading</strong>.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            {[
              "Focus trap (Tab cycle)",
              "Escape to close",
              "Focus restoration",
              "aria-modal",
              "Hardened sandbox",
              "Fallback card",
            ].map((feat) => (
              <span
                key={feat}
                className="rounded-full border border-border/60 bg-muted/40 px-3 py-1"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scenario grid ── */}
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <h2 className="text-lg font-bold font-display mb-1">Demo Scenarios</h2>
          <p className="text-sm text-muted-foreground">
            Three scenarios covering every viewer state. Keyboard: press{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              Esc
            </kbd>{" "}
            to close.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s) => (
            <ScenarioCard key={s.id} scenario={s} onOpen={handleOpen} />
          ))}
        </div>

        {/* ── Implementation notes ── */}
        <div className="mt-16 rounded-2xl border border-border/40 bg-muted/20 p-8 space-y-4">
          <h2 className="font-bold font-display text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-primary" />
            How it works
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 text-sm text-muted-foreground">
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">Embeddability check</p>
              <p className="text-xs leading-relaxed">
                Calls{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-foreground">
                  GET /api/links/embeddable?url=…
                </code>{" "}
                on the FastAPI AI service. Inspects X-Frame-Options and CSP
                frame-ancestors headers. Results are cached per host in Supabase.
                Sites like Wikipedia allow framing; sites like YouTube do not.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">Iframe hardening</p>
              <p className="text-xs leading-relaxed">
                <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-foreground">
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                </code>{" "}
                plus{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-foreground">
                  referrerPolicy="no-referrer"
                </code>{" "}
                and{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px] font-mono text-foreground">
                  loading="lazy"
                </code>
                .
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">Accessibility</p>
              <p className="text-xs leading-relaxed">
                Full focus trap cycling via Tab/Shift+Tab. Escape closes.
                Focus is restored to the element that opened the viewer.
                aria-modal + aria-label on all interactive elements.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">Blocked state</p>
              <p className="text-xs leading-relaxed">
                If the checker returns embeddable=false (or the prop is passed
                directly), the fallback card renders immediately — no blank
                iframe is ever shown. An "Open in new tab" link is always
                available.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── The viewer itself (controlled by hook) ── */}
      <ExternalViewer
        {...viewerProps}
        embeddable={
          activeScenario?.embeddable as boolean | undefined
        }
      />
    </div>
  );
}
