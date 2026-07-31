// Lecturer Quiz Builder — create quizzes for own courses
// Wraps the same Supabase logic as admin CreateQuiz but scoped to lecturer's courses

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLecturerCourses } from "@/lib/api/lecturer";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList, Plus, Trash2, Loader2, CheckCircle2, ArrowLeft, X, Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface QuizQuestion {
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
}

const emptyQuestion = (): QuizQuestion => ({
  question: "",
  options: ["", "", "", ""],
  correct_answer: "",
  explanation: "",
});

export default function LecturerQuizBuilder() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["lecturer-courses", user?.id],
    queryFn: () => fetchLecturerCourses(user!.id),
    enabled: !!user,
  });

  const [courseId, setCourseId] = useState("");
  const [quizTitle, setQuizTitle] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([emptyQuestion()]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const setQ = (index: number, field: keyof QuizQuestion, value: string | string[]) =>
    setQuestions((prev) => prev.map((q, i) => i === index ? { ...q, [field]: value } : q));

  const setOption = (qIndex: number, optIndex: number, value: string) =>
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const options = [...q.options];
        options[optIndex] = value;
        return { ...q, options };
      })
    );

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);
  const removeQuestion = (index: number) =>
    setQuestions((prev) => prev.filter((_, i) => i !== index));

  const handleAIGenerate = async () => {
    if (!courseId) {
      toast({ title: "Please select a course first.", variant: "destructive" });
      return;
    }
    
    setGenerating(true);
    try {
      const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8001";
      const response = await fetch(`${AI_SERVICE_URL}/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: courseId,
          num_questions: 5,
          difficulty: "intermediate"
        }),
      });

      if (!response.ok) throw new Error("Failed to generate questions");
      
      const data = await response.json();
      if (!data.questions || data.questions.length === 0) {
        throw new Error("No questions returned from AI");
      }

      const aiQuestions = data.questions.map((q: { text: string; options: string[]; correct_index: number; explanation: string }) => ({
        question: q.text,
        options: q.options,
        correct_answer: q.options[q.correct_index],
        explanation: q.explanation || "",
      }));

      if (questions.length === 1 && !questions[0].question.trim()) {
        setQuestions(aiQuestions);
      } else {
        setQuestions(prev => [...prev, ...aiQuestions]);
      }

      toast({ 
        title: "AI Generation Complete!", 
        description: `Successfully added ${aiQuestions.length} questions.` 
      });
      
    } catch (err: Error | unknown) {
      console.error(err);
      toast({ 
        title: "AI Generation Failed", 
        description: err instanceof Error ? err.message : "An unknown error occurred", 
        variant: "destructive" 
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!courseId) { toast({ title: "Please select a course.", variant: "destructive" }); return; }
    if (!quizTitle.trim()) { toast({ title: "Please add a quiz title.", variant: "destructive" }); return; }
    if (questions.some((q) => !q.question.trim() || !q.correct_answer)) {
      toast({ title: "Please complete all questions.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // 1. Create the quiz
      const { data: quiz, error: quizErr } = await supabase
        .from("quizzes")
        // @ts-expect-error Supabase schema divergence
        .insert([{ course_id: courseId, title: quizTitle }])
        .select()
        .single();

      if (quizErr) throw quizErr;
      if (!quiz) throw new Error("Failed to create quiz");

      // 2. Insert all questions
      const questionRows = questions.map((q, i) => ({
        quiz_id: (quiz as unknown as { id: string }).id,
        question: q.question,
        options: q.options.filter(Boolean),
        correct_answer: q.correct_answer,
        explanation: q.explanation || null,
        order_index: i,
      }));

      // @ts-expect-error Supabase schema divergence
      const { error: qErr } = await supabase.from("quiz_questions").insert(questionRows);
      if (qErr) throw qErr;

      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      setDone(true);
    } catch (err: Error | unknown) {
      toast({ title: "Failed to save quiz", description: err instanceof Error ? err.message : "An unknown error occurred", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 border border-success/20">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-2xl font-bold font-display">Quiz Created!</h2>
        <p className="text-muted-foreground text-sm">Your quiz has been added to the course.</p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => { setDone(false); setCourseId(""); setQuizTitle(""); setQuestions([emptyQuestion()]); }}
          >
            Create Another
          </Button>
          <Link to="/lecturer/courses"><Button className="gradient-primary text-white border-0">View My Courses</Button></Link>
        </div>
      </div>
    );
  }

  const eligibleCourses = courses.filter((c) => ["published", "draft"].includes(c.status));

  return (
    <div className="space-y-8 pb-6 max-w-3xl">
      <div className="space-y-1">
        <Link to="/lecturer/courses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Courses
        </Link>
        <h1 className="text-4xl font-bold font-display">Quiz Builder</h1>
        <p className="text-muted-foreground">Create a quiz for one of your courses.</p>
      </div>

      {/* Quiz meta */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-success" /> Quiz Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Course <span className="text-destructive">*</span></Label>
            {loadingCourses ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="border-border/60">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {eligibleCourses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Quiz Title <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. Week 1 Assessment"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              className="border-border/60"
            />
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, qi) => (
          <Card key={qi} className="border-border/60 relative">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs">Question {qi + 1}</Badge>
                {questions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeQuestion(qi)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label>Question</Label>
                <Input
                  placeholder="Enter your question..."
                  value={q.question}
                  onChange={(e) => setQ(qi, "question", e.target.value)}
                  className="border-border/60"
                />
              </div>

              <div className="space-y-2">
                <Label>Answer Options</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-4">
                        {String.fromCharCode(65 + oi)}.
                      </span>
                      <Input
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        value={opt}
                        onChange={(e) => setOption(qi, oi, e.target.value)}
                        className="border-border/60 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Correct Answer</Label>
                  <Select value={q.correct_answer} onValueChange={(v) => setQ(qi, "correct_answer", v)}>
                    <SelectTrigger className="border-border/60">
                      <SelectValue placeholder="Select correct option" />
                    </SelectTrigger>
                    <SelectContent>
                      {q.options.filter(Boolean).map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Explanation <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    placeholder="Why is this correct?"
                    value={q.explanation}
                    onChange={(e) => setQ(qi, "explanation", e.target.value)}
                    className="border-border/60"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-dashed border-success/30 text-success hover:bg-success/10 gap-2"
            onClick={addQuestion}
          >
            <Plus className="h-4 w-4" /> Add Question
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-dashed border-accent/30 text-accent hover:bg-accent/10 gap-2"
            onClick={handleAIGenerate}
            disabled={generating}
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Auto-Generate with AI</>
            )}
          </Button>
        </div>
      </div>

      <Button
        className="w-full gradient-primary text-white border-0 glow-sm"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving Quiz…</> : "Save Quiz"}
      </Button>
    </div>
  );
}
