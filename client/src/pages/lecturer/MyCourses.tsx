import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchLecturerCourses,
  submitCourseForApproval,
  archiveCourse,
} from "@/lib/api/lecturer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Plus, Loader2, CheckCircle2, Clock, AlertCircle,
  Archive, Send, Eye, Pencil, MoreHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  draft:            { label: "Draft",           class: "bg-muted text-muted-foreground border-border"      },
  pending_approval: { label: "Pending Review",  class: "bg-warning/10 text-warning border-warning/20"       },
  published:        { label: "Published",       class: "bg-success/10 text-success border-success/20" },
  rejected:         { label: "Rejected",        class: "bg-destructive/10 text-destructive border-destructive/20"          },
  archived:         { label: "Archived",        class: "bg-muted/50 text-muted-foreground border-border"       },
};

const DIFF_CONFIG: Record<string, string> = {
  beginner:     "bg-success/10 text-success border-success/20",
  intermediate: "bg-warning/10 text-warning border-warning/20",
  advanced:     "bg-destructive/10 text-destructive border-destructive/20",
};

export default function LecturerMyCourses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("all");

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["lecturer-courses", user?.id],
    queryFn: () => fetchLecturerCourses(user!.id),
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: ({ courseId }: { courseId: string }) =>
      submitCourseForApproval(courseId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecturer-courses"] });
      toast({ title: "Submitted for review", description: "An admin will review your course shortly." });
    },
    onError: () => toast({ title: "Submission failed", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: ({ courseId }: { courseId: string }) =>
      archiveCourse(courseId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lecturer-courses"] });
      toast({ title: "Course archived" });
    },
    onError: () => toast({ title: "Archive failed", variant: "destructive" }),
  });

  const filtered = filter === "all" ? courses : courses.filter((c) => c.status === filter);
  const statusKeys = ["all", "draft", "pending_approval", "published", "rejected", "archived"];

  return (
    <div className="space-y-8 pb-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold font-display">My Courses</h1>
          <p className="text-muted-foreground">
            Manage your <span className="text-foreground font-medium">{courses.length}</span> course{courses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link to="/lecturer/courses/new">
          <Button className="gradient-primary text-white border-0 glow-sm gap-2">
            <Plus className="h-4 w-4" /> New Course
          </Button>
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {statusKeys.map((key) => {
          const count = key === "all" ? courses.length : courses.filter((c) => c.status === key).length;
          return (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
              className={filter === key
                ? "gradient-primary border-0 text-white glow-sm h-8 text-xs"
                : "border-border/60 text-muted-foreground hover:text-foreground h-8 text-xs"
              }
            >
              {STATUS_CONFIG[key]?.label ?? "All"} ({count})
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="text-5xl">📚</div>
          <h3 className="text-xl font-bold font-display">No courses found</h3>
          <p className="text-muted-foreground text-sm">
            {filter === "all" ? "Create your first course to get started." : `No ${STATUS_CONFIG[filter]?.label.toLowerCase() ?? filter} courses.`}
          </p>
          {filter === "all" && (
            <Link to="/lecturer/courses/new">
              <Button variant="outline">Create Course</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((course) => {
            const st = STATUS_CONFIG[course.status] ?? STATUS_CONFIG.draft;
            const diff = DIFF_CONFIG[course.difficulty] ?? "";
            return (
              <Card key={course.id} className="border-border/60 overflow-hidden card-hover flex flex-col">
                <div className="relative h-36 overflow-hidden bg-secondary">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400"; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute top-2 right-2">
                    <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${st.class}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="absolute bottom-2 left-2">
                    <span className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${diff}`}>
                      {course.difficulty}
                    </span>
                  </div>
                </div>

                <CardContent className="p-4 flex flex-col flex-1 space-y-3">
                  <div>
                    <Badge variant="secondary" className="text-xs mb-1">{course.category}</Badge>
                    <h3 className="text-sm font-bold font-display line-clamp-2">{course.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{course.description}</p>
                  </div>

                  {course.status === "rejected" && course.rejection_note && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                      <p className="font-semibold mb-0.5">Rejection reason:</p>
                      <p>{course.rejection_note}</p>
                    </div>
                  )}

                  <div className="mt-auto flex gap-2 flex-wrap">
                    {course.status === "draft" && (
                      <Button
                        size="sm"
                        className="flex-1 gradient-primary border-0 text-white text-xs gap-1"
                        onClick={() => submitMutation.mutate({ courseId: course.id })}
                        disabled={submitMutation.isPending}
                      >
                        {submitMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Submit for Review
                      </Button>
                    )}
                    {course.status === "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs gap-1 border-warning/30 text-warning hover:bg-warning/10"
                        onClick={() => submitMutation.mutate({ courseId: course.id })}
                        disabled={submitMutation.isPending}
                      >
                        <Send className="h-3 w-3" /> Resubmit
                      </Button>
                    )}
                    {!["archived"].includes(course.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1 border-border/60"
                        onClick={() => archiveMutation.mutate({ courseId: course.id })}
                        disabled={archiveMutation.isPending}
                      >
                        <Archive className="h-3 w-3" /> Archive
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
