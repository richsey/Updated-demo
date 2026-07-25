import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLecturerCourses } from "@/lib/api/lecturer";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, Star, TrendingUp, BookOpen, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function LecturerAnalytics() {
  const { user } = useAuth();

  const { data: courses = [], isLoading: loadingCourses } = useQuery({
    queryKey: ["lecturer-courses", user?.id],
    queryFn: () => fetchLecturerCourses(user!.id),
    enabled: !!user,
  });

  const publishedCourses = courses.filter((c) => c.status === "published");

  const { data: enrollmentData = [], isLoading: loadingEnroll } = useQuery({
    queryKey: ["lecturer-enrollments-analytics", user?.id, publishedCourses.map((c) => c.id)],
    queryFn: async () => {
      if (!publishedCourses.length) return [];
      const courseIds = publishedCourses.map((c) => c.id);
      const results = await Promise.all(
        courseIds.map(async (id) => {
          const { count } = await supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .eq("course_id", id);
          return {
            course: courses.find((c) => c.id === id)?.title?.slice(0, 20) ?? id,
            enrollments: count ?? 0,
          };
        })
      );
      return results;
    },
    enabled: publishedCourses.length > 0,
  });

  const { data: quizStats = [], isLoading: loadingQuiz } = useQuery({
    queryKey: ["lecturer-quiz-analytics", user?.id],
    queryFn: async () => {
      if (!courses.length) return [];
      const courseIds = courses.map((c) => c.id);
      const { data: quizzes } = await supabase
        .from("quizzes")
        .select("id, title, course_id")
        .in("course_id", courseIds);

      if (!quizzes || quizzes.length === 0) return [];
      const quizIds = (quizzes as unknown as Array<{ id: string }>).map((q) => q.id);

      const { data: attempts } = await supabase
        .from("quiz_attempts")
        .select("quiz_id, score, total_questions")
        .in("quiz_id", quizIds);

      const statsMap: Record<string, { attempts: number; totalScore: number; totalQ: number; name: string }> = {};
      for (const q of (quizzes as unknown as Array<{ id: string; title: string }>)) {
        statsMap[q.id] = { attempts: 0, totalScore: 0, totalQ: 0, name: q.title };
      }
      for (const a of (attempts as unknown as Array<{ quiz_id: string; score: number; total_questions: number }>) ?? []) {
        if (!statsMap[a.quiz_id]) continue;
        statsMap[a.quiz_id].attempts++;
        statsMap[a.quiz_id].totalScore += a.score;
        statsMap[a.quiz_id].totalQ += a.total_questions;
      }

      return Object.values(statsMap)
        .map((s) => ({
          name: s.name.slice(0, 18),
          attempts: s.attempts,
          avgScore: s.totalQ > 0 ? Math.round((s.totalScore / s.totalQ) * 100) : 0,
        }))
        .filter((s) => s.attempts > 0)
        .slice(0, 8);
    },
    enabled: courses.length > 0,
  });

  const totalStudents = enrollmentData.reduce((a, c) => a + c.enrollments, 0);
  const avgEnrollment = enrollmentData.length ? Math.round(totalStudents / enrollmentData.length) : 0;
  const avgScore = quizStats.length ? Math.round(quizStats.reduce((a, s) => a + s.avgScore, 0) / quizStats.length) : 0;

  const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

  return (
    <div className="space-y-8 pb-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">Analytics</h1>
        <p className="text-muted-foreground">Performance overview for your courses</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: BookOpen, label: "Published Courses", value: publishedCourses.length, color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
          { icon: Users, label: "Total Students", value: totalStudents, color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-500/20" },
          { icon: TrendingUp, label: "Average Enrollments", value: avgEnrollment, color: "text-violet-600", bg: "bg-violet-500/10", border: "border-violet-500/20" },
          { icon: Star, label: "Average Quiz Score", value: `${avgScore}%`, color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20" },
        ].map((s) => (
          <Card key={s.label} className={`border ${s.border} relative overflow-hidden`}>
            <div className={`absolute top-0 right-0 h-16 w-16 ${s.bg} rounded-full -translate-y-1/2 translate-x-1/2 blur-xl opacity-60`} />
            <CardContent className="flex items-center gap-3 p-5 relative">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} border ${s.border} ${s.color} flex-shrink-0`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display">
                  {loadingCourses || loadingEnroll || loadingQuiz ? "—" : s.value}
                </p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Enrollment per course */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Enrollments per Course</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEnroll || loadingCourses ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : enrollmentData.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">No enrollment data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={enrollmentData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="course" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="enrollments" radius={[4, 4, 0, 0]}>
                    {enrollmentData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quiz performance */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Quiz Average Scores</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingQuiz ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : quizStats.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-12">No quiz attempt data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={quizStats} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(value) => [`${value}%`, "Average Score"]} />
                  <Bar dataKey="avgScore" radius={[4, 4, 0, 0]} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Course status table */}
      {courses.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Course Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {courses.map((c) => {
                const enrollment = enrollmentData.find((e) => e.course === c.title?.slice(0, 20));
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/60">
                    <div className="flex items-center gap-3">
                      <img
                        src={c.thumbnail}
                        className="h-8 w-8 rounded-lg object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=100"; }}
                      />
                      <div>
                        <p className="text-sm font-semibold truncate max-w-xs">{c.title}</p>
                        <p className="text-xs text-muted-foreground">{c.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{enrollment?.enrollments ?? 0} students</span>
                      <Badge
                        className={
                          c.status === "published" ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : c.status === "pending_approval" ? "bg-amber-100 text-amber-700 border-amber-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                        }
                      >
                        {c.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
