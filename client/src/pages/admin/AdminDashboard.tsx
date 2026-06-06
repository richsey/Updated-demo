import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, ClipboardList, TrendingUp, ArrowUpRight, Loader2, Bot, Wifi, WifiOff } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminStats } from "@/lib/api/admin";
import { useEffect, useState } from "react";

interface GeminiStatus {
  configured: boolean;
  status: string;
  model: string;
  error?: string | null;
}

function GeminiStatusCard() {
  const [status, setStatus] = useState<GeminiStatus | null>(null);
  const [checking, setChecking] = useState(true);

  const checkStatus = async () => {
    try {
      const res = await fetch("http://localhost:8001/gemini/status");
      if (!res.ok) throw new Error("bad response");
      const data: GeminiStatus = await res.json();
      setStatus(data);
    } catch {
      setStatus({ configured: false, status: "Offline", model: "gemini-2.5-flash", error: "AI service is unreachable" });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30_000); // re-check every 30 s
    return () => clearInterval(interval);
  }, []);

  const isReady = status?.configured && status?.status === "Ready";

  return (
    <Card className="border-border/60 relative overflow-hidden">
      <div className="absolute top-0 right-0 h-24 w-24 bg-violet-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
      <CardContent className="p-5 relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
            <Bot className="h-5 w-5" />
          </div>
          {checking ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isReady ? (
            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 gap-1 text-xs">
              <Wifi className="h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 gap-1 text-xs">
              <WifiOff className="h-3 w-3" /> {status?.status || "Unconfigured"}
            </Badge>
          )}
        </div>

        <p className="text-xl font-bold font-display">
          {checking
            ? "—"
            : isReady
            ? status?.model === "gemini-2.5-flash"
              ? "Gemini 2.5 Flash"
              : status?.model === "gemini-2.0-flash"
              ? "Gemini 2.0 Flash"
              : status?.model || "Gemini API"
            : "Gemini API Unconfigured"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Google Gemini Cloud LLM</p>

        {!checking && !isReady && (
          <div className="mt-3 text-xs text-muted-foreground space-y-1">
            <p>
              Add <code className="text-violet-400 font-mono">GEMINI_API_KEY</code> to your <code className="text-violet-400 font-mono">ai-service/.env</code> file to enable cloud-based AI recommendations and quizzes.
            </p>
            {status?.error && (
              <p className="text-red-400 font-mono text-[10px] bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/30 mt-1">
                Error: {status.error}
              </p>
            )}
          </div>
        )}

        {!checking && isReady && (
          <p className="mt-2 text-[11px] text-emerald-400/80">
            Using Google Gemini API — cloud recommendations and quiz generation enabled
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
  });

  const statCards = [
    { icon: Users,        label: "Total Students",  value: stats?.totalStudents ?? "—",           color: "text-primary",      bg: "bg-primary/10",     border: "border-primary/20"    },
    { icon: BookOpen,     label: "Active Courses",   value: stats?.activeCourses ?? "—",           color: "text-accent",       bg: "bg-accent/10",      border: "border-accent/20"     },
    { icon: ClipboardList,label: "Quiz Attempts",    value: stats?.totalQuizAttempts ?? "—",       color: "text-blue-400",     bg: "bg-blue-400/10",    border: "border-blue-400/20"   },
    { icon: TrendingUp,   label: "Avg Engagement",   value: stats ? `${stats.avgEngagement}%` : "—", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20"},
  ];

  if (isLoading) {
    return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8 pb-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform overview and real-time analytics</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label} className={`border ${s.border} card-hover relative overflow-hidden`}>
            <div className={`absolute top-0 right-0 h-24 w-24 ${s.bg} rounded-full -translate-y-1/2 translate-x-1/2 blur-xl opacity-60`} />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between mb-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} border ${s.border} ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium flex items-center gap-0.5 text-emerald-400">
                  <ArrowUpRight className="h-3 w-3" />live
                </span>
              </div>
              <p className="text-3xl font-bold font-display">
                {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gemini status card — full width below the stat grid */}
      <GeminiStatusCard />

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-base">Student Engagement</CardTitle>
            <p className="text-xs text-muted-foreground">Quiz attempts over time</p>
          </CardHeader>
          <CardContent>
            {stats?.studentEngagement?.length ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={stats.studentEngagement}>
                  <defs>
                    <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }} />
                  <Area type="monotone" dataKey="active" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#activeGrad)" name="Active" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <span className="text-3xl">📊</span>
                <span>No engagement data yet — requires Supabase RPC setup</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-base">Quiz Performance by Course</CardTitle>
            <p className="text-xs text-muted-foreground">Average scores across all enrolled students</p>
          </CardHeader>
          <CardContent>
            {(stats?.quizPerformance?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats!.quizPerformance} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="course" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="avgScore" radius={[6, 6, 0, 0]} fill="url(#adminBarGrad)" name="Avg Score" />
                  <defs>
                    <linearGradient id="adminBarGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={1} />
                      <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
                <span className="text-3xl">🎯</span>
                <span>No quiz attempts yet</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
