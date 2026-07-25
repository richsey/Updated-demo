// src/pages/admin/ManageQuestions.tsx
// Admin page to add, view and delete quiz questions

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useCourses } from "@/hooks/useSupabaseQuery";
import { toast } from "sonner";
import { Loader2, Trash2, Plus, CheckCircle2, HelpCircle, ChevronDown } from "lucide-react";

interface Quiz {
  id: string;
  title: string;
  course_id: string;
}

interface Question {
  id: string;
  text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  order_index: number;
}

const EMPTY_FORM = {
  text: "",
  options: ["", "", "", ""],
  correct_index: 0,
  explanation: "",
};

export default function ManageQuestions() {
  const { data: courses = [], isLoading: loadingCourses } = useCourses();

  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  // Fetch quizzes when course changes
  useEffect(() => {
    if (!selectedCourseId) { setQuizzes([]); setSelectedQuizId(""); return; }
    setLoadingQuizzes(true);
    const fetchQuizzes = async () => {
      try {
        const { data } = await supabase.from("quizzes")
          .select("*")
          .eq("course_id", selectedCourseId)
          .order("created_at", { ascending: true });
        setQuizzes(data ?? []);
        setSelectedQuizId("");
        setQuestions([]);
      } finally {
        setLoadingQuizzes(false);
      }
    };
    fetchQuizzes();
  }, [selectedCourseId]);

  // Fetch questions when quiz changes
  useEffect(() => {
    if (!selectedQuizId) { setQuestions([]); return; }
    setLoadingQuestions(true);
    const fetchQuestions = async () => {
      try {
        const { data } = await supabase.from("questions")
          .select("*")
          .eq("quizzes_id", selectedQuizId)
          .order("order_index", { ascending: true });
        setQuestions(data ?? []);
      } finally {
        setLoadingQuestions(false);
      }
    };
    fetchQuestions();
  }, [selectedQuizId]);

  const handleOptionChange = (index: number, value: string) => {
    const opts = [...form.options];
    opts[index] = value;
    setForm(f => ({ ...f, options: opts }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) { toast.error("Select a quiz first."); return; }
    if (!form.text.trim()) { toast.error("Question text is required."); return; }
    if (form.options.some(o => !o.trim())) { toast.error("All 4 options are required."); return; }
    if (!form.explanation.trim()) { toast.error("Explanation is required."); return; }

    setSaving(true);
    // @ts-expect-error Supabase schema divergence
    const { error } = await supabase.from("questions").insert({
      quizzes_id: selectedQuizId,
      text: form.text.trim(),
      options: form.options.map(o => o.trim()),
      correct_index: form.correct_index,
      explanation: form.explanation.trim(),
      order_index: questions.length,
    });

    setSaving(false);
    if (error) {
      toast.error("Failed to add question: " + error.message);
    } else {
      toast.success("Question added!");
      setForm(EMPTY_FORM);
      // Refresh questions list
      const { data } = await supabase.from("questions")
        .select("*")
        .eq("quizzes_id", selectedQuizId)
        .order("order_index", { ascending: true });
      setQuestions(data ?? []);
    }
  };

  const handleDelete = async (questionId: string) => {
    setDeletingId(questionId);
    const { error } = await supabase.from("questions")
      .delete()
      .eq("id", questionId);
    setDeletingId(null);
    if (error) {
      toast.error("Failed to delete question.");
    } else {
      toast.success("Question deleted.");
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    }
  };

  const selectedQuiz = quizzes.find(q => q.id === selectedQuizId);

  return (
    <div className="space-y-8 pb-10 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold font-display">Manage Questions</h1>
        <p className="text-muted-foreground mt-1">Add, view, and delete quiz questions</p>
      </div>

      {/* ─── Course + Quiz selectors ─────────────────────────────────────── */}
      <Card>
        <CardContent className="p-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Course</Label>
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger>
                <SelectValue placeholder={loadingCourses ? "Loading..." : "Select course"} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Quiz</Label>
            <Select
              value={selectedQuizId}
              onValueChange={setSelectedQuizId}
              disabled={!selectedCourseId || loadingQuizzes}
            >
              <SelectTrigger>
                <SelectValue placeholder={
                  loadingQuizzes ? "Loading..." :
                  !selectedCourseId ? "Select a course first" :
                  quizzes.length === 0 ? "No quizzes for this course" :
                  "Select quiz"
                } />
              </SelectTrigger>
              <SelectContent>
                {quizzes.map(q => (
                  <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedQuiz && (
        <>
          {/* ─── Existing Questions ──────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                {selectedQuiz.title}
                <Badge variant="secondary" className="ml-auto text-xs">
                  {questions.length} question{questions.length !== 1 ? "s" : ""}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingQuestions ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : questions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                  <span className="text-3xl">📝</span>
                  <span>No questions yet — add the first one below.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="group rounded-xl border border-border/60 bg-card/60 p-4 flex gap-4 hover:border-primary/20 transition-colors"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-sm font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="font-medium text-sm leading-snug">{q.text}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {q.options.map((opt, i) => (
                            <div
                              key={i}
                              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs border ${
                                i === q.correct_index
                                  ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                                  : "border-border/40 text-muted-foreground"
                              }`}
                            >
                              {i === q.correct_index && <CheckCircle2 className="h-3 w-3 flex-shrink-0" />}
                              <span className="truncate">{opt}</span>
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-2">
                            💡 {q.explanation}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(q.id)}
                        disabled={deletingId === q.id}
                      >
                        {deletingId === q.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Trash2 className="h-4 w-4" />
                        }
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─── Add New Question Form ───────────────────────────────────── */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Add New Question
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Question text */}
                <div className="space-y-2">
                  <Label htmlFor="q-text">Question Text</Label>
                  <Textarea
                    id="q-text"
                    placeholder="e.g. What is the purpose of the useEffect hook in React?"
                    rows={3}
                    value={form.text}
                    onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
                    required
                    className="resize-none"
                  />
                </div>

                {/* Options */}
                <div className="space-y-2">
                  <Label>Answer Options</Label>
                  <p className="text-xs text-muted-foreground">Fill in all 4 options and select the correct one.</p>
                  <div className="grid gap-2">
                    {form.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, correct_index: i }))}
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-all ${
                            form.correct_index === i
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                              : "border-border/60 text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-400"
                          }`}
                          title="Mark as correct answer"
                        >
                          {form.correct_index === i
                            ? <CheckCircle2 className="h-4 w-4" />
                            : <span>{String.fromCharCode(65 + i)}</span>
                          }
                        </button>
                        <Input
                          placeholder={`Option ${String.fromCharCode(65 + i)}`}
                          value={opt}
                          onChange={e => handleOptionChange(i, e.target.value)}
                          required
                          className={form.correct_index === i ? "border-emerald-500/30 focus-visible:ring-emerald-500/20" : ""}
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Click a letter button to mark that option as the correct answer.
                    Currently selected: <span className="text-emerald-400 font-bold">Option {String.fromCharCode(65 + form.correct_index)}</span>
                  </p>
                </div>

                {/* Explanation */}
                <div className="space-y-2">
                  <Label htmlFor="q-explanation">Explanation</Label>
                  <Textarea
                    id="q-explanation"
                    placeholder="Explain why the correct answer is right (shown to students after they answer)."
                    rows={2}
                    value={form.explanation}
                    onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
                    required
                    className="resize-none"
                  />
                </div>

                <Button type="submit" disabled={saving} className="w-full gradient-primary border-0 h-11 font-semibold">
                  {saving
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                    : <><Plus className="mr-2 h-4 w-4" />Add Question</>
                  }
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
