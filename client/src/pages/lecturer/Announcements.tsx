import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchLecturerAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
} from "@/lib/api/announcements";
import { fetchLecturerCourses } from "@/lib/api/lecturer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone, Plus, Loader2, Trash2, Pin, Globe, BookOpen, X,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function LecturerAnnouncements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", course_id: "", is_pinned: false });

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["lecturer-announcements", user?.id],
    queryFn: () => fetchLecturerAnnouncements(user!.id),
    enabled: !!user,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["lecturer-courses", user?.id],
    queryFn: () => fetchLecturerCourses(user!.id),
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createAnnouncement({
        author_id: user!.id,
        title: form.title,
        body: form.body,
        is_pinned: form.is_pinned,
        course_id: form.course_id || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecturer-announcements"] });
      setForm({ title: "", body: "", course_id: "", is_pinned: false });
      setShowForm(false);
      toast({ title: "Announcement posted!" });
    },
    onError: () => toast({ title: "Failed to post", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecturer-announcements"] });
      toast({ title: "Announcement deleted" });
    },
  });

  return (
    <div className="space-y-8 pb-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold font-display">Announcements</h1>
          <p className="text-muted-foreground">Notify your students about updates and important information</p>
        </div>
        <Button
          className="gradient-primary text-white border-0 glow-sm gap-2"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "New Announcement"}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="border-emerald-500/30 bg-emerald-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-emerald-600" /> New Announcement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Announcement title..."
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="border-border/60"
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <textarea
                placeholder="Write your announcement..."
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                rows={4}
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Target Course (optional)</Label>
                <select
                  value={form.course_id}
                  onChange={(e) => setForm((f) => ({ ...f, course_id: e.target.value }))}
                  className="w-full h-10 rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Platform-wide (all students)</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={form.is_pinned}
                    onChange={(e) => setForm((f) => ({ ...f, is_pinned: e.target.checked }))}
                    className="h-4 w-4 rounded border-border/60"
                  />
                  <span className="text-sm">Pin this announcement</span>
                </label>
              </div>
            </div>
            <Button
              className="gradient-primary text-white border-0 w-full"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.title.trim() || !form.body.trim()}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Post Announcement
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Announcements list */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="text-5xl">📢</div>
          <h3 className="text-xl font-bold font-display">No announcements yet</h3>
          <p className="text-muted-foreground text-sm">Post an announcement to notify your students.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <Card key={ann.id} className={`border-border/60 ${ann.is_pinned ? "border-emerald-500/30 bg-emerald-50/20" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {ann.is_pinned && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1 text-xs">
                          <Pin className="h-2.5 w-2.5" /> Pinned
                        </Badge>
                      )}
                      {ann.course_id ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <BookOpen className="h-2.5 w-2.5" />
                          {ann.courses?.title ?? "Course"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Globe className="h-2.5 w-2.5" /> Platform-wide
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold font-display">{ann.title}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ann.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ann.created_at).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => deleteMutation.mutate(ann.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
