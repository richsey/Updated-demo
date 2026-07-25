import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchPendingCourses,
  adminApproveCourse,
  adminRejectCourse,
} from "@/lib/api/lecturer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, Clock, BookOpen, User, Loader2, AlertCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function AdminCourseApprovals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [rejectionNotes, setRejectionNotes] = useState<Record<string, string>>({});
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { data: pendingCourses = [], isLoading } = useQuery({
    queryKey: ["pending-courses"],
    queryFn: fetchPendingCourses,
  });

  const approveMutation = useMutation({
    mutationFn: (courseId: string) => adminApproveCourse(courseId, user!.id),
    onSuccess: (_, courseId) => {
      queryClient.invalidateQueries({ queryKey: ["pending-courses"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast({ title: "Course approved", description: "Students can now enroll." });
    },
    onError: () => toast({ title: "Approval failed", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ courseId, note }: { courseId: string; note: string }) =>
      adminRejectCourse(courseId, user!.id, note),
    onSuccess: (_, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: ["pending-courses"] });
      setRejectingId(null);
      setRejectionNotes((prev) => { const n = { ...prev }; delete n[courseId]; return n; });
      toast({ title: "Course rejected", description: "The lecturer has been notified." });
    },
    onError: () => toast({ title: "Rejection failed", variant: "destructive" }),
  });

  return (
    <div className="space-y-8 pb-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">Course Approvals</h1>
        <p className="text-muted-foreground">
          Review lecturer-submitted courses before they go live
        </p>
      </div>

      {/* Badge */}
      {pendingCourses.length > 0 && (
        <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <strong>{pendingCourses.length}</strong> course{pendingCourses.length !== 1 ? "s" : ""} awaiting your review
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : pendingCourses.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold font-display">All caught up!</h3>
          <p className="text-muted-foreground text-sm">No courses are pending review at the moment.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {pendingCourses.map((course) => (
            <Card key={course.id} className="border-amber-200/60 bg-amber-50/20 overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row">
                  {/* Thumbnail */}
                  <div className="h-36 sm:h-auto sm:w-48 flex-shrink-0 bg-secondary overflow-hidden">
                    <img
                      src={course.thumbnail}
                      alt={course.title}
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400"; }}
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 p-5 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{course.category}</Badge>
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 text-xs">
                          <Clock className="h-2.5 w-2.5" /> Pending Review
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">{course.difficulty}</Badge>
                      </div>
                      <h3 className="text-lg font-bold font-display">{course.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{course.description}</p>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {course.profiles?.full_name ?? "Unknown Lecturer"}
                        <span className="text-muted-foreground/60">— {course.profiles?.email}</span>
                      </span>
                      <span>Submitted {new Date(course.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>

                    {/* Reject form */}
                    {rejectingId === course.id && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 space-y-2">
                        <p className="text-sm font-semibold text-rose-700">Rejection reason (required)</p>
                        <Input
                          placeholder="Explain why this course is being rejected..."
                          value={rejectionNotes[course.id] ?? ""}
                          onChange={(e) =>
                            setRejectionNotes((prev) => ({ ...prev, [course.id]: e.target.value }))
                          }
                          className="border-rose-300 focus:ring-rose-400 bg-white"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-rose-600 hover:bg-rose-700 text-white border-0 gap-1 text-xs"
                            onClick={() =>
                              rejectMutation.mutate({
                                courseId: course.id,
                                note: rejectionNotes[course.id] ?? "",
                              })
                            }
                            disabled={!rejectionNotes[course.id]?.trim() || rejectMutation.isPending}
                          >
                            {rejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                            Confirm Rejection
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                            onClick={() => setRejectingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {rejectingId !== course.id && (
                      <div className="flex gap-3">
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 gap-2 flex-1"
                          onClick={() => approveMutation.mutate(course.id)}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Approve & Publish
                        </Button>
                        <Button
                          variant="outline"
                          className="border-rose-300 text-rose-700 hover:bg-rose-50 gap-2 flex-1"
                          onClick={() => setRejectingId(course.id)}
                        >
                          <XCircle className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
