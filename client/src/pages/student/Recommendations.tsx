import { useUserProgress, useUserQuizAttempts } from "@/hooks/useSupabaseQuery";
import { Card, CardContent } from "@/components/ui/card";
import { Brain, BookOpen, Loader2, Sparkles, ExternalLink, Youtube, FileText, GraduationCap, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { fetchCourseProgressAPI } from "@/hooks/useProgressTracking";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CourseAIData {
  courseId: string;
  courseTitle: string;
  level: string;
  progress: number;
  completedMaterials: number;
  totalMaterials: number;
}

interface RecommendationLink {
  url: string;
  source: string;
  label: string;
}

interface RAGRecommendation {
  title: string;
  reason: string;
  difficulty: string;
  priority: number;
  // Multi-source links returned by AI
  links?: RecommendationLink[];
  // Legacy single-link fields (kept for backward compat)
  url?: string;
  source?: string;
}

interface RAGResponse {
  recommendations: RAGRecommendation[];
  metadata: {
    user_level?: string;
    weak_topics?: string[];
    strong_topics?: string[];
    generation_method?: string;
    elapsed_seconds?: number;
    candidates_retrieved?: number;
    avg_quiz_score?: number;
    completion_pct?: number;
    [key: string]: unknown;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8001";

// ─── Helper Components ───────────────────────────────────────────────────────

function SourceIcon({ source }: { source: string }) {
  switch (source?.toLowerCase()) {
    case "youtube":
      return <Youtube className="h-4 w-4" />;
    case "documentation":
      return <FileText className="h-4 w-4" />;
    case "freecodecamp":
      return <GraduationCap className="h-4 w-4" />;
    case "khan_academy":
      return <GraduationCap className="h-4 w-4" />;
    case "wikipedia":
      return <BookOpen className="h-4 w-4" />;
    case "coursera":
      return <GraduationCap className="h-4 w-4" />;
    default:
      return <ExternalLink className="h-4 w-4" />;
  }
}

function DifficultyBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    beginner: "text-success bg-success/10 border-success/20",
    intermediate: "text-warning bg-warning/10 border-warning/20",
    advanced: "text-destructive bg-destructive/10 border-destructive/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${colors[level] || colors.beginner}`}
    >
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function SourceBadge({ link }: { link: RecommendationLink }) {
  const colorMap: Record<string, string> = {
    youtube: "text-destructive bg-destructive/10 border-destructive/20 hover:bg-destructive/20",
    documentation: "text-info bg-info/10 border-info/20 hover:bg-info/20",
    freecodecamp: "text-success bg-success/10 border-success/20 hover:bg-success/20",
    khan_academy: "text-primary bg-primary/10 border-primary/20 hover:bg-primary/20",
    wikipedia: "text-muted-foreground bg-muted/50 border-border hover:bg-muted",
    coursera: "text-info bg-info/10 border-info/20 hover:bg-info/20",
    investopedia: "text-success bg-success/10 border-success/20 hover:bg-success/20",
    blog: "text-accent bg-accent/10 border-accent/20 hover:bg-accent/20",
    other: "text-muted-foreground bg-muted/50 border-border hover:bg-muted",
  };
  const color = colorMap[link.source?.toLowerCase()] ?? colorMap.other;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${color}`}
    >
      <SourceIcon source={link.source} />
      {link.label}
      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
    </a>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

const levelColors: Record<string, string> = {
  beginner: "text-success bg-success/10 border-success/20",
  intermediate: "text-warning bg-warning/10 border-warning/20",
  advanced: "text-destructive bg-destructive/10 border-destructive/20",
};

export default function Recommendations() {
  const { user } = useAuth();
  const { data: progressData = [], isLoading: progressLoading } = useUserProgress();
  const [courseAIData, setCourseAIData] = useState<CourseAIData[]>([]);

  // RAG recommendations state
  const [ragData, setRagData] = useState<RAGResponse | null>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [ragError, setRagError] = useState<string | null>(null);

  const activeCourses = progressData.filter(
    (p) => (p.progress ?? 0) > 0 || (p.completed_materials ?? 0) > 0
  );

  // Fetch progress-based AI data for each active course
  useEffect(() => {
    if (!user?.id || activeCourses.length === 0) {
      setCourseAIData([]);
      return;
    }

    const fetchAll = async () => {
      const results: CourseAIData[] = [];
      for (const p of activeCourses) {
        try {
          const data = await fetchCourseProgressAPI(user.id, p.course_id);
          const level =
            data.progress <= 30 ? "beginner" :
            data.progress <= 70 ? "intermediate" : "advanced";
          results.push({
            courseId: p.course_id,
            courseTitle: p.courses?.title ?? "Course",
            level,
            progress: data.progress,
            completedMaterials: data.completed_materials,
            totalMaterials: data.total_materials,
          });
        } catch {
          // skip courses without progress data
        }
      }
      setCourseAIData(results);
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeCourses.length]); // depend on length so we don't spam requests if array reference changes but content is same

  // Fetch RAG recommendations from AI service
  const fetchRAGRecommendations = async () => {
    if (!user?.id || activeCourses.length === 0) return;

    setRagLoading(true);
    setRagError(null);

    try {
      const response = await fetch(`${AI_SERVICE_URL}/recommend/rag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`);
      }

      const data: RAGResponse = await response.json();
      setRagData(data);
    } catch (err: Error | unknown) {
      console.error("[RAG] Failed to fetch recommendations:", err);
      const msg = err instanceof Error ? err.message : "An error occurred";
      setRagError(
        msg.includes("Failed to fetch")
          ? "AI service is not running. Start it with: npm run dev"
          : msg
      );
    } finally {
      setRagLoading(false);
    }
  };

  // Auto-fetch RAG recommendations when active courses > 0
  useEffect(() => {
    if (user?.id && activeCourses.length > 0) {
      fetchRAGRecommendations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, activeCourses.length]);

  if (progressLoading) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeCourses.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display">Recommendations</h1>
          <p className="text-muted-foreground">Personalized suggestions based on your learning behavior</p>
        </div>
        <Card className="border-dashed bg-transparent shadow-none">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center space-y-4">
            <div className="rounded-full bg-muted p-4">
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-lg">No Recommendations Yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Start studying a course to unlock AI-powered, personalized recommendations tailored to your learning style and progress.
              </p>
            </div>
            <Button asChild className="mt-4">
              <Link to="/courses">Explore Courses</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Recommendations</h1>
        <p className="text-muted-foreground">Personalized suggestions based on your learning behavior</p>
      </div>

      {/* AI Progress Level Section */}
      {courseAIData.length > 0 && (
        <Card className="border-accent/20 bg-accent/5">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h2 className="font-bold font-display text-base">Your Learning Level</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {courseAIData.map((cd) => (
                <Link
                  key={cd.courseId}
                  to={`/courses/${cd.courseId}`}
                  className="group rounded-xl border border-border/60 bg-card/80 p-4 flex flex-col gap-2 transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {cd.courseTitle}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${levelColors[cd.level] || levelColors.beginner}`}>
                      {cd.level.charAt(0).toUpperCase() + cd.level.slice(1)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {cd.completedMaterials}/{cd.totalMaterials} done · {cd.progress}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── RAG External Recommendations Section ─── */}
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-violet-400" />
              <h2 className="font-bold font-display text-base">AI-Recommended Resources</h2>
                        {ragData?.metadata?.generation_method && (
                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-border/40">
                  {ragData.metadata.generation_method === "llm_gemini"
                    ? "Gemini 2.0 ✨"
                    : ragData.metadata.generation_method === "llm_ollama_gemma"
                    ? "Gemma ✨"
                    : ragData.metadata.generation_method === "llm"
                    ? "AI Engine"
                    : "Rule-based"}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRAGRecommendations}
              disabled={ragLoading}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${ragLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            External videos, tutorials, and documentation curated by AI based on your progress and weak areas.
          </p>

          {ragLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
              <span className="ml-2 text-sm text-muted-foreground">Analyzing your learning data...</span>
            </div>
          )}

          {ragError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
              <p className="font-medium">Could not load recommendations</p>
              <p className="text-xs mt-1 text-red-400/70">{ragError}</p>
            </div>
          )}

          {!ragLoading && !ragError && ragData && ragData.recommendations.length === 0 && (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                🎉 You're all caught up! Complete more materials and quizzes to get personalized recommendations.
              </p>
            </div>
          )}

          {!ragLoading && !ragError && ragData && ragData.recommendations.length > 0 && (
            <div className="grid gap-3">
              {ragData.recommendations
                .slice()
                .sort((a, b) => a.priority - b.priority)
                .map((rec, idx) => {
                  // Resolve links: prefer new links array, fall back to legacy url/source
                  const links: RecommendationLink[] = rec.links && rec.links.length > 0
                    ? rec.links
                    : rec.url
                      ? [{ url: rec.url, source: rec.source || "other", label: rec.source || "Open" }]
                      : [{ url: `https://www.youtube.com/results?search_query=${encodeURIComponent(rec.title)}+tutorial`, source: "youtube", label: "YouTube Tutorial" }];

                  return (
                    <div
                      key={idx}
                      className="group rounded-xl border border-border/60 bg-card/80 p-4 flex flex-col gap-3 transition-all hover:border-violet-500/40 hover:shadow-lg hover:bg-card"
                    >
                      {/* Top row: priority badge + title + difficulty */}
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 font-bold text-sm group-hover:bg-violet-500/20 transition-colors">
                          #{rec.priority}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-sm group-hover:text-violet-400 transition-colors">
                              {rec.title}
                            </h3>
                            <DifficultyBadge level={rec.difficulty} />
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">
                            {rec.reason}
                          </p>
                        </div>
                      </div>

                      {/* Source buttons row */}
                      <div className="flex items-center gap-2 flex-wrap pl-1">
                        <span className="text-[10px] text-muted-foreground mr-1">Learn from:</span>
                        {links.map((link, li) => (
                          <SourceBadge key={li} link={link} />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Metadata footer */}
          {ragData?.metadata && (
            <div className="flex items-center gap-3 pt-2 border-t border-border/30 flex-wrap">
              {ragData.metadata.user_level && (
                <span className="text-[10px] text-muted-foreground">
                  Level: <DifficultyBadge level={ragData.metadata.user_level} />
                </span>
              )}
              {ragData.metadata.weak_topics && ragData.metadata.weak_topics.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  Weak areas: {ragData.metadata.weak_topics.slice(0, 2).join(", ")}
                </span>
              )}
              {ragData.metadata.avg_quiz_score !== undefined && (
                <span className="text-[10px] text-muted-foreground">
                  Average quiz score: {ragData.metadata.avg_quiz_score}%
                </span>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">
                {ragData.metadata.elapsed_seconds?.toFixed(1)}s
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Brain className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">How recommendations work</p>
            <p className="text-muted-foreground mt-1">
              The AI analyzes your quiz performance, course progress, and learning behavior to find your weak areas.
              It then uses vector similarity search to identify relevant topics and recommends external resources
              (YouTube videos, documentation, free courses) to help you improve.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
