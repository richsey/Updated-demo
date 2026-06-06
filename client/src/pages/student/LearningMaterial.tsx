import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, CheckCircle2, Sparkles, PlayCircle, Code, ArrowRight, BrainCircuit, X, Zap, Clock, TimerOff, Info, ExternalLink, Youtube } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  trackLessonAbandonment,
  trackPdfIgnored,
  trackPdfOpen,
  trackPdfReadingTime,
} from "@/lib/telemetry/studentTracker";
import { useMaterial } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { useProgressTracking } from "@/hooks/useProgressTracking";

export default function LearningMaterial() {
  const { materialId } = useParams();
  const { user } = useAuth();
  const { data: materialData, isLoading } = useMaterial(materialId);
  const material = materialData as any;
  
  const [needsFormatShift, setNeedsFormatShift] = useState(false);
  const [showVideoAnyway, setShowVideoAnyway] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [isStruggling, setIsStruggling] = useState(false);
  const [struggleReason, setStruggleReason] = useState("");
  const [simplifiedMaterial, setSimplifiedMaterial] = useState<any>(null);
  const [externalSearchUrl, setExternalSearchUrl] = useState("");

  const { markComplete, isMarking, aiRecommendation } = useProgressTracking();

  const startTimeRef = useRef(Date.now());
  const hasClickedPdfRef = useRef(false);

  // ─── 1. AI Recommendation Engine ───────────────────────────────────────────

  const findSimplifiedMaterial = useCallback(async (courseId: string, currentId: string) => {
    // Stage 1: Smart External Search Generator
    if (material?.title) {
      const query = encodeURIComponent(`${material.title} explained simply`);
      setExternalSearchUrl(`https://www.youtube.com/results?search_query=${query}`);
    }

    // Stage 2: Internal Keyword Match
    const { data: keywordMatch } = await supabase.from("materials")
      .select("*")
      .eq("course_id", courseId)
      .neq("id", currentId)
      .or('title.ilike.%Simplified%,title.ilike.%Quick%,title.ilike.%Summary%,title.ilike.%Overview%')
      .limit(1);

    if (keywordMatch && keywordMatch.length > 0) {
      setSimplifiedMaterial(keywordMatch[0]);
      return;
    }

    // Stage 3: Fallback to shortest lesson
    const { data: shortestMatch } = await supabase.from("materials")
      .select("*")
      .eq("course_id", courseId)
      .neq("id", currentId)
      .order("duration_minutes", { ascending: true })
      .limit(1);

    if (shortestMatch && shortestMatch.length > 0) {
      setSimplifiedMaterial(shortestMatch[0]);
    }
  }, [material?.title]);

  useEffect(() => {
    if (!material?.course_id || !materialId) return;
    
    (supabase.from("courses") as any).select("title").eq("id", material.course_id).single()
      .then(({ data }: any) => { if (data) setCourseName(data.title ?? ""); });

    findSimplifiedMaterial(material.course_id, materialId);
  }, [material?.course_id, materialId, findSimplifiedMaterial]);

  // Reset struggle state when material changes
  useEffect(() => {
    setIsStruggling(false);
    setStruggleReason("");
  }, [materialId]);

  useEffect(() => {
    if (!user?.id || !materialId) return;
    const checkCompletion = async () => {
      const { data } = await (supabase as any).from("user_material_progress")
        .select("completed")
        .eq("user_id", user.id)
        .eq("material_id", materialId)
        .maybeSingle();
      if ((data as any)?.completed) setIsCompleted(true);
    };
    checkCompletion().catch(() => {});
  }, [user?.id, materialId]);

  const handleStruggle = useCallback((reason: string) => {
    setStruggleReason(reason);
    setIsStruggling(true);
  }, []);

  const handleMarkComplete = async () => {
    if (!materialId || isCompleted) return;
    try { await markComplete(materialId); setIsCompleted(true); } catch (err) { console.error(err); }
  };

  const handleVideoEnded = () => { if (!isCompleted) handleMarkComplete(); };

  if (isLoading) return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!material) return null;

  const durationDifference = simplifiedMaterial 
    ? (material.duration_minutes || 0) - (simplifiedMaterial.duration_minutes || 0) 
    : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10 relative">
      <Link to={`/courses/${material.course_id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
        <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" /> Back to {courseName || "Course"}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight">{material.title}</h1>
          <p className="text-sm text-muted-foreground capitalize mt-1 flex items-center gap-2">
            <span className="flex h-1.5 w-1.5 rounded-full bg-primary" />
            {material.type}
          </p>
        </div>
      </div>

      <div className="relative group">
        <Card className="border-none shadow-2xl bg-black overflow-hidden rounded-3xl">
          <CardContent className="p-0 relative">
            {/* Extended Struggle Detection Modal */}
            {isStruggling && !showVideoAnyway && (
              <div className="absolute inset-0 z-[60] bg-background/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in zoom-in duration-500">
                <Button variant="ghost" size="icon" className="absolute top-6 right-6 text-muted-foreground hover:text-foreground" onClick={() => setIsStruggling(false)}>
                  <X className="h-6 w-6" />
                </Button>
                <div className="max-w-md w-full bg-card border border-primary/20 shadow-[0_0_50px_-12px_rgba(var(--primary-rgb),0.5)] rounded-[2.5rem] p-10 text-center space-y-8">
                  <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary relative">
                    <BrainCircuit className="h-10 w-10" />
                    <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-2 animate-bounce">
                      <Zap className="h-3 w-3 fill-current" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-3xl font-bold font-display tracking-tight">Need a Different Perspective?</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Would you like to explore a similar video from a different angle?
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-4 pt-4">
                    <Button asChild size="lg" className="w-full h-14 rounded-2xl text-base font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xl shadow-rose-600/20 hover:scale-[1.02] active:scale-95 transition-all">
                      <a href={externalSearchUrl} target="_blank" rel="noopener noreferrer" onClick={() => setIsStruggling(false)}>Yes, show me a similar video</a>
                    </Button>
                    
                    <Button variant="outline" size="lg" className="w-full h-14 rounded-2xl text-base font-bold text-muted-foreground hover:text-foreground" onClick={() => setIsStruggling(false)}>
                      No, continue watching current video
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {material.type === "video" && (
              <VideoPlayer 
                key={material.id}
                videoId={material.id} 
                videoUrl={material.url} 
                durationMinutes={material.duration_minutes || 0} 
                onEnded={handleVideoEnded}
                onStruggle={handleStruggle}
              />
            )}

            {material.type === "tutorial" && (
              <div className="flex flex-col items-center justify-center w-full py-28 bg-primary/5 rounded-3xl space-y-8 border border-primary/15 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5"><Code className="h-64 w-64 rotate-12" /></div>
                <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-primary/10 border border-primary/20 text-primary shadow-inner"><Code className="h-10 w-10" /></div>
                <div className="text-center space-y-3 relative z-10"><h3 className="text-3xl font-extrabold font-display">Interactive Tutorial</h3><p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">Engagement is tracked automatically once you launch the external environment.</p></div>
                <Button asChild size="lg" className="gradient-primary border-0 glow-sm px-12 h-14 rounded-2xl text-base font-bold relative z-10" onClick={() => { if (materialId && user) { trackPdfOpen(user.id, materialId); handleMarkComplete(); } }}><a href={material.url} target="_blank" rel="noopener noreferrer">Launch Environment <ArrowRight className="ml-3 h-5 w-5" /></a></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" /><h3 className="text-xl font-bold font-display">Lesson Context</h3></div>
          <div className="prose prose-slate dark:prose-invert max-w-none text-muted-foreground leading-loose bg-card/40 p-8 rounded-3xl border border-border/40">
            <p>This masterclass lesson on <strong>{material.title}</strong> is designed to build foundational mastery. We recommend active listening and following along with any code snippets described.</p>
          </div>
        </div>
        
        <div className="space-y-6">
          {(isCompleted || isMarking) && (
            <div className="flex items-start gap-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 animate-in fade-in slide-in-from-right-4 duration-700">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[1.25rem] bg-emerald-500/10 text-emerald-500">{isMarking ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}</div>
              <div className="min-w-0 pt-0.5"><p className="font-bold text-base leading-none mb-1.5">{isMarking ? "Saving data..." : "Material Finished"}</p><p className="text-xs text-muted-foreground leading-relaxed">{isMarking ? "Your interaction stats are being synced." : "Your progress has been synchronized."}</p></div>
            </div>
          )}

          {aiRecommendation && (
            <div className="rounded-3xl border border-accent/20 bg-accent/5 p-6 space-y-5 animate-in fade-in slide-in-from-right-8 duration-700 delay-150">
              <div className="flex items-center gap-2.5 text-accent"><Sparkles className="h-5 w-5" /><h4 className="font-bold font-display text-base">Up Next</h4></div>
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-[10px] font-extrabold text-accent uppercase tracking-wider">{aiRecommendation.difficulty_level} TRACK · {aiRecommendation.progress}% complete</div>
              {aiRecommendation.recommended_next_material && (
                <Link to={`/materials/${aiRecommendation.recommended_next_material.id}`} className="group block rounded-2xl border border-border/40 bg-card/60 p-4 transition-all hover:border-primary/30 hover:bg-card">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">{aiRecommendation.recommended_next_material.type === "video" ? <PlayCircle className="h-5 w-5" /> : <Code className="h-5 w-5" />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{aiRecommendation.recommended_next_material.title}</p>
                      <p className="text-[10px] text-muted-foreground">{aiRecommendation.recommended_next_material.type} · {aiRecommendation.recommended_next_material.duration_minutes}m</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
