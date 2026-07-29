import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Zap, Loader2, CheckCircle2, XCircle, ArrowRight, RotateCcw,
  Brain, Trophy, Target, ChevronDown
} from "lucide-react";
import { useCourses } from "@/hooks/useSupabaseQuery";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Question {
  text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  order_index: number;
}

interface QuizResponse {
  questions: Question[];
  metadata: {
    course_title: string;
    course_category: string;
    difficulty: string;
    generation_method: string;
    elapsed_seconds: number;
    [key: string]: unknown;
  };
}

// ─── Constants ───────────────────────────────────────────────────────────────

const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8001";

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Beginner", desc: "Basic concepts & definitions", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { value: "intermediate", label: "Intermediate", desc: "Application & understanding", color: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "advanced", label: "Advanced", desc: "Analysis & edge cases", color: "text-rose-700 bg-rose-50 border-rose-200" },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PracticeQuiz() {
  const { data: rawCourses = [], isLoading: loadingCourses } = useCourses();
  
  // Filter out duplicate courses by title
  const uniqueCoursesMap = new Map();
  (rawCourses ?? []).forEach(course => {
    if (!uniqueCoursesMap.has(course.title)) {
      uniqueCoursesMap.set(course.title, course);
    }
  });
  const courses = Array.from(uniqueCoursesMap.values());

  // Setup state
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("intermediate");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Quiz state
  const [quizData, setQuizData] = useState<QuizResponse | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Play state
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // Phase: "setup" | "playing" | "results"
  const phase = !quizData ? "setup" : submitted ? "results" : "playing";

  // Auto-select first course
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // ─── Generate Quiz ──────────────────────────────────────────────────────────

  const generateQuiz = async () => {
    if (!selectedCourseId) return;

    setGenerating(true);
    setGenError(null);
    setQuizData(null);
    setCurrentQ(0);
    setAnswers([]);
    setSubmitted(false);

    try {
      const res = await fetch(`${AI_SERVICE_URL}/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: selectedCourseId,
          num_questions: 5,
          difficulty,
        }),
      });

      if (!res.ok) throw new Error(`AI service returned ${res.status}`);

      const data: QuizResponse = await res.json();

      if (!data.questions || data.questions.length === 0) {
        throw new Error("No questions generated");
      }

      setQuizData(data);
      setAnswers(new Array(data.questions.length).fill(null));
    } catch (err: Error | unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setGenError(
        msg.includes("Failed to fetch")
          ? "AI service is not running. Start it with: npm run dev"
          : msg
      );
    } finally {
      setGenerating(false);
    }
  };

  // ─── Quiz Logic ─────────────────────────────────────────────────────────────

  const handleSelect = (optionIndex: number) => {
    if (answers[currentQ] !== null) return; // Already answered
    const newAnswers = [...answers];
    newAnswers[currentQ] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQ === (quizData?.questions.length ?? 0) - 1) {
      setSubmitted(true);
    } else {
      setCurrentQ(currentQ + 1);
    }
  };

  const resetToSetup = () => {
    setQuizData(null);
    setCurrentQ(0);
    setAnswers([]);
    setSubmitted(false);
    setGenError(null);
  };

  // ─── Computed Values ────────────────────────────────────────────────────────

  const questions = quizData?.questions ?? [];
  const correctCount = answers.reduce(
    (acc, a, i) => acc + (a === questions[i]?.correct_index ? 1 : 0),
    0
  );
  const percentage = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // ─── SETUP PHASE ───────────────────────────────────────────────────────────

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display flex items-center gap-2">
            <Zap className="h-7 w-7 text-amber-400" />
            Practice Quiz
          </h1>
          <p className="text-muted-foreground mt-1">
            AI generates fresh questions every time — practice as much as you want
          </p>
        </div>

        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5">
          <CardContent className="p-6 space-y-5">
            {/* Course Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Choose a course</label>
              {loadingCourses ? (
                <div className="flex items-center gap-2 py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading courses...</span>
                </div>
              ) : (
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full flex items-center justify-between rounded-xl border border-border/60 bg-card/80 px-4 py-3 text-sm hover:border-violet-500/40 transition-colors"
                  >
                    <span>{selectedCourse?.title || "Select a course..."}</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-card shadow-lg max-h-60 overflow-y-auto">
                      {courses.map((course) => (
                        <button
                          key={course.id}
                          onClick={() => {
                            setSelectedCourseId(course.id);
                            setDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm hover:bg-muted/50 transition-colors first:rounded-t-xl last:rounded-b-xl ${
                            selectedCourseId === course.id ? "bg-violet-500/10 text-violet-400" : ""
                          }`}
                        >
                          <span className="font-medium">{course.title}</span>
                          <span className="text-xs text-muted-foreground ml-2">{course.category}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Difficulty Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Difficulty level</label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDifficulty(opt.value)}
                    className={`rounded-xl border p-3 text-center transition-all ${
                      difficulty === opt.value
                        ? `${opt.color} border-current`
                        : "border-border/60 hover:border-border text-muted-foreground"
                    }`}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-[10px] mt-0.5 opacity-70">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={generateQuiz}
              disabled={!selectedCourseId || generating}
              className="w-full gradient-primary border-0 glow-sm hover:opacity-90 transition-opacity h-12 text-base font-semibold"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Questions...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-5 w-5" />
                  Generate Practice Quiz
                </>
              )}
            </Button>

            {genError && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-sm space-y-1.5">
                <p className="font-semibold text-amber-400">AI Service Unavailable</p>
                <p className="text-xs text-muted-foreground">
                  The AI quiz generator requires the local AI service to be running.
                </p>
                <p className="text-xs font-mono bg-muted/60 px-2 py-1 rounded text-muted-foreground">
                  cd ai-service &amp;&amp; uvicorn main:app --port 8001
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Brain className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">How AI Practice Quizzes work</p>
              <p className="text-muted-foreground mt-1">
                The AI reads your course materials and generates fresh multiple-choice questions
                tailored to your chosen difficulty level. Practice quizzes are unlimited and don't
                affect your course grades — take them as many times as you want!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── PLAYING PHASE ─────────────────────────────────────────────────────────

  if (phase === "playing") {
    const question = questions[currentQ];
    const isAnswered = answers[currentQ] !== null;
    const isLast = currentQ === questions.length - 1;

    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-violet-400 border-violet-500/30 bg-violet-500/10">
                <Zap className="h-3 w-3 mr-1" /> Practice
              </Badge>
              <span className="text-sm text-muted-foreground">{quizData?.metadata.course_title}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Question {currentQ + 1} of {questions.length}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={resetToSetup} className="text-xs text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> New Quiz
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-1">
          {questions.map((_, i) => {
            const answered = answers[i] !== null;
            const correct = answered && answers[i] === questions[i]?.correct_index;
            return (
              <div
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i === currentQ
                    ? "bg-violet-400"
                    : answered
                      ? correct
                        ? "bg-emerald-400"
                        : "bg-red-400"
                      : "bg-muted"
                }`}
              />
            );
          })}
        </div>

        {/* Question Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-display">{question.text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {question.options.map((opt, i) => {
              const selected = answers[currentQ] === i;
              const isCorrect = isAnswered && i === question.correct_index;
              const isWrong = isAnswered && selected && i !== question.correct_index;

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={isAnswered}
                  className={`w-full text-left rounded-lg border p-4 text-sm transition-all ${
                    isCorrect
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : isWrong
                        ? "border-red-500 bg-red-500/10 text-red-400"
                        : selected
                          ? "border-violet-500 bg-violet-500/5"
                          : "border-border/60 hover:border-violet-500/40 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />}
                    {isWrong && <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />}
                    <span>{opt}</span>
                  </div>
                </button>
              );
            })}

            {/* Explanation */}
            {isAnswered && question.explanation && (
              <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm border border-border/40">
                <p className="font-medium text-foreground">💡 Explanation:</p>
                <p className="text-muted-foreground mt-1">{question.explanation}</p>
              </div>
            )}

            {/* Next Button */}
            {isAnswered && (
              <Button onClick={handleNext} className="w-full mt-4 gradient-primary border-0">
                {isLast ? "See Results" : "Next Question"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── RESULTS PHASE ─────────────────────────────────────────────────────────

  const passed = percentage >= 70;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      {/* Score Card */}
      <div className="text-center space-y-4">
        <div
          className={`inline-flex h-20 w-20 items-center justify-center rounded-full mx-auto ${
            passed ? "bg-emerald-500/15" : "bg-red-500/15"
          }`}
        >
          {passed ? (
            <Trophy className="h-10 w-10 text-emerald-400" />
          ) : (
            <Target className="h-10 w-10 text-red-400" />
          )}
        </div>

        <div>
          <Badge variant="outline" className="text-violet-400 border-violet-500/30 bg-violet-500/10 mb-2">
            <Zap className="h-3 w-3 mr-1" /> Practice Quiz
          </Badge>
          <h1 className="text-3xl font-bold font-display">
            {passed ? "Great job!" : "Keep practicing!"}
          </h1>
          <p className="text-muted-foreground mt-1">{quizData?.metadata.course_title}</p>
        </div>

        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold font-display">{correctCount}/{questions.length}</p>
            <p className="text-xs text-muted-foreground">Correct</p>
          </div>
          <div className={`text-center px-4 py-2 rounded-xl border ${
            passed
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}>
            <p className="text-2xl font-bold">{percentage.toFixed(0)}%</p>
            <p className="text-[10px]">{passed ? "Passed" : "Below 70%"}</p>
          </div>
        </div>
      </div>

      {/* Answer Review */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Answer Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.map((q, i) => {
            const userAnswer = answers[i];
            const correct = userAnswer === q.correct_index;
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 text-sm ${
                  correct
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-red-500/20 bg-red-500/5"
                }`}
              >
                <div className="flex items-start gap-2">
                  {correct ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{q.text}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your answer: <span className={correct ? "text-emerald-400" : "text-red-400"}>
                        {q.options[userAnswer ?? 0]}
                      </span>
                      {!correct && (
                        <> · Correct: <span className="text-emerald-400">{q.options[q.correct_index]}</span></>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={generateQuiz} className="flex-1 gradient-primary border-0 glow-sm">
          <Zap className="mr-2 h-4 w-4" /> Generate Another
        </Button>
        <Button variant="outline" onClick={resetToSetup} className="flex-1">
          <RotateCcw className="mr-2 h-4 w-4" /> Change Topic
        </Button>
      </div>

      {/* Metadata */}
      {quizData?.metadata && (
        <p className="text-center text-[10px] text-muted-foreground">
          Generated by {quizData.metadata.generation_method === "llm" ? "GPT-4o" : "AI Engine"} in {quizData.metadata.elapsed_seconds?.toFixed(1)}s
        </p>
      )}
    </div>
  );
}
