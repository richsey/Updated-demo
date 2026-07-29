import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { shuffleArray } from "@/lib/shuffle";
import { detectGuessing, startCooldown, isQuizLocked } from "@/lib/quizGuard";
import { getPrerequisites, shouldStepBack } from "@/lib/adaptiveEngine";
import { trackQuizFailure, trackQuizLocked } from "@/lib/telemetry/studentTracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { useQuiz, useSaveQuizAttempt } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/lib/supabase";
import { computeCourseProgress, syncCourseProgress } from "@/lib/api/progress";
import { fetchCourseProgressAPI } from "@/hooks/useProgressTracking";
import type { Database } from "@/lib/database.types";

type Question = Database["public"]["Tables"]["questions"]["Row"];

export default function QuizPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: quiz, isLoading, isError } = useQuiz(quizId);
  const saveAttempt = useSaveQuizAttempt();

  const [startTime, setStartTime] = useState<number>(Date.now());
  const [quizLocked, setQuizLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [progressPct, setProgressPct] = useState(100); // default unlocked
  const [randomizedQuestions, setRandomizedQuestions] = useState<Question[]>(
    [],
  );
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Check lock + progress guard on load
  useEffect(() => {
    if (!quiz || !user) return;

    // Cooldown guard
    const checkLock = async () => {
      const locked = await isQuizLocked(user.id, quizId!);
      if (locked) {
        setQuizLocked(true);
        setLockReason("cooldown");
      }
    };
    checkLock();

    setStartTime(Date.now());

    // Check course progress gate
    const checkProgress = async () => {
      try {
        const { progress } = await syncCourseProgress(user.id, quiz.course_id);
        setProgressPct(progress);
        if (progress < 100) {
          setAccessDenied(true);
          await trackQuizLocked(user.id, quizId!, progress);
        }
      } catch (err) {
        console.error("Failed to check course progress:", err);
        setAccessDenied(true);
        await trackQuizLocked(user.id, quizId!, 0);
      }
    };
    checkProgress();

    // Check step-back lock via Supabase telemetry
    supabase.from("telemetry")
      .select("metadata")
      .eq("user_id", user.id)
      .eq("event_type", "quiz_stepback")
      .eq("entity_id", quizId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }: { data: Array<{ metadata: Record<string, unknown> }> | null }) => {
        if (data && data.length > 0) {
          const prereqCourseId = (data[0].metadata as { prereqCourseId?: string })?.prereqCourseId;
          if (prereqCourseId) {
            setQuizLocked(true);
            setLockReason(`requires_${prereqCourseId}`);
          }
        }
      });

    setRandomizedQuestions(shuffleArray([...(quiz.questions ?? [])]));
  }, [quiz, user, quizId]);

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !quiz) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold font-display">Quiz not found</h2>
        <p className="text-muted-foreground mt-2">
          This quiz could not be loaded. It may not exist or there was a
          connection issue.
        </p>
        <Button asChild className="mt-4">
          <Link to="/courses">Back to Courses</Link>
        </Button>
      </div>
    );
  }

  // ─── Micro-gating ──────────────────────────────────────────────────────────
  if (accessDenied) {
    return (
      <div className="text-center py-20 mx-auto max-w-md space-y-4">
        <h2 className="text-2xl font-bold font-display text-destructive">
          Quiz Locked
        </h2>
        <p className="text-muted-foreground">
          You must complete all course materials before
          unlocking this quiz. You have completed {progressPct}% so far.
        </p>
        <Button asChild className="mt-4">
          <Link to={`/courses/${quiz.course_id}`}>Return to Course</Link>
        </Button>
      </div>
    );
  }

  // ─── Quiz/step-back locked ─────────────────────────────────────────────────
  if (quizLocked) {
    if (lockReason?.startsWith("requires_")) {
      const prereqCourseId = lockReason.replace("requires_", "");
      return (
        <div className="text-center py-20 mx-auto max-w-md space-y-4">
          <h2 className="text-2xl font-bold font-display text-destructive">
            Step-Back Protocol Triggered
          </h2>
          <p className="text-muted-foreground">
            You have failed this quiz multiple times. Please review the
            prerequisite material before trying again.
          </p>
          <Button asChild className="mt-4">
            <Link to={`/courses/${prereqCourseId}`}>Review Prerequisite</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="text-center py-20 mx-auto max-w-md space-y-4">
        <h2 className="text-2xl font-bold font-display text-destructive">
          Quiz Locked
        </h2>
        <p className="text-muted-foreground">
          You finished too quickly previously! Please review the material and
          try again later.
        </p>
        <Button asChild className="mt-4">
          <Link to="/courses">Back to Courses</Link>
        </Button>
      </div>
    );
  }

  // Questions are set by a useEffect — show spinner while they initialise.
  // If they're still empty after the quiz has loaded, show an error message.
  if (randomizedQuestions.length === 0) {
    // Effect hasn't run yet (will run on next render after quiz load)
    // We rely on React's re-render cycle — if quiz is set but questions are
    // still empty it means the quiz has no questions in the database.
    const hasNoQuestions = quiz && (!quiz.questions || quiz.questions.length === 0);
    if (hasNoQuestions) {
      return (
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold font-display">No Questions Available</h2>
          <p className="text-muted-foreground mt-2">
            This quiz doesn't have any questions yet.
          </p>
          <Button asChild className="mt-4">
            <Link to={`/courses/${quiz.course_id}`}>Back to Course</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Question variables ────────────────────────────────────────────────────
  const question = randomizedQuestions[currentQ];
  const isAnswered =
    answers[currentQ] !== undefined && answers[currentQ] !== null;
  const isLast = currentQ === randomizedQuestions.length - 1;

  const correctAnswersCount = answers.reduce(
    (acc, a, i) => acc + (a === randomizedQuestions[i]?.correct_index ? 1 : 0),
    0,
  );
  const percentage = (correctAnswersCount / randomizedQuestions.length) * 100;

  const handleSelect = (optionIndex: number) => {
    if (isAnswered) return;
    const newAnswers = [...answers];
    newAnswers[currentQ] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleNext = async () => {
    if (isLast) {
      const timeTaken = (Date.now() - startTime) / 1000;
      if (detectGuessing(timeTaken)) {
        await startCooldown(user!.id, quiz.id);
        alert("You finished too quickly! Please review the material.");
        window.location.reload();
        return;
      }

      setSubmitted(true);

      // Save attempt to Supabase
      if (user) {
        saveAttempt.mutate({
          quiz_id: quiz.id,
          score: correctAnswersCount,
          total_questions: randomizedQuestions.length,
          duration_seconds: Math.floor((Date.now() - startTime) / 1000),
        });
      }

      // Failure tracking
      if (percentage < 70 && user) {
        const hasFailedMultiple = await trackQuizFailure(user.id, quiz.id);
        if (hasFailedMultiple) {
          const prereqCourseName =
            getPrerequisites(quiz.title)[0] || "React Fundamentals";
          const { data: prereqCourse } = await supabase
            .from("courses")
            .select("id")
            .eq("title", prereqCourseName)
            .maybeSingle();

          const prereqCourseId = prereqCourse ? (prereqCourse as unknown as { id: string }).id : quiz.course_id;

          // Store step-back in Supabase telemetry
          if (prereqCourse) {
        // @ts-expect-error Supabase schema divergence
        supabase.from("telemetry").insert([
          {
            user_id: user.id,
            event_type: "quiz_stepback",
            entity_id: quizId,
            metadata: { prereqCourseId: (prereqCourse as unknown as { id: string }).id },
          }
        ]).then(() => {});
      }setLockReason(`requires_${prereqCourseId}`);
          setQuizLocked(true);
          toast({
            title: "Step-Back Protocol Active",
            description:
              "You've failed twice. The quiz is locked until you complete the prerequisite module.",
            variant: "destructive",
          });
        }
      }

      if (shouldStepBack(percentage)) {
        const prereq = getPrerequisites(quiz.title);
        console.log("Student struggling. Recommend:", prereq);
      }
    } else {
      setCurrentQ(currentQ + 1);
    }
  };

  // ─── Results view ──────────────────────────────────────────────────────────
  if (submitted) {
    const passed = percentage >= 70;
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-center py-10">
        <div
          className={`inline-flex h-20 w-20 items-center justify-center rounded-full mx-auto ${passed ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}
        >
          {passed ? (
            <CheckCircle2 className="h-10 w-10" />
          ) : (
            <span className="text-3xl">😔</span>
          )}
        </div>
        <h1 className="text-4xl font-bold font-display">Quiz Complete!</h1>
        <p className="text-xl">
          Your score: {correctAnswersCount} / {randomizedQuestions.length} (
          {percentage.toFixed(0)}%)
        </p>
        <p
          className={`text-sm font-semibold ${passed ? "text-primary" : "text-destructive"}`}
        >
          {passed ? "🎉 You passed!" : "You need 70% to pass. Keep studying!"}
        </p>

        {percentage < 50 && (
          <div className="bg-yellow-500/10 p-6 rounded-lg mt-6 border border-yellow-500/30 text-left">
            <h3 className="font-bold mb-2 text-yellow-600 dark:text-yellow-400 text-lg">
              You may need to review these topics first:
            </h3>
            <ul className="list-disc pl-5 text-yellow-700 dark:text-yellow-300">
              {getPrerequisites(quiz.title).map((p) => (
                <li key={p} className="mb-1">
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 justify-center mt-8">
          <Button asChild>
            <Link to="/courses">Return to Courses</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/courses/${quiz.course_id}`)}
          >
            Back to Course
          </Button>
        </div>
      </div>
    );
  }

  // ─── Standard quiz view ────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/courses"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div>
        <h1 className="text-2xl font-bold font-display">{quiz.title}</h1>
        <p className="text-sm text-muted-foreground">
          Question {currentQ + 1} of {randomizedQuestions.length}
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1">
        {randomizedQuestions.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= currentQ ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-display">
            {question.text}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {question.options.map((opt: string, i: number) => {
            const selected = answers[currentQ] === i;
            const isCorrect = isAnswered && i === question.correct_index;
            const isWrong =
              isAnswered && selected && i !== question.correct_index;
            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={isAnswered}
                className={`w-full text-left rounded-lg border p-4 text-sm transition-all ${
                  isCorrect
                    ? "border-primary bg-primary/10 text-primary"
                    : isWrong
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : selected
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/40 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {isCorrect && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                  <span>{opt}</span>
                </div>
              </button>
            );
          })}

          {isAnswered && question.explanation && (
            <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm">
              <p className="font-medium">Explanation:</p>
              <p className="text-muted-foreground">{question.explanation}</p>
            </div>
          )}

          {isAnswered && (
            <Button onClick={handleNext} className="w-full mt-4">
              {isLast ? "Submit Quiz" : "Next Question"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
