// Lecturer UploadMaterial — reuses same form pattern as admin version
// but filters courses to only show the lecturer's own courses

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLecturerCourses } from "@/lib/api/lecturer";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import { Loader2, Upload, Link as LinkIcon, FileText, ArrowLeft } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

export default function LecturerUploadMaterial() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["lecturer-courses", user?.id],
    queryFn: () => fetchLecturerCourses(user!.id),
    enabled: !!user,
  });

  const [searchParams] = useSearchParams();
  const initialCourseId = searchParams.get("courseId") || "";

  const [courseId, setCourseId] = useState(initialCourseId);
  const [matType, setMatType] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!title) {
        const cleanName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
        setTitle(cleanName);
      }
      if (!duration) {
        if (file.type.startsWith("video/")) {
          const videoNode = document.createElement("video");
          videoNode.preload = "metadata";
          videoNode.onloadedmetadata = () => {
            window.URL.revokeObjectURL(videoNode.src);
            const durationMins = Math.ceil(videoNode.duration / 60);
            setDuration(durationMins.toString());
          };
          videoNode.src = URL.createObjectURL(file);
        } else {
          setDuration("5");
        }
      }
    }
  };

  // Auto-fetch YouTube duration
  useEffect(() => {
    if (uploadMethod === "url" && (url.includes("youtube.com") || url.includes("youtu.be"))) {
      const fetchDuration = async () => {
        try {
          const res = await fetch(`http://localhost:5001/api/metadata/youtube-duration?url=${encodeURIComponent(url)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.durationMinutes) {
              setDuration(data.durationMinutes.toString());
            }
          }
        } catch (e) {
          console.error("Failed to fetch YT duration", e);
        }
      };
      const timeoutId = setTimeout(fetchDuration, 800);
      return () => clearTimeout(timeoutId);
    }
  }, [url, uploadMethod]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!courseId) { toast({ title: "Please select a course.", variant: "destructive" }); return; }
    if (!matType) { toast({ title: "Please select a material type.", variant: "destructive" }); return; }
    if (uploadMethod === "url" && !url.trim()) { toast({ title: "Please provide a URL.", variant: "destructive" }); return; }
    if (uploadMethod === "file" && !selectedFile) { toast({ title: "Please select a file.", variant: "destructive" }); return; }

    setSaving(true);
    let finalUrl = url;

    try {
      if (uploadMethod === "file" && selectedFile) {
        const ext = selectedFile.name.split(".").pop();
        const path = `materials/${courseId}/${Date.now()}-${selectedFile.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("materials")
          .upload(path, selectedFile, { cacheControl: "3600", upsert: false });

        if (uploadErr) throw uploadErr;

        const { data: publicData } = supabase.storage.from("materials").getPublicUrl(path);
        finalUrl = publicData.publicUrl;
      }

      // @ts-expect-error Supabase schema divergence
      const { error } = await supabase.from("materials").insert([
        {
          course_id: courseId,
          title: title || selectedFile?.name || "Untitled",
          type: matType,
          url: finalUrl,
          duration_minutes: parseInt(duration || "5", 10),
        },
      ]);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast({ title: "Material uploaded!", description: "Students enrolled in this course can now access it." });
      setCourseId(""); setMatType(""); setTitle(""); setUrl(""); setDuration("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: Error | unknown) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "An unknown error occurred", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Only show published / draft courses (the lecturer owns them)
  const eligibleCourses = courses.filter((c) => ["published", "draft"].includes(c.status));

  return (
    <div className="space-y-8 pb-6 max-w-2xl">
      <div className="space-y-1">
        <Link to="/lecturer/courses" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to My Courses
        </Link>
        <h1 className="text-4xl font-bold font-display">Upload Material</h1>
        <p className="text-muted-foreground">Add videos, PDFs, or articles to your courses.</p>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Course select */}
            <div className="space-y-2">
              <Label>Course <span className="text-destructive">*</span></Label>
              {loadingCourses ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading courses…
                </div>
              ) : eligibleCourses.length === 0 ? (
                <div className="rounded-lg border border-warning/20 bg-warning/10 p-3 text-sm text-warning">
                  You have no courses yet.{" "}
                  <Link to="/lecturer/courses/new" className="underline font-medium">Create one first.</Link>
                </div>
              ) : (
                <Select value={courseId} onValueChange={setCourseId} defaultValue={initialCourseId}>
                  <SelectTrigger className="border-border/60">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleCourses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Material type */}
            <div className="space-y-2">
              <Label>Material Type <span className="text-destructive">*</span></Label>
              <Select value={matType} onValueChange={setMatType}>
                <SelectTrigger className="border-border/60">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="article">Article / Document</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="quiz">Quiz Material</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Upload method toggle */}
            <div className="space-y-2">
              <Label>Upload Method</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUploadMethod("file")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition-all ${
                    uploadMethod === "file"
                      ? "border-success/40 bg-success/10 text-success font-medium"
                      : "border-border/60 text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  <Upload className="h-4 w-4" /> Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMethod("url")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm transition-all ${
                    uploadMethod === "url"
                      ? "border-success/40 bg-success/10 text-success font-medium"
                      : "border-border/60 text-muted-foreground hover:bg-muted/30"
                  }`}
                >
                  <LinkIcon className="h-4 w-4" /> Paste URL
                </button>
              </div>
            </div>

            {uploadMethod === "file" ? (
              <div className="space-y-2">
                <Label>File</Label>
                <div
                  className="rounded-xl border-2 border-dashed border-border/60 bg-muted/20 p-8 text-center cursor-pointer hover:border-success/40 hover:bg-success/10 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? (
                    <div className="space-y-1">
                      <FileText className="h-8 w-8 text-success mx-auto" />
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="h-8 w-8 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">Click to browse or drag a file here</p>
                      <p className="text-xs text-muted-foreground">Video, PDF, or document files accepted</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange}
                  accept="video/*,.pdf,.doc,.docx,.pptx,.txt" />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="url">Material URL</Label>
                <Input
                  id="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="border-border/60"
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mat-title">Title</Label>
                <Input
                  id="mat-title"
                  placeholder="Material title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  placeholder="e.g. 15"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="border-border/60"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={saving || eligibleCourses.length === 0}
              className="w-full gradient-primary text-white border-0 glow-sm"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Uploading…</> : "Upload Material"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
