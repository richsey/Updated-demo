import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api/notifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, CheckCheck, Loader2, BookOpen, Award, ClipboardList,
  Info, AlertTriangle, CheckCircle2, XCircle, Megaphone,
} from "lucide-react";
import { Link } from "react-router-dom";

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  info:         { icon: Info,          color: "text-blue-600",    bg: "bg-blue-500/10"    },
  success:      { icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-500/10" },
  warning:      { icon: AlertTriangle, color: "text-amber-600",   bg: "bg-amber-500/10"   },
  error:        { icon: XCircle,       color: "text-rose-600",    bg: "bg-rose-500/10"    },
  quiz:         { icon: ClipboardList, color: "text-violet-600",  bg: "bg-violet-500/10"  },
  enrollment:   { icon: BookOpen,      color: "text-primary",     bg: "bg-primary/10"     },
  certificate:  { icon: Award,         color: "text-amber-600",   bg: "bg-amber-500/10"   },
  announcement: { icon: Megaphone,     color: "text-slate-600",   bg: "bg-slate-500/10"   },
};

export default function StudentNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => fetchNotifications(user!.id),
    enabled: !!user,
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(user!.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-8 pb-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold font-display">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0
              ? <><span className="text-foreground font-medium">{unreadCount}</span> unread notification{unreadCount !== 1 ? "s" : ""}</>
              : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border/60"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            {markAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mx-auto">
            <Bell className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-bold font-display">No notifications</h3>
          <p className="text-muted-foreground text-sm">
            You'll be notified about quiz results, enrollments, announcements, and certificates here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.info;
            const Icon = cfg.icon;
            return (
              <Card
                key={notif.id}
                className={`border-border/60 transition-all cursor-pointer hover:shadow-sm ${
                  !notif.is_read ? "border-primary/20 bg-primary/5" : "opacity-80 hover:opacity-100"
                }`}
                onClick={() => !notif.is_read && markOneMutation.mutate(notif.id)}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${cfg.bg} border border-border/40`}>
                    <Icon className={`h-5 w-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`text-sm font-semibold ${!notif.is_read ? "" : "text-muted-foreground"}`}>
                        {notif.title}
                      </p>
                      {!notif.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <p className="text-xs text-muted-foreground/60">
                        {new Date(notif.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                      {notif.link && (
                        <Link
                          to={notif.link}
                          className="text-xs text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View →
                        </Link>
                      )}
                    </div>
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
