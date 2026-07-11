import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useCourses } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface QuestionForm {
  text: string;
  options: string[];
  correctIndex: number;
}

export default function CreateQuiz() {
  const { data: courses = [], isLoading: loadingCourses } = useCourses();
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<QuestionForm[]>([
    { text: "", options: ["", "", "", ""], correctIndex: 0 },
  ]);

  const addQuestion = () => setQuestions([...questions, { text: "", options: ["", "", "", ""], correctIndex: 0 }]);
  const removeQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) { toast.error("Please select a course"); return; }
    setSaving(true);

    const { data: quiz, error } = await (supabase.from("quizzes") as any)
      .insert({ course_id: courseId, title })
      .select()
      .single();

    if (error || !quiz) { toast.error("Failed to create quiz"); setSaving(false); return; }

    const rows = questions.map((q, i) => ({
      quizzes_id: quiz.id,
      text: q.text,
      options: q.options,
      correct_index: q.correctIndex,
      explanation: "",
      order_index: i + 1,
    }));

    const { error: qErr } = await (supabase.from("questions") as any).insert(rows);
    setSaving(false);
    if (qErr) toast.error("Quiz created but questions failed to save");
    else {
      toast.success("Quiz created successfully!");
      setTitle(""); setCourseId("");
      setQuestions([{ text: "", options: ["", "", "", ""], correctIndex: 0 }]);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Create Quiz</h1>
        <p className="text-muted-foreground">Build a quiz for a course</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingCourses ? "Loading..." : "Select course"} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Quiz Title</Label>
              <Input id="title" placeholder="e.g. React Fundamentals Quiz" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
          </CardContent>
        </Card>

        {questions.map((q, qi) => (
          <Card key={qi}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-display">Question {qi + 1}</CardTitle>
              {questions.length > 1 && (
                <Button type="button" size="sm" variant="ghost" onClick={() => removeQuestion(qi)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Question text" value={q.text} onChange={(e) => {
                const updated = [...questions]; updated[qi].text = e.target.value; setQuestions(updated);
              }} required />
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${qi}`} checked={q.correctIndex === oi} onChange={() => {
                    const updated = [...questions]; updated[qi].correctIndex = oi; setQuestions(updated);
                  }} className="accent-primary" />
                  <Input placeholder={`Option ${oi + 1}`} value={opt} onChange={(e) => {
                    const updated = [...questions]; updated[qi].options[oi] = e.target.value; setQuestions(updated);
                  }} required />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Select the radio button next to the correct answer</p>
            </CardContent>
          </Card>
        ))}

        <Button type="button" variant="outline" onClick={addQuestion} className="w-full">
          <Plus className="mr-2 h-4 w-4" />Add Question
        </Button>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Create Quiz"}
        </Button>
      </form>
    </div>
  );
}
