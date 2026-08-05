import { useParams, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Star, Users, PlayCircle, Code, ArrowLeft, Lock, CheckCircle2, BookOpen, Loader2, Bookmark, FileText } from "lucide-react";
import { useCourse, useQuizByCourse, useCourseProgress } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchBookmarks, addBookmark, removeBookmark } from "@/lib/api/bookmarks";
import { useToast } from "@/hooks/use-toast";
import { computeCourseProgress, syncCourseProgress } from "@/lib/api/progress";
import { fetchCourseProgressAPI, fetchCompletedMaterialsAPI } from "@/hooks/useProgressTracking";

const typeIcon = {
  video: PlayCircle,
  pdf: FileText,
  article: FileText,
  tutorial: Code,
};

const typeConfig = {
  video: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20", label: "Video Lesson" },
  pdf: { bg: "bg-rose-500/10", text: "text-rose-500", border: "border-rose-500/20", label: "Document" },
  article: { bg: "bg-rose-500/10", text: "text-rose-500", border: "border-rose-500/20", label: "Document" },
  tutorial: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/20", label: "Interactive" },
};

export default function CourseDetails() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: courseData, isLoading } = useCourse(courseId);
  const course = courseData;
  const { data: quiz } = useQuizByCourse(courseId);
  const [completedMaterialIds, setCompletedMaterialIds] = useState<Set<string>>(new Set());

  const { data: bookmarksData = [] } = useQuery({
    queryKey: ["bookmarks", user?.id],
    queryFn: () => fetchBookmarks(user!.id),
    enabled: !!user?.id,
  });

  const bookmarkedMaterialIds = new Set(bookmarksData.map((b: any) => b.material_id));

  const toggleBookmark = useMutation({
    mutationFn: async ({ materialId, isBookmarked }: { materialId: string, isBookmarked: boolean }) => {
      if (isBookmarked) {
        await removeBookmark(user!.id, materialId);
      } else {
        await addBookmark(user!.id, materialId);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      queryClient.invalidateQueries({ queryKey: ["bookmark", user?.id, variables.materialId] });
      toast({ title: variables.isBookmarked ? "Bookmark removed" : "Bookmark added" });
    },
    onError: () => {
      toast({ title: "Failed to update bookmark", variant: "destructive" });
    }
  });

  useEffect(() => {
    if (!user?.id || !course?.id) return;

    const fetchCompletion = () => {
      fetchCompletedMaterialsAPI(user.id, course.id)
        .then((ids) => setCompletedMaterialIds(new Set(ids)))
        .catch(console.error);
    };

    fetchCompletion();
    syncCourseProgress(user.id, course.id).catch(console.error);

    const interval = setInterval(fetchCompletion, 10000); // check completion every 10s
    return () => clearInterval(interval);
  }, [user?.id, course?.id]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="text-6xl">📚</div>
        <h2 className="text-2xl font-bold font-display">Course not found</h2>
        <Button asChild><Link to="/courses">Back to Courses</Link></Button>
      </div>
    );
  }

  const materials = course.materials ?? [];
  const totalCount = materials.length;
  const completedCount = materials.filter((m: { id: string }) => completedMaterialIds.has(m.id)).length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const progressColor = progress >= 80 ? "hsl(var(--primary))" : progress >= 50 ? "hsl(38 95% 56%)" : "hsl(var(--muted-foreground) / 0.5)";

  return (
    <div className="space-y-8 pb-6">
      <Link to="/courses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Courses
      </Link>

      <div className="relative rounded-2xl overflow-hidden border border-border/60">
        <div className="absolute inset-0">
          <img
            src={course.thumbnail}
            alt={course.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/60 backdrop-blur-[2px]" />
        </div>

        <div className="relative p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-8 md:items-start">
            <div className="flex-1 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="bg-secondary/80 text-xs">{course.category}</Badge>
                <Badge className={`text-xs border ${
                  course.difficulty === "beginner" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                  course.difficulty === "intermediate" ? "bg-amber-50 text-amber-700 border-amber-200" :
                  "bg-rose-50 text-rose-700 border-rose-200"
                }`}>
                  {course.difficulty}
                </Badge>
              </div>

              <h1 className="text-3xl md:text-4xl font-extrabold font-display leading-tight">{course.title}</h1>
              <p className="text-muted-foreground leading-relaxed max-w-2xl">{course.description}</p>

              <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" />{materials.length} materials</span>
                <span className="flex items-center gap-1.5"><Star className="h-4 w-4 text-amber-400 fill-amber-400" />{course.rating}</span>
                <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{course.enrolled_count.toLocaleString()} enrolled</span>
              </div>
              <p className="text-sm text-muted-foreground">Instructor: <span className="text-foreground font-semibold">{course.instructor}</span></p>
            </div>

            <div className="flex flex-col items-center gap-4 flex-shrink-0">
              <div className="relative">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke={progressColor} strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                    style={{ transition: "stroke-dashoffset 0.8s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold font-display" style={{ color: progressColor }}>{progress}%</span>
                  <span className="text-[10px] text-muted-foreground">complete</span>
                </div>
              </div>
              {totalCount > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  <span className="font-semibold text-foreground">{completedCount}</span> of <span className="font-semibold text-foreground">{totalCount}</span> materials completed
                </p>
              )}

              {quiz ? (
                <div className="flex flex-col items-center gap-2">
                  {progress >= 100 ? (
                    <Button asChild className="gradient-primary border-0 glow-sm hover:opacity-90 transition-opacity">
                      <Link to={`/quizzes/${quiz.id}`}>
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Take Quiz
                      </Link>
                    </Button>
                  ) : (
                    <>
                      <Button disabled variant="outline" className="border-border/60 opacity-60 cursor-not-allowed">
                        <Lock className="mr-2 h-4 w-4" /> Quiz Locked
                      </Button>
                      <p className="text-[10px] text-muted-foreground text-center">
                        Complete all materials to unlock
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Button disabled variant="outline" className="border-border/60 opacity-60 cursor-not-allowed">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> No Quiz Available
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">
                    This course doesn't have a quiz
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold font-display">Course Materials</h2>
        <div className="space-y-3">
          {materials.map((mat: { id: string; type: string; title: string; duration_minutes?: number }, idx: number) => {
            const Icon = typeIcon[mat.type as keyof typeof typeIcon] ?? Code;
            const cfg = typeConfig[mat.type as keyof typeof typeConfig] ?? typeConfig.tutorial;
            return (
              <Link key={mat.id} to={`/materials/${mat.id}`}
                className={`group flex items-center gap-4 rounded-2xl border p-4 transition-all duration-200 hover:bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 ${completedMaterialIds.has(mat.id) ? 'border-primary/25 bg-primary/5' : 'border-border/60 bg-card/60'}`}
              >
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${cfg.bg} border ${cfg.border} ${cfg.text} group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">{mat.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className={`font-medium ${cfg.text}`}>{cfg.label}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-transparent"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleBookmark.mutate({ 
                        materialId: mat.id, 
                        isBookmarked: bookmarkedMaterialIds.has(mat.id) 
                      });
                    }}
                    disabled={toggleBookmark.isPending}
                  >
                    <Bookmark className={`h-4 w-4 ${bookmarkedMaterialIds.has(mat.id) ? "fill-primary text-primary" : "text-muted-foreground hover:text-foreground"}`} />
                  </Button>
                  {completedMaterialIds.has(mat.id) && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-xs text-muted-foreground hidden sm:block">#{idx + 1}</span>
                  <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
