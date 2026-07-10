import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Plus, Loader2, X, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useCourses } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/lib/supabase";
import { invalidateCoursesCache } from "@/lib/api/courses";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface CourseEditForm {
  title: string;
  description: string;
  category: string;
  difficulty: string;
  instructor: string;
  duration_minutes: number;
}

const CATEGORY_SUGGESTIONS = [
  "Mathematics", "Science", "History", "Geography", "English Literature",
  "Physics", "Chemistry", "Biology", "Economics", "Business",
  "Technology", "Computer Science", "Art", "Music", "Philosophy",
  "Psychology", "Sociology", "Political Science", "Law", "Health",
  "Nutrition", "Physical Education", "Languages", "Religion", "Ethics",
  "Frontend", "Backend", "Data Science", "Cloud Computing", "Cybersecurity",
];

export default function ManageCourses() {
  const { data: courses = [], isLoading } = useCourses();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CourseEditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startEdit = (course: any) => {
    setEditingId(course.id);
    setEditForm({
      title: course.title ?? "",
      description: course.description ?? "",
      category: course.category ?? "",
      difficulty: course.difficulty ?? "beginner",
      instructor: course.instructor ?? "",
      duration_minutes: course.duration_minutes ?? 0,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async (courseId: string) => {
    if (!editForm) return;
    if (!editForm.title.trim()) { toast.error("Title is required."); return; }
    if (!editForm.category.trim()) { toast.error("Category is required."); return; }

    setSaving(true);
    const { error } = await (supabase.from("courses") as any)
      .update({
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        category: editForm.category.trim(),
        difficulty: editForm.difficulty,
        instructor: editForm.instructor.trim(),
        duration_minutes: Number(editForm.duration_minutes) || 0,
      })
      .eq("id", courseId);

    setSaving(false);

    if (error) {
      toast.error("Failed to update course: " + error.message);
    } else {
      toast.success("Course updated!");
      // Bust caches so changes reflect immediately everywhere
      await invalidateCoursesCache();
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setEditingId(null);
      setEditForm(null);
    }
  };

  const handleDelete = async (courseId: string) => {
    setDeletingId(courseId);
    const { error } = await supabase.from("courses").delete().eq("id", courseId);
    setDeletingId(null);
    setConfirmDeleteId(null);

    if (error) {
      toast.error("Failed to delete course: " + error.message);
    } else {
      toast.success("Course deleted.");
      await invalidateCoursesCache();
      queryClient.invalidateQueries({ queryKey: ["courses"] });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Manage Courses</h1>
          <p className="text-muted-foreground">View and manage all courses</p>
        </div>
        <Button asChild>
          <Link to="/admin/upload-course"><Plus className="mr-2 h-4 w-4" />Add Course</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <span className="text-5xl">📚</span>
          <p className="text-lg font-medium">No courses yet</p>
          <p className="text-sm">Create your first course to get started.</p>
          <Button asChild variant="outline" className="mt-2">
            <Link to="/admin/upload-course"><Plus className="mr-2 h-4 w-4" />Add Course</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {courses.map((course: any) => (
            <Card key={course.id} className={editingId === course.id ? "border-primary/40 ring-1 ring-primary/20" : ""}>
              <CardContent className="p-4">
                {editingId === course.id && editForm ? (
                  /* ─── Edit Mode ─────────────────────────────────────── */
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Course Title</Label>
                        <Input
                          value={editForm.title}
                          onChange={e => setEditForm(f => f ? { ...f, title: e.target.value } : f)}
                          placeholder="Course title"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label>Description</Label>
                        <Textarea
                          value={editForm.description}
                          onChange={e => setEditForm(f => f ? { ...f, description: e.target.value } : f)}
                          placeholder="Course description"
                          rows={3}
                          className="resize-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Category</Label>
                        <Input
                          list="edit-categories"
                          value={editForm.category}
                          onChange={e => setEditForm(f => f ? { ...f, category: e.target.value } : f)}
                          placeholder="e.g. Mathematics, Science..."
                        />
                        <datalist id="edit-categories">
                          {CATEGORY_SUGGESTIONS.map(cat => <option key={cat} value={cat} />)}
                        </datalist>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Difficulty</Label>
                        <Select
                          value={editForm.difficulty}
                          onValueChange={val => setEditForm(f => f ? { ...f, difficulty: val } : f)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="beginner">Beginner</SelectItem>
                            <SelectItem value="intermediate">Intermediate</SelectItem>
                            <SelectItem value="advanced">Advanced</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Instructor</Label>
                        <Input
                          value={editForm.instructor}
                          onChange={e => setEditForm(f => f ? { ...f, instructor: e.target.value } : f)}
                          placeholder="Instructor name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Duration (minutes)</Label>
                        <Input
                          type="number"
                          value={editForm.duration_minutes}
                          onChange={e => setEditForm(f => f ? { ...f, duration_minutes: parseInt(e.target.value) || 0 } : f)}
                          placeholder="120"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1 border-t border-border/50">
                      <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                        <X className="mr-1.5 h-3.5 w-3.5" />Cancel
                      </Button>
                      <Button size="sm" onClick={() => saveEdit(course.id)} disabled={saving}>
                        {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                        Save Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ─── View Mode ─────────────────────────────────────── */
                  <div className="flex items-center justify-between">
                    <div className="flex-1 space-y-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{course.title}</h3>
                        <Badge variant="secondary">{course.category}</Badge>
                        <Badge>{course.difficulty}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {(course.materials ?? []).length} materials · {course.enrolled_count ?? 0} enrolled
                        {course.instructor && <span className="ml-2 text-xs">· {course.instructor}</span>}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {confirmDeleteId === course.id ? (
                        /* ── Delete confirmation ── */
                        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-1.5">
                          <span className="text-xs text-destructive font-medium">Delete?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleDelete(course.id)}
                            disabled={deletingId === course.id}
                          >
                            {deletingId === course.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deletingId === course.id}
                          >
                            No
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(course)}
                            title="Edit course"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                            onClick={() => setConfirmDeleteId(course.id)}
                            title="Delete course"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
