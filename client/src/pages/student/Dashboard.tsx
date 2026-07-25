import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Clock, Target, TrendingUp, ArrowRight, Flame, Loader2 } from "lucide-react";
import { useUserProgress, useUserQuizAttempts } from "@/hooks/useSupabaseQuery";
import { useAuth } from "@/contexts/AuthContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";
import { useActiveTime } from "@/contexts/ActiveTimeContext";

export default function StudentDashboard() {
  const { profile } = useAuth();
  const { data: progressData = [], isLoading: loadingProgress } = useUserProgress();
  const { data: attempts = [], isLoading: loadingAttempts } = useUserQuizAttempts();
  const telemetry = useActiveTime();

  const avgScore = attempts.length > 0
    ? Math.round(attempts.reduce((a, b) => a + (b.score / b.total_questions) * 100, 0) / attempts.length)
    : 0;

  const quizChartData = attempts.slice(0, 8).reverse().map((a) => ({
    date: new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: Math.round((a.score / a.total_questions) * 100),
  }));

  const isLoading = loadingProgress || loadingAttempts;

  const isNewUser = progressData.length === 0;

  const stats = [
    {
      icon: BookOpen, label: "Courses In Progress", value: isLoading ? "—" : progressData.length,
      color: "text-primary", bg: "bg-primary/10", border: "border-primary/20",
      gradient: "from-primary/5 to-transparent",
    },
    {
      icon: Target, label: "Quizzes Taken", value: isLoading ? "—" : attempts.length,
      color: "text-accent", bg: "bg-accent/10", border: "border-accent/20",
      gradient: "from-accent/5 to-transparent",
    },
    {
      icon: TrendingUp, label: "Average Score", value: isLoading ? "—" : `${avgScore}%`,
      color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20",
      gradient: "from-emerald-400/5 to-transparent",
    },
    {
      icon: Clock, label: "Active Time", value: `${Math.round(telemetry.activeTimeMs / 60000)} Minutes`,
      color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20",
      gradient: "from-blue-400/5 to-transparent",
    },
  ];

  return (
    <div className="space-y-8 pb-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Flame className="h-4 w-4 text-orange-400" />
            <span>{isNewUser ? "Welcome" : "Welcome back"}{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}!</span>
          </div>
          <h1 className="text-4xl font-bold font-display">Dashboard</h1>
          <p className="text-muted-foreground">Track your learning progress and performance</p>
        </div>
        <Link to="/courses"
          className="hidden md:flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors">
          Browse courses <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className={`border ${s.border} bg-gradient-to-br ${s.gradient} card-hover relative overflow-hidden`}>
            <div className={`absolute top-0 right-0 h-20 w-20 ${s.bg} rounded-full -translate-y-1/2 translate-x-1/2 blur-xl opacity-50`} />
            <CardContent className="flex items-center gap-4 p-5 relative">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg} border ${s.border} ${s.color} flex-shrink-0`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold font-display text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quiz Performance Chart */}
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-4">
            <CardTitle className="font-display flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Quiz Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : quizChartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <span className="text-3xl">📊</span>
                <span>No quiz attempts yet</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={quizChartData} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
                    cursor={{ fill: "hsl(var(--primary) / 0.05)" }}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} fill="url(#barGrad)" />
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Course Progress */}
        <Card className="border-border/60 bg-card/80">
          <CardHeader className="pb-4">
            <CardTitle className="font-display flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-accent" /> Course Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : progressData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                <span className="text-3xl">📚</span>
                <span>Start a course to track progress</span>
                <Link to="/courses" className="text-primary text-xs font-medium hover:underline">Browse courses →</Link>
              </div>
            ) : (
              progressData.map((p) => (
                <div key={p.course_id} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <Link to={`/courses/${p.course_id}`}
                      className="font-medium hover:text-primary transition-colors truncate mr-4">
                      {p.courses?.title ?? "Course"}
                    </Link>
                    <span className={`font-bold text-xs flex-shrink-0 ${p.progress >= 80 ? "text-primary" : p.progress >= 50 ? "text-amber-600" : "text-muted-foreground"}`}>
                      {p.progress}%
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${p.progress}%`,
                        background: p.progress >= 80
                          ? "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))"
                          : p.progress >= 50
                            ? "linear-gradient(90deg, hsl(38 95% 56%), hsl(38 95% 56% / 0.7))"
                            : "linear-gradient(90deg, hsl(var(--muted-foreground) / 0.5), hsl(var(--muted-foreground) / 0.3))"
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
