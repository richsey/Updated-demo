import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLecturerCourses } from "@/lib/api/lecturer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Users, ClipboardList, TrendingUp, Plus, ArrowRight,
  Loader2, CheckCircle2, Clock, AlertCircle, Archive,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  draft:            { label: "Draft",            color: "bg-muted text-muted-foreground border-border",   icon: Clock          },
  pending_approval: { label: "Pending Review",   color: "bg-warning/10 text-warning border-warning/20",    icon: AlertCircle    },
  published:        { label: "Published",        color: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  rejected:         { label: "Rejected",         color: "bg-destructive/10 text-destructive border-destructive/20",       icon: AlertCircle    },
  archived:         { label: "Archived",         color: "bg-muted/50 text-muted-foreground border-border",    icon: Archive        },
};

export default function LecturerDashboard() {
  const { user, profile } = useAuth();

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["lecturer-courses", user?.id],
    queryFn: () => fetchLecturerCourses(user!.id),
    enabled: !!user,
  });

  const isNewUser = profile?.created_at
    ? (new Date().getTime() - new Date(profile.created_at).getTime()) < 24 * 60 * 60 * 1000
    : courses.length === 0;

  const { data: studentCount = 0, isLoading: loadingStudents } = useQuery({
    queryKey: ["lecturer-student-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const courseIds = courses.map((c) => c.id);
      if (courseIds.length === 0) return 0;
      const { count } = await supabase
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .in("course_id", courseIds);
      return count ?? 0;
    },
    enabled: !!user && courses.length > 0,
  });

  const { data: quizCount = 0 } = useQuery({
    queryKey: ["lecturer-quiz-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const courseIds = courses.map((c) => c.id);
      if (courseIds.length === 0) return 0;
      const { count } = await supabase
        .from("quizzes")
        .select("*", { count: "exact", head: true })
        .in("course_id", courseIds);
      return count ?? 0;
    },
    enabled: !!user && courses.length > 0,
  });

  const publishedCourses = courses.filter((c) => c.status === "published");
  const pendingCourses   = courses.filter((c) => c.status === "pending_approval");
  const draftCourses     = courses.filter((c) => c.status === "draft");

  const stats = [
    {
      icon: BookOpen, label: "Total Courses", value: loadingCourses ? "—" : courses.length,
      color: "text-success", bg: "bg-success/10", border: "border-success/20",
    },
    {
      icon: Users, label: "Total Students", value: loadingStudents ? "—" : studentCount,
      color: "text-info", bg: "bg-info/10", border: "border-info/20",
    },
    {
      icon: ClipboardList, label: "Quizzes Created", value: quizCount,
      color: "text-accent", bg: "bg-accent/10", border: "border-accent/20",
    },
    {
      icon: TrendingUp, label: "Published Courses", value: publishedCourses.length,
      color: "text-warning", bg: "bg-warning/10", border: "border-warning/20",
    },
  ];

  return (
    <div className="space-y-8 pb-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 bg-success/10 text-success text-xs font-medium px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Lecturer Account
            </span>
          </div>
          <h1 className="text-4xl font-bold font-display">
            {isNewUser ? "Welcome" : "Welcome back"}{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-muted-foreground">Manage your courses, students, and content from here.</p>
        </div>
        <Link to="/lecturer/courses/new">
          <Button className="gradient-primary text-white border-0 glow-sm gap-2">
            <Plus className="h-4 w-4" /> New Course
          </Button>
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className={`border ${s.border} relative overflow-hidden card-hover`}>
            <div className={`absolute top-0 right-0 h-20 w-20 ${s.bg} rounded-full -translate-y-1/2 translate-x-1/2 blur-xl opacity-60`} />
            <CardContent className="flex items-center gap-4 p-5 relative">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg} border ${s.border} ${s.color} flex-shrink-0`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Courses */}
        <div className="lg:col-span-2">
          <Card className="border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="font-display text-base">My Courses</CardTitle>
              <Link to="/lecturer/courses" className="text-xs text-primary hover:underline flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {loadingCourses ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : courses.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <div className="text-4xl">📚</div>
                  <p className="text-sm font-semibold">No courses yet</p>
                  <p className="text-xs text-muted-foreground">Create your first course to get started.</p>
                  <Link to="/lecturer/courses/new">
                    <Button size="sm" variant="outline">Create Course</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {courses.slice(0, 5).map((course) => {
                    const cfg = STATUS_CONFIG[course.status] ?? STATUS_CONFIG.draft;
                    const StatusIcon = cfg.icon;
                    return (
                      <div key={course.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card/60 hover:bg-card transition-colors">
                        <div className="h-10 w-10 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                          <img
                            src={course.thumbnail}
                            alt={course.title}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=200"; }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{course.title}</p>
                          <p className="text-xs text-muted-foreground">{course.category} · {course.difficulty}</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          <StatusIcon className="h-2.5 w-2.5" />
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats Panel */}
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Course Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Published",      count: publishedCourses.length,   color: "bg-success" },
                { label: "Pending Review", count: pendingCourses.length,     color: "bg-warning" },
                { label: "Drafts",         count: draftCourses.length,       color: "bg-muted-foreground" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`h-2 w-2 rounded-full ${item.color}`} />
                    <span className="text-muted-foreground">{item.label}</span>
                  </div>
                  <span className="text-sm font-bold">{item.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { to: "/lecturer/courses/new",   label: "Create Course",     icon: Plus          },
                { to: "/lecturer/materials",      label: "Upload Material",   icon: BookOpen      },
                { to: "/lecturer/quizzes",        label: "Build Quiz",        icon: ClipboardList },
                { to: "/lecturer/announcements",  label: "Post Announcement", icon: Users         },
              ].map((action) => (
                <Link key={action.to} to={action.to}>
                  <Button variant="outline" className="w-full justify-start gap-2 h-9 text-sm border-border/60 hover:border-success/30 hover:bg-success/10">
                    <action.icon className="h-3.5 w-3.5 text-success" />
                    {action.label}
                  </Button>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
