import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCourses } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCoursesCache } from "@/lib/api/courses";

export default function UploadMaterial() {
  const queryClient = useQueryClient();
  const { data: courses = [], isLoading: loadingCourses } = useCourses();
  const [courseId, setCourseId] = useState("");
  const [matType, setMatType] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!courseId) { toast.error("Please select a course."); return; }
    if (!matType) { toast.error("Please select a material type."); return; }

    const form = e.currentTarget;
    const data = new FormData(form);
    setSaving(true);

    const maxOrder = await supabase
      .from("materials")
      .select("order_index")
      .eq("course_id", courseId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextIndex = ((maxOrder.data as any)?.order_index ?? 0) + 1;

    const { error } = await (supabase.from("materials") as any).insert({
      course_id: courseId,
      title: data.get("title") as string,
      type: matType,
      url: data.get("url") as string || "",
      duration_minutes: parseInt(data.get("duration") as string || "0"),
      order_index: nextIndex,
    });

    setSaving(false);
    if (error) {
      toast.error("Failed to upload material: " + error.message);
    } else {
      toast.success("Material uploaded successfully!");
      // Bust caches so the student portal immediately shows the new material
      await invalidateCoursesCache();
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      form.reset();
      setCourseId("");
      setMatType("");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">Upload Material</h1>
        <p className="text-muted-foreground">Add learning material to a course</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger><SelectValue placeholder={loadingCourses ? "Loading..." : "Select course"} /></SelectTrigger>
                <SelectContent>
                  {courses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {!loadingCourses && courses.length === 0 && (
                <p className="text-xs text-destructive">No courses found. Create a course first.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Material Title</Label>
              <Input id="title" name="title" placeholder="e.g. Introduction to the Topic" required />
            </div>
            <div className="space-y-2">
              <Label>Material Type</Label>
              <Select value={matType} onValueChange={setMatType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="tutorial">Interactive Tutorial</SelectItem>
                  <SelectItem value="article">Article / Reading</SelectItem>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL (optional)</Label>
              <Input id="url" name="url" placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input id="duration" name="duration" type="number" placeholder="15" required />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Upload Material"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
