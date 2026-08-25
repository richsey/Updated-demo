import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ClipboardList, Lock, CheckCircle2, ArrowRight, HelpCircle, Loader2 } from "lucide-react";
import { useQuizzes, useCourses } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { computeCourseProgress } from "@/lib/api/progress";
import { fetchCourseProgressAPI } from "@/hooks/useProgressTracking";

interface ProgressInfo {
  progress: number;
  completed_materials: number;
  total_materials: number;
}

export default function QuizList() {
  const { user } = useAuth();
  const { data: quizzesRaw, isLoading: loadingQuizzes, isError: quizError, error: quizErrorMsg } = useQuizzes();
  const { data: coursesRaw, isLoading: loadingCourses, isError: courseError } = useCourses();
  const quizzes = quizzesRaw ?? [];
  const courses = coursesRaw ?? [];
  const [progressMap, setProgressMap] = useState<Record<string, ProgressInfo>>({});

  useEffect(() => {
    if (!user || courses.length === 0) return;
    const fetchAll = async () => {
      const entries = await Promise.all(
        courses.map(async (c) => {
          try {
            // Try new progress tracking API first
            const data = await fetchCourseProgressAPI(user.id, c.id);
            if (data.total_materials > 0) {
              return [c.id, data] as [string, ProgressInfo];
            }
          } catch (e) {
            console.warn("[QuizList] fetchCourseProgressAPI failed, using fallback:", e);
          }
          // Fallback to old progress calculation
          const pct = await computeCourseProgress(user.id, (c.materials ?? []) as { id: string; type: string }[]);
          return [c.id, { progress: pct, completed_materials: 0, total_materials: 0 }] as [string, ProgressInfo];
        })
      );
      setProgressMap(Object.fromEntries(entries));
    };
      fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, courses]);

  const isLoading = loadingQuizzes || loadingCourses;
  const isError = quizError || courseError;

  return (
    <div className="space-y-8 pb-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">Quizzes</h1>
        <p className="text-muted-foreground">Complete course materials to unlock and take quizzes</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : isError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm font-semibold text-destructive">Failed to load quizzes</p>
          <p className="text-xs text-muted-foreground mt-1">{(quizErrorMsg as { message?: string })?.message ?? "Please check your connection and try refreshing."}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {quizzes.map((quiz) => {
            const course = courses.find((c) => c.id === quiz.course_id);
            const progressInfo = progressMap[quiz.course_id];
            const progress = progressInfo?.progress ?? 0;
            const completedMats = progressInfo?.completed_materials ?? 0;
            const totalMats = progressInfo?.total_materials ?? 0;
            const unlocked = progress >= 100;
            const questions = quiz.questions ?? [];

            return (
              <div key={quiz.id}
                className={`relative rounded-2xl border p-6 transition-all duration-200 ${
                  unlocked ? "border-primary/25 bg-card card-hover" : "border-border/60 bg-card/50 opacity-80"
                }`}
              >
                <div className={`absolute top-4 right-4 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  unlocked ? "bg-primary/15 text-primary border border-primary/25" : "bg-secondary text-muted-foreground border border-border/60"
                }`}>
                  {unlocked ? <><CheckCircle2 className="h-3 w-3" /> Unlocked</> : <><Lock className="h-3 w-3" /> Locked</>}
                </div>

                <div className="flex items-start gap-4 mb-5 pr-20">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border ${
                    unlocked ? "bg-primary/10 border-primary/20 text-primary" : "bg-secondary border-border/60 text-muted-foreground"
                  }`}>
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold font-display text-base leading-tight">{quiz.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{course?.title}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <HelpCircle className="h-3.5 w-3.5" /> {questions.length} questions
                  </span>
                  {course && totalMats > 0 && (
                    <span className="font-semibold text-foreground">
                      {completedMats}/{totalMats} materials done
                    </span>
                  )}
                  {course && (
                    <span className={`font-semibold ${unlocked ? "text-primary" : "text-amber-600"}`}>
                      {Math.round(progress)}% complete
                    </span>
                  )}
                </div>

                {course && (
                  <div className="mb-5">
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(progress, 100)}%`,
                          background: unlocked
                            ? "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))"
                            : "linear-gradient(90deg, hsl(38 80% 50%), hsl(38 80% 60%))"
                        }}
                      />
                    </div>
                    {!unlocked && (
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Complete all materials to unlock this quiz
                      </p>
                    )}
                  </div>
                )}

                {unlocked ? (
                  <Button asChild className="gradient-primary border-0 glow-sm hover:opacity-90 transition-opacity w-full">
                    <Link to={`/quizzes/${quiz.id}`}>
                      Start Quiz <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button disabled variant="outline" className="w-full border-border/60 opacity-50 cursor-not-allowed">
                    <Lock className="mr-2 h-4 w-4" /> Complete course to unlock
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
