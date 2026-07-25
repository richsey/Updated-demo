import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { createLecturerCourse } from "@/lib/api/lecturer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, BookOpen, CheckCircle2, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const CATEGORIES = ["Frontend", "Backend", "Languages", "Styling", "Database", "DevOps", "Mobile", "AI/ML", "General"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
const FORMATS = ["video", "article", "interactive"] as const;

const THUMBNAIL_PRESETS = [
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800",
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800",
  "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800",
  "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800",
  "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800",
];

export default function CreateCourse() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "General",
    difficulty: "beginner" as typeof DIFFICULTIES[number],
    format: "video" as typeof FORMATS[number],
    thumbnail: THUMBNAIL_PRESETS[0],
    instructor: profile?.full_name ?? "",
    tags: "",
  });

  const [done, setDone] = useState(false);

  const createMutation = useMutation({
    mutationFn: () =>
      createLecturerCourse(user!.id, {
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecturer-courses"] });
      setDone(true);
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create course", description: err.message, variant: "destructive" });
    },
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold font-display">Course Created!</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          Your course has been saved as a <strong>Draft</strong>. Add materials and then submit it for admin review to publish it.
        </p>
        <div className="flex gap-3">
          <Link to="/lecturer/materials">
            <Button className="gradient-primary text-white border-0">Add Materials</Button>
          </Link>
          <Link to="/lecturer/courses">
            <Button variant="outline">View My Courses</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-6 max-w-2xl">
      <div className="space-y-1">
        <Link to="/lecturer/courses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Courses
        </Link>
        <h1 className="text-4xl font-bold font-display">Create New Course</h1>
        <p className="text-muted-foreground">Fill in the details below. Your course will start as a <strong>Draft</strong> until you submit it for review.</p>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="font-display text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-emerald-600" /> Course Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Course Title <span className="text-destructive">*</span></Label>
            <Input
              id="title"
              placeholder="e.g. Complete React Developer Bootcamp"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="border-border/60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description <span className="text-destructive">*</span></Label>
            <textarea
              id="description"
              placeholder="Describe what students will learn in this course..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full h-10 rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Difficulty Level</Label>
              <select
                value={form.difficulty}
                onChange={(e) => set("difficulty", e.target.value)}
                className="w-full h-10 rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {DIFFICULTIES.map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <select
                value={form.format}
                onChange={(e) => set("format", e.target.value)}
                className="w-full h-10 rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {FORMATS.map((f) => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructor">Instructor Name</Label>
              <Input
                id="instructor"
                placeholder="Your name"
                value={form.instructor}
                onChange={(e) => set("instructor", e.target.value)}
                className="border-border/60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Thumbnail</Label>
            <div className="grid grid-cols-3 gap-3">
              {THUMBNAIL_PRESETS.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => set("thumbnail", url)}
                  className={`rounded-xl overflow-hidden h-20 border-2 transition-all ${
                    form.thumbnail === url ? "border-emerald-500 ring-2 ring-emerald-500/30" : "border-border/60 hover:border-border"
                  }`}
                >
                  <img src={url} alt="thumbnail" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Or paste a custom URL:</p>
            <Input
              placeholder="https://..."
              value={form.thumbnail}
              onChange={(e) => set("thumbnail", e.target.value)}
              className="border-border/60 text-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags <span className="text-muted-foreground">(comma-separated)</span></Label>
            <Input
              id="tags"
              placeholder="e.g. react, hooks, typescript"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              className="border-border/60"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              className="gradient-primary text-white border-0 glow-sm flex-1"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.title.trim() || !form.description.trim()}
            >
              {createMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating…</>
              ) : (
                "Create Course"
              )}
            </Button>
            <Link to="/lecturer/courses">
              <Button variant="outline">Cancel</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
