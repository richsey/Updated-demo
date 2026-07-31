import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLecturerFeedback, markFeedbackRead } from "@/lib/api/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Star, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i <= rating ? "text-warning fill-warning" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function LecturerFeedbackInbox() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: feedbackList = [], isLoading } = useQuery({
    queryKey: ["lecturer-feedback", user?.id],
    queryFn: () => fetchLecturerFeedback(user!.id),
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markFeedbackRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lecturer-feedback"] }),
    onError: () => toast({ title: "Failed to mark read", variant: "destructive" }),
  });

  const unread = feedbackList.filter((f) => !f.is_read).length;
  const avgRating =
    feedbackList.length > 0
      ? (feedbackList.reduce((a, f) => a + f.rating, 0) / feedbackList.length).toFixed(1)
      : "—";

  return (
    <div className="space-y-8 pb-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold font-display">Feedback Inbox</h1>
          <p className="text-muted-foreground">Student feedback on your courses</p>
        </div>
        <div className="flex gap-3">
          <div className="text-right">
            <p className="text-2xl font-bold font-display text-warning">{avgRating}</p>
            <p className="text-xs text-muted-foreground">Average Rating</p>
          </div>
          {unread > 0 && (
            <Badge className="bg-primary/10 text-primary border-primary/20 self-start">
              {unread} unread
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : feedbackList.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="text-5xl">💬</div>
          <h3 className="text-xl font-bold font-display">No feedback yet</h3>
          <p className="text-muted-foreground text-sm">Feedback will appear here after students submit reviews for your courses.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feedbackList.map((fb) => (
            <Card
              key={fb.id}
              className={`border-border/60 transition-all ${!fb.is_read ? "border-primary/30 bg-primary/5" : ""}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {(fb.profiles?.full_name || fb.profiles?.email || "?")[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold">
                        {fb.profiles?.full_name ?? "Anonymous"}
                      </span>
                      <StarRating rating={fb.rating} />
                      {!fb.is_read && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">New</Badge>
                      )}
                    </div>
                    {fb.courses?.title && (
                      <Badge variant="secondary" className="text-xs">
                        {fb.courses.title}
                      </Badge>
                    )}
                    {fb.comment && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{fb.comment}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(fb.created_at).toLocaleDateString("en-US", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </p>
                  </div>
                  {!fb.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground flex-shrink-0 gap-1 text-xs"
                      onClick={() => markReadMutation.mutate(fb.id)}
                      disabled={markReadMutation.isPending}
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Mark read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
