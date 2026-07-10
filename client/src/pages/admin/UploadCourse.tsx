import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCoursesCache } from "@/lib/api/courses";

const CATEGORY_SUGGESTIONS = [
  "Mathematics", "Science", "History", "Geography", "English Literature",
  "Physics", "Chemistry", "Biology", "Economics", "Business",
  "Technology", "Computer Science", "Art", "Music", "Philosophy",
  "Psychology", "Sociology", "Political Science", "Law", "Health",
  "Nutrition", "Physical Education", "Languages", "Religion", "Ethics",
  "Frontend", "Backend", "Data Science", "Cloud Computing", "Cybersecurity",
];

const DEFAULT_THUMBNAILS: Record<string, string> = {
  mathematics: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800",
  science: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800",
  physics: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800",
  chemistry: "https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?w=800",
  biology: "https://images.unsplash.com/photo-1530026405186-ed1ea0ac7a63?w=800",
  history: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=800",
  geography: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800",
  business: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
  economics: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800",
  technology: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800",
  computer_science: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800",
  programming: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800",
  frontend: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800",
  backend: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800",
  art: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800",
  music: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",
  philosophy: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800",
  law: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800",
  health: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800",
  nutrition: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800",
};

function getThumbnailForCategory(categoryName: string): string {
  const norm = categoryName.toLowerCase().trim().replace(/\s+/g, "_");
  if (DEFAULT_THUMBNAILS[norm]) return DEFAULT_THUMBNAILS[norm];
  
  for (const [key, val] of Object.entries(DEFAULT_THUMBNAILS)) {
    if (norm.includes(key) || key.includes(norm)) {
      return val;
    }
  }
  return "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800";
}

export default function UploadCourse() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [format, setFormat] = useState<"video" | "article" | "interactive" | "">("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!category.trim()) {
      toast.error("Please enter a category.");
      return;
    }
    if (!format) {
      toast.error("Please select a course format.");
      return;
    }
    if (!difficulty) {
      toast.error("Please select a difficulty level.");
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);

    setSaving(true);
    const { error } = await (supabase.from("courses") as any).insert({
      title: formData.get("title") as string,
      description: formData.get("desc") as string,
      category: category.trim(),
      difficulty,
      format,
      thumbnail: getThumbnailForCategory(category),
      instructor: formData.get("instructor") as string,
      duration_minutes: parseInt(formData.get("duration") as string || "0"),
      enrolled_count: 0,
    });

    setSaving(false);
    if (error) {
      toast.error("Failed to create course: " + error.message);
    } else {
      toast.success("Course created successfully!");
      setSuccess(true);
      // Bust CacheManager custom cache so student portal gets fresh list
      await invalidateCoursesCache();
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      form.reset();
      setCategory("");
      setDifficulty("");
      setFormat("");
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Upload Course</h1>
        <p className="text-muted-foreground">Create a new course for any subject</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Course Title</Label>
              <Input id="title" name="title" placeholder="e.g. Introduction to Algebra" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" name="desc" placeholder="Course description..." rows={4} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                list="category-suggestions"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Mathematics, History..."
                required
              />
              <datalist id="category-suggestions">
                {CATEGORY_SUGGESTIONS.map(cat => <option key={cat} value={cat} />)}
              </datalist>
              <p className="text-xs text-muted-foreground">Type any subject — suggestions appear as you type</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Course Format</Label>
                <Select value={format} onValueChange={(val: any) => setFormat(val)}>
                  <SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video Course</SelectItem>
                    <SelectItem value="article">Article / Reading</SelectItem>
                    <SelectItem value="interactive">Interactive Lab</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Estimated Duration (minutes)</Label>
              <Input id="duration" name="duration" type="number" placeholder="120" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instructor">Instructor Name</Label>
              <Input id="instructor" name="instructor" placeholder="e.g. Jane Smith" required />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
              ) : success ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Course Created!</>
              ) : (
                "Create Course"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
