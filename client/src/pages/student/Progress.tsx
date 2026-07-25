import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProgress, useUserQuizAttempts } from "@/hooks/useSupabaseQuery";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Calendar, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Progress() {
  const { data: progressData = [], isLoading: loadingProgress } = useUserProgress();
  const { data: attempts = [], isLoading: loadingAttempts } = useUserQuizAttempts();

  const isLoading = loadingProgress || loadingAttempts;

  const quizTrend = attempts.slice().reverse().map((a) => ({
    date: new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: Math.round((a.score / a.total_questions) * 100),
    course: (a.quizzes as { courses?: { title?: string } } | null)?.courses?.title ?? "",
  }));

  const avgScore = attempts.length > 0
    ? Math.round(attempts.reduce((acc, a) => acc + (a.score / a.total_questions) * 100, 0) / attempts.length)
    : 0;

  return (
    <div className="space-y-8 pb-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">My Progress</h1>
        <p className="text-muted-foreground">Your complete learning journey at a glance</p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        <div className="glass rounded-xl border border-primary/20 px-4 py-2.5 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span><span className="font-bold text-primary">{attempts.length}</span> quizzes completed</span>
        </div>
        <div className="glass rounded-xl border border-accent/20 px-4 py-2.5 flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4 text-accent" />
          <span>Average score: <span className="font-bold text-accent">{avgScore}%</span></span>
        </div>
        <div className="glass rounded-xl border border-blue-400/20 px-4 py-2.5 flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-blue-400" />
          <span><span className="font-bold text-blue-400">{progressData.length}</span> active courses</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Score Trend */}
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Score Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {quizTrend.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                    <span className="text-3xl">📈</span><span>Take some quizzes to see your trend</span>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={quizTrend}>
                      <defs>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="hsl(var(--primary))" />
                          <stop offset="100%" stopColor="hsl(var(--accent))" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
                        formatter={(val) => [`${val}%`, "Score"]}
                      />
                      <Line type="monotone" dataKey="score" strokeWidth={2.5} stroke="hsl(var(--primary))"
                        dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--background))" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Course Completion */}
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" /> Course Completion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {progressData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground text-sm gap-2">
                    <span className="text-3xl">📚</span><span>No courses started yet</span>
                  </div>
                ) : (
                  progressData.map((p) => (
                    <div key={p.course_id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Link to={`/courses/${p.course_id}`} className="text-sm font-medium hover:text-primary transition-colors truncate mr-4">
                          {p.courses?.title ?? "Course"}
                        </Link>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {p.completed_materials ?? "?"}/{p.total_materials ?? "?"} done
                          </span>
                          <span className={`text-sm font-bold ${p.progress >= 80 ? "text-primary" : p.progress >= 50 ? "text-amber-600" : "text-muted-foreground"}`}>
                            {p.progress}%
                          </span>
                        </div>
                      </div>
                      <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${p.progress}%`,
                            background: p.progress >= 80
                              ? "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.7))"
                              : p.progress >= 50
                                ? "linear-gradient(90deg, hsl(38 95% 56%), hsl(38 95% 56% / 0.7))"
                                : "linear-gradient(90deg, hsl(var(--muted-foreground) / 0.4), hsl(var(--muted-foreground) / 0.2))"
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Last accessed: {new Date(p.last_updated ?? Date.now()).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quiz History */}
          <Card className="border-border/60">
            <CardHeader className="pb-4">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Quiz History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attempts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                  <span className="text-3xl">🎯</span><span>No quiz attempts yet</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {attempts.map((a) => {
                    const pct = Math.round((a.score / a.total_questions) * 100);
                    const passed = pct >= 70;
                    return (
                      <div key={a.id}
                        className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${passed ? "border-primary/15 hover:border-primary/30 hover:bg-primary/5" : "border-destructive/15 hover:border-destructive/30 hover:bg-destructive/5"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${passed ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                            {passed ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{(a.quizzes as { courses?: { title?: string }; title?: string } | null)?.courses?.title ?? (a.quizzes as { title?: string } | null)?.title ?? "Quiz"}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(a.created_at).toLocaleDateString()} · {a.duration_seconds}s
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-bold font-display ${passed ? "text-primary" : "text-destructive"}`}>{pct}%</p>
                          <p className="text-xs text-muted-foreground">{a.score}/{a.total_questions} correct</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
