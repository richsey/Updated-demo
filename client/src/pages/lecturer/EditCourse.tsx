import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCourse } from "@/hooks/useSupabaseQuery";
import { updateLecturerCourse, deleteMaterial, updateMaterial } from "@/lib/api/lecturer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, BookOpen, ArrowLeft, Trash, Pencil, Save } from "lucide-react";
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

export default function EditCourse() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: course, isLoading } = useCourse(courseId);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "General",
    difficulty: "beginner",
    format: "video",
    thumbnail: "",
    instructor: "",
    tags: "",
  });

  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [materialForm, setMaterialForm] = useState({
    title: "",
    url: "",
    duration_minutes: 0,
  });

  useEffect(() => {
    if (course) {
      setForm({
        title: course.title || "",
        description: course.description || "",
        category: course.category || "General",
        difficulty: course.difficulty || "beginner",
        format: course.format || "video",
        thumbnail: course.thumbnail || THUMBNAIL_PRESETS[0],
        instructor: course.instructor || "",
        tags: course.tags ? course.tags.join(", ") : "",
      });
    }
  }, [course]);

  const updateCourseMutation = useMutation({
    mutationFn: () =>
      updateLecturerCourse(courseId!, user!.id, {
        ...form,
        difficulty: form.difficulty as "beginner" | "intermediate" | "advanced",
        format: form.format as "video" | "article" | "interactive",
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      queryClient.invalidateQueries({ queryKey: ["lecturer-courses"] });
      toast({ title: "Course updated successfully!" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update course", description: err.message, variant: "destructive" });
    },
  });

  const deleteMaterialMutation = useMutation({
    mutationFn: (materialId: string) => deleteMaterial(materialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      toast({ title: "Material deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete material", description: err.message, variant: "destructive" });
    },
  });

  const updateMaterialMutation = useMutation({
    mutationFn: (materialId: string) => updateMaterial(materialId, materialForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      setEditingMaterialId(null);
      toast({ title: "Material updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update material", description: err.message, variant: "destructive" });
    },
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const startEditingMaterial = (material: any) => {
    setEditingMaterialId(material.id);
    setMaterialForm({
      title: material.title,
      url: material.url,
      duration_minutes: material.duration_minutes || 0,
    });
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!course) {
    return <div className="text-center py-20">Course not found.</div>;
  }

  return (
    <div className="space-y-8 pb-6 max-w-4xl mx-auto">
      <div className="space-y-1">
        <Link to="/lecturer/courses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Courses
        </Link>
        <h1 className="text-4xl font-bold font-display">Edit Course</h1>
        <p className="text-muted-foreground">Manage your course details and materials.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" /> Course Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label htmlFor="title">Course Title</Label>
                <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
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
                  <Input id="instructor" value={form.instructor} onChange={(e) => set("instructor", e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Thumbnail URL</Label>
                <Input value={form.thumbnail} onChange={(e) => set("thumbnail", e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
              </div>

              <div className="pt-2">
                <Button
                  className="w-full gradient-primary text-white border-0 glow-sm"
                  onClick={() => updateCourseMutation.mutate()}
                  disabled={updateCourseMutation.isPending || !form.title.trim() || !form.description.trim()}
                >
                  {updateCourseMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</> : <><Save className="h-4 w-4 mr-2" /> Save Details</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-4 border-b border-border/40 flex flex-row items-center justify-between">
              <CardTitle className="font-display text-base">Materials ({course.materials?.length || 0})</CardTitle>
              <Button size="sm" variant="outline" className="h-8" onClick={() => navigate(`/lecturer/materials?courseId=${course.id}`)}>
                + Add Material
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {course.materials?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No materials yet.</p>
              ) : (
                <div className="space-y-3">
                  {course.materials?.map((mat) => (
                    <div key={mat.id} className="border border-border/60 rounded-lg p-3 bg-muted/10 space-y-3">
                      {editingMaterialId === mat.id ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Title</Label>
                            <Input 
                              className="h-8 text-sm" 
                              value={materialForm.title} 
                              onChange={(e) => setMaterialForm(p => ({ ...p, title: e.target.value }))} 
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">URL</Label>
                            <Input 
                              className="h-8 text-sm" 
                              value={materialForm.url} 
                              onChange={(e) => setMaterialForm(p => ({ ...p, url: e.target.value }))} 
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Duration (mins)</Label>
                            <Input 
                              type="number"
                              className="h-8 text-sm" 
                              value={materialForm.duration_minutes} 
                              onChange={(e) => setMaterialForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 0 }))} 
                            />
                          </div>
                          <div className="flex gap-2 justify-end pt-1">
                            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingMaterialId(null)}>
                              Cancel
                            </Button>
                            <Button 
                              size="sm" 
                              className="h-8 gradient-primary text-white border-0" 
                              onClick={() => updateMaterialMutation.mutate(mat.id)}
                              disabled={updateMaterialMutation.isPending}
                            >
                              {updateMaterialMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <h4 className="text-sm font-semibold truncate">{mat.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">{mat.type} • {mat.duration_minutes} mins</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs border-border/60" onClick={() => startEditingMaterial(mat)}>
                              <Pencil className="h-3 w-3 mr-1" /> Edit
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  className="h-7 w-7 p-0" 
                                  disabled={deleteMaterialMutation.isPending}
                                >
                                  {deleteMaterialMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash className="h-3 w-3" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently remove the material "{mat.title}" from this course.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction 
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deleteMaterialMutation.mutate(mat.id)}
                                  >
                                    Delete Material
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
