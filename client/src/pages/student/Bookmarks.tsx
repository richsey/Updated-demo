import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchBookmarks, removeBookmark } from "@/lib/api/bookmarks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bookmark, BookmarkX, PlayCircle, FileText, Clock, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

export default function StudentBookmarks() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: bookmarks = [], isLoading } = useQuery({
    queryKey: ["bookmarks", user?.id],
    queryFn: () => fetchBookmarks(user!.id),
    enabled: !!user,
  });

  const removeMutation = useMutation({
    mutationFn: ({ materialId }: { materialId: string }) =>
      removeBookmark(user!.id, materialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
      toast({ title: "Bookmark removed" });
    },
    onError: () => toast({ title: "Failed to remove bookmark", variant: "destructive" }),
  });

  return (
    <div className="space-y-8 pb-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">Bookmarks</h1>
        <p className="text-muted-foreground">
          Your saved materials — {" "}
          <span className="text-foreground font-medium">{bookmarks.length}</span> bookmark{bookmarks.length !== 1 ? "s" : ""}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto">
            <Bookmark className="h-8 w-8 text-amber-500" />
          </div>
          <h3 className="text-xl font-bold font-display">No bookmarks yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Save materials you want to revisit later by clicking the bookmark icon while studying.
          </p>
          <Link to="/courses">
            <Button variant="outline">Browse Courses</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bookmarks.map((bookmark) => {
            const mat = bookmark.materials;
            const isVideo = mat?.type === "video";
            return (
              <Card key={bookmark.id} className="border-border/60 overflow-hidden card-hover group">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                      {isVideo ? (
                        <PlayCircle className="h-5 w-5 text-primary" />
                      ) : (
                        <FileText className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeMutation.mutate({ materialId: bookmark.material_id })}
                      disabled={removeMutation.isPending}
                    >
                      <BookmarkX className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    {mat?.courses && (
                      <Badge variant="secondary" className="text-xs mb-1">
                        {mat.courses?.title}
                      </Badge>
                    )}
                    <h3 className="text-sm font-bold font-display line-clamp-2">
                      {mat?.title ?? "Unknown Material"}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] capitalize">{mat?.type}</Badge>
                      {mat?.duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {mat.duration_minutes} Minutes
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Saved {new Date(bookmark.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>

                  {mat?.course_id && (
                    <Link
                      to={`/courses/${mat.course_id}`}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      Go to course <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
