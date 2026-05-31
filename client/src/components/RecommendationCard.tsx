/**
 * RecommendationCard — Displays an AI-recommended course/resource.
 *
 * Supports two modes:
 *   1. RAG mode: displays title, reason, difficulty, priority from the Ollama Gemma pipeline
 *   2. Legacy mode: displays internal course recommendations with telemetry feedback
 *
 * Includes Thumbs Up / Thumbs Down feedback buttons in legacy mode
 * that fire priority telemetry events.
 */

import { ThumbsUp, ThumbsDown, Clock, BookOpen, Brain, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Props for RAG-mode recommendations (from Ollama Gemma /recommend/rag).
 */
interface RAGRecommendationCardProps {
  mode: "rag";
  title: string;
  reason: string;
  difficulty: "beginner" | "intermediate" | "advanced" | string;
  priority: number;
  url?: string;
  source?: string;
}

/**
 * Props for legacy internal course recommendations.
 */
interface LegacyRecommendationCardProps {
  mode?: "legacy";
  id: string;
  title: string;
  description: string;
  category: string;
  estimatedMinutes: number;
  reason: string;
  telemetry: {
    sendFeedback: (
      type: "feedback_positive" | "feedback_negative",
      data: Record<string, unknown>
    ) => void;
  };
}

type RecommendationCardProps = RAGRecommendationCardProps | LegacyRecommendationCardProps;

// ─── Difficulty Badge ─────────────────────────────────────────────────────────

function DifficultyBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    beginner: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    intermediate: "text-amber-400 bg-amber-500/15 border-amber-500/30",
    advanced: "text-rose-400 bg-rose-500/15 border-rose-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
        colors[level?.toLowerCase()] ?? colors.beginner
      }`}
    >
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

// ─── RAG Card ────────────────────────────────────────────────────────────────

function RAGCard(props: RAGRecommendationCardProps) {
  const { title, reason, difficulty, priority, url, source } = props;

  const cardContent = (
    <Card className="group relative overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 transition-all hover:border-violet-500/40 hover:shadow-md hover:shadow-violet-500/10">
      <CardContent className="p-5">
        {/* Header row: priority + difficulty */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-400 font-bold text-sm">
            #{priority}
          </div>
          <div className="flex items-center gap-2">
            <DifficultyBadge level={difficulty} />
            {source && (
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-border/40">
                {source}
              </Badge>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="flex items-start gap-2 mb-2">
          <Brain className="h-4 w-4 text-violet-400 mt-0.5 flex-shrink-0" />
          <h3 className="text-sm font-semibold leading-snug group-hover:text-violet-400 transition-colors">
            {title}
          </h3>
        </div>

        {/* Reason */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-3">
          {reason}
        </p>

        {/* External link (if present) */}
        {url && (
          <div className="flex items-center gap-1 text-xs text-violet-400 font-medium group-hover:text-violet-300 transition-colors">
            <ExternalLink className="h-3 w-3" />
            <span>Open resource</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {cardContent}
      </a>
    );
  }

  return cardContent;
}

// ─── Legacy Card ─────────────────────────────────────────────────────────────

function LegacyCard(props: LegacyRecommendationCardProps) {
  const { id, title, description, category, estimatedMinutes, reason, telemetry } = props;
  const [feedback, setFeedback] = useState<"positive" | "negative" | null>(null);

  const handleFeedback = (type: "positive" | "negative") => {
    setFeedback(type);
    telemetry.sendFeedback(
      type === "positive" ? "feedback_positive" : "feedback_negative",
      { recommendationId: id, title, reason }
    );
  };

  return (
    <Card className="group relative overflow-hidden border-border/60 transition-all hover:border-primary/40 hover:shadow-md">
      <CardContent className="p-5">
        {/* Category badge */}
        <Badge variant="secondary" className="mb-3 text-xs font-medium">
          {category}
        </Badge>

        <h3 className="mb-1.5 text-lg font-semibold leading-tight text-foreground">
          {title}
        </h3>
        <p className="mb-3 text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>

        {/* Meta row */}
        <div className="mb-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {estimatedMinutes} min
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {reason}
          </span>
        </div>

        {/* Feedback row */}
        <div className="flex items-center gap-2">
          <span className="mr-auto text-xs text-muted-foreground">
            Was this helpful?
          </span>
          <Button
            size="sm"
            variant={feedback === "positive" ? "default" : "outline"}
            className="h-8 w-8 p-0"
            onClick={() => handleFeedback("positive")}
            disabled={feedback !== null}
            aria-label="Thumbs up"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={feedback === "negative" ? "destructive" : "outline"}
            className="h-8 w-8 p-0"
            onClick={() => handleFeedback("negative")}
            disabled={feedback !== null}
            aria-label="Thumbs down"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        {feedback && (
          <p className="mt-2 text-xs text-primary font-medium">
            Thanks for your feedback!
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Public Export ────────────────────────────────────────────────────────────

export function RecommendationCard(props: RecommendationCardProps) {
  if (props.mode === "rag") {
    return <RAGCard {...props} />;
  }
  // Default to legacy mode (backward-compatible)
  return <LegacyCard {...(props as LegacyRecommendationCardProps)} />;
}
