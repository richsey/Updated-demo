import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchStudentAnnouncements } from "@/lib/api/announcements";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Pin, Globe, BookOpen, Loader2 } from "lucide-react";

export default function StudentAnnouncements() {
  const { user } = useAuth();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["student-announcements", user?.id],
    queryFn: () => fetchStudentAnnouncements(user!.id),
    enabled: !!user,
  });

  return (
    <div className="space-y-8 pb-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">Announcements</h1>
        <p className="text-muted-foreground">
          Updates from your lecturers and the platform
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-500/10 border border-slate-500/20 mx-auto">
            <Megaphone className="h-8 w-8 text-slate-500" />
          </div>
          <h3 className="text-xl font-bold font-display">No announcements</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Announcements from your lecturers and platform administrators will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <Card
              key={ann.id}
              className={`border-border/60 transition-all ${ann.is_pinned ? "border-primary/20 bg-primary/5" : ""}`}
            >
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
                    ann.is_pinned ? "bg-primary/10 border border-primary/20" : "bg-slate-100 border border-slate-200"
                  }`}>
                    <Megaphone className={`h-4 w-4 ${ann.is_pinned ? "text-primary" : "text-slate-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      {ann.is_pinned && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-[10px]">
                          <Pin className="h-2.5 w-2.5" /> Pinned
                        </Badge>
                      )}
                      {ann.course_id ? (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <BookOpen className="h-2.5 w-2.5" />
                          {ann.courses?.title ?? "Course"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          <Globe className="h-2.5 w-2.5" /> Platform-wide
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-semibold font-display text-base">{ann.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">
                      {ann.body}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
                      <span>
                        {new Date(ann.created_at).toLocaleDateString("en-US", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </span>
                    </div>
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
