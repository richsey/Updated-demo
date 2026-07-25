import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCourses } from "@/hooks/useSupabaseQuery";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useState, useRef } from "react";
import { Loader2, Upload, Link as LinkIcon, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateCoursesCache } from "@/lib/api/courses";

export default function UploadMaterial() {
  const queryClient = useQueryClient();
  const { data: courses = [], isLoading: loadingCourses } = useCourses();
  const [courseId, setCourseId] = useState("");
  const [matType, setMatType] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-populate title if empty
      if (!title) {
        const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setTitle(cleanName);
      }
      // Auto-guess duration
      if (!duration) {
        if (file.type.startsWith("video/")) {
          setDuration("10"); // placeholder for video
        } else {
          setDuration("5"); // placeholder for reading
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!courseId) { toast.error("Please select a course."); return; }
    if (!matType) { toast.error("Please select a material type."); return; }
    if (uploadMethod === "url" && !url.trim()) { toast.error("Please provide a material URL."); return; }
    if (uploadMethod === "file" && !selectedFile) { toast.error("Please select a file to upload."); return; }

    setSaving(true);
    let finalUrl = url;

    // 1. Upload file if needed
    if (uploadMethod === "file" && selectedFile) {
      setUploading(true);
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${courseId}/${fileName}`;

      // Upload file to 'materials' bucket
      let { error: uploadError } = await supabase.storage
        .from("materials")
        .upload(filePath, selectedFile, { cacheControl: "3600", upsert: true });

      // Try creating bucket if it doesn't exist
      if (uploadError && (uploadError.message?.includes("not found") || (uploadError as { status?: number }).status === 404)) {
        try {
          await supabase.storage.createBucket("materials", { public: true });
          const retry = await supabase.storage
            .from("materials")
            .upload(filePath, selectedFile, { cacheControl: "3600", upsert: true });
          uploadError = retry.error;
        } catch (bucketErr) {
          uploadError = bucketErr;
        }
      }

      if (uploadError) {
        setUploading(false);
        setSaving(false);
        toast.error("File upload failed: " + uploadError.message);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("materials")
        .getPublicUrl(filePath);

      finalUrl = urlData.publicUrl;
      setUploading(false);
    }

    // 2. Insert material record
    const maxOrder = await supabase
      .from("materials")
      .select("order_index")
      .eq("course_id", courseId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    const maxOrderData = (maxOrder as unknown as { data: { order_index: number } | null }).data;
    const orderIndex = maxOrderData ? maxOrderData.order_index : 0;
    const dbType = matType === "video" ? "video" : "tutorial";
    
    // @ts-expect-error Supabase schema divergence
    const { error } = await supabase.from("materials").insert([{
      course_id: courseId,
      title: title.trim(),
      type: dbType,
      url: finalUrl.trim(),
      duration_minutes: parseInt(duration || "0"),
      order_index: orderIndex + 1,
    }]);

    setSaving(false);
    if (error) {
      toast.error("Failed to upload material: " + error.message);
    } else {
      toast.success("Material uploaded successfully!");
      await invalidateCoursesCache();
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["course", courseId] });
      
      // Clear form
      setTitle("");
      setUrl("");
      setDuration("");
      setCourseId("");
      setMatType("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
                  {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {!loadingCourses && courses.length === 0 && (
                <p className="text-xs text-destructive">No courses found. Create a course first.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Material Title</Label>
              <Input
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Introduction to the Topic"
                required
              />
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

            {/* Toggle Upload vs Link */}
            <div className="space-y-2">
              <Label>Source Content</Label>
              <div className="flex gap-2 p-1 border border-border/60 rounded-lg bg-muted/20">
                <button
                  type="button"
                  onClick={() => setUploadMethod("file")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    uploadMethod === "file"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMethod("url")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    uploadMethod === "url"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LinkIcon className="h-3.5 w-3.5" />
                  Provide URL
                </button>
              </div>
            </div>

            {uploadMethod === "file" ? (
              <div className="space-y-2">
                <Label>File Upload</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center border-2 border-dashed border-border/80 rounded-2xl p-6 bg-muted/10 hover:bg-muted/20 hover:border-primary/40 transition-all cursor-pointer group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept={
                      matType === "pdf" ? ".pdf" :
                      matType === "video" ? "video/*" :
                      matType === "article" ? ".txt,.md,.pdf,.docx" :
                      "*"
                    }
                  />
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary group-hover:scale-110 transition-transform">
                    <Upload className="h-5 w-5" />
                  </div>
                  {selectedFile ? (
                    <div className="text-center mt-3 space-y-1">
                      <p className="text-xs font-bold truncate max-w-[280px] flex items-center justify-center gap-1">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="text-center mt-3">
                      <p className="text-xs font-bold text-foreground">Click to select file from device</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {matType === "pdf" ? "Supports PDF format" :
                         matType === "video" ? "Supports MP4, WebM format" :
                         "Supports PDFs, Docs, Text or Videos"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                type="number"
                placeholder="15"
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving || uploading}>
              {saving || uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploading ? "Uploading File..." : "Saving..."}
                </>
              ) : (
                "Upload Material"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
