import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, BookOpen, ClipboardList, TrendingUp, ArrowUpRight, Loader2,
  Bot, Wifi, WifiOff, X, GraduationCap, Search, ChevronDown, ChevronRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminStats, fetchStudentsWithCourses } from "@/lib/api/admin";
import type { StudentDetail } from "@/lib/api/admin";
import { useEffect, useState } from "react";

// ─── Gemini Status Card ───────────────────────────────────────────────────────

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
      const AI_SERVICE_URL = import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8001";
      const res = await fetch(`${AI_SERVICE_URL}/gemini/status`);
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
    const interval = setInterval(checkStatus, 30_000);
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
            <Badge className="bg-success/15 text-success border border-success/30 gap-1 text-xs">
              <Wifi className="h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge className="bg-destructive/15 text-destructive border border-destructive/30 gap-1 text-xs">
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
              Add <code className="text-violet-400 font-mono">GEMINI_API_KEY</code> to your{" "}
              <code className="text-violet-400 font-mono">ai-service/.env</code> file to enable cloud-based AI
              recommendations and quizzes.
            </p>
            {status?.error && (
              <p className="text-destructive font-mono text-[10px] bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/20 mt-1">
                Error: {status.error}
              </p>
            )}
          </div>
        )}

        {!checking && isReady && (
          <p className="mt-2 text-[11px] text-success">
            Using Google Gemini API — cloud recommendations and quiz generation enabled
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-success" : value >= 50 ? "bg-warning" : value >= 20 ? "bg-primary" : "bg-muted-foreground/40";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

// ─── Student Row ──────────────────────────────────────────────────────────────

function StudentRow({ student }: { student: StudentDetail }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        {/* Avatar */}
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-sm">
          {student.fullName.charAt(0).toUpperCase()}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{student.fullName}</p>
          <p className="text-xs text-muted-foreground truncate">{student.email}</p>
        </div>
        {/* Course count badge */}
        <Badge variant="outline" className="text-xs flex-shrink-0 border-primary/20 text-primary">
          <GraduationCap className="h-3 w-3 mr-1" />
          {student.courses.length} {student.courses.length === 1 ? "course" : "courses"}
        </Badge>
        {/* Expand arrow */}
        {student.courses.length > 0 && (
          open
            ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {/* Expanded courses */}
      {open && student.courses.length > 0 && (
        <div className="border-t border-border/40 px-4 py-3 space-y-3 bg-muted/10">
          {student.courses.map((c) => (
            <div key={c.courseId} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{c.courseTitle}</p>
                  {c.category && (
                    <span className="text-[10px] text-muted-foreground">{c.category}</span>
                  )}
                </div>
                <span className={`text-xs font-semibold flex-shrink-0 ${
                  c.progress >= 80 ? "text-success"
                  : c.progress >= 50 ? "text-warning"
                  : "text-primary"
                }`}>
                  {c.progress}%
                </span>
              </div>
              <ProgressBar value={c.progress} />
            </div>
          ))}
        </div>
      )}

      {open && student.courses.length === 0 && (
        <div className="border-t border-border/40 px-4 py-3 bg-muted/10">
          <p className="text-xs text-muted-foreground">No courses enrolled yet.</p>
        </div>
      )}
    </div>
  );
}

// ─── Students Modal ───────────────────────────────────────────────────────────

function StudentsModal({ onClose }: { onClose: () => void }) {
  const [search, setSearch] = useState("");

  const { data: students = [], isLoading, error } = useQuery({
    queryKey: ["admin-students-detail"],
    queryFn: fetchStudentsWithCourses,
    staleTime: 60_000,
  });

  const filtered = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.courses.some((c) => c.courseTitle.toLowerCase().includes(search.toLowerCase()))
  );

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border/60 bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold font-display text-base">All Students</h2>
              <p className="text-xs text-muted-foreground">
                {students.length} student{students.length !== 1 ? "s" : ""} enrolled
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or course..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-muted/30 pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading students...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load student data.
            </div>
          )}

          {!isLoading && !error && filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {search ? "No students match your search." : "No students registered yet."}
            </div>
          )}

          {!isLoading && !error && filtered.map((student) => (
            <StudentRow key={student.id} student={student} />
          ))}
        </div>

        {/* Footer summary */}
        {!isLoading && students.length > 0 && (
          <div className="px-5 py-3 border-t border-border/40 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{students.filter(s => s.courses.length > 0).length}</span> enrolled in courses
            </span>
            <span>
              <span className="font-semibold text-foreground">{students.filter(s => s.courses.length === 0).length}</span> not yet enrolled
            </span>
            <span className="ml-auto">
              Total enrollments: <span className="font-semibold text-foreground">
                {students.reduce((sum, s) => sum + s.courses.length, 0)}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
  });

  const [showStudentsModal, setShowStudentsModal] = useState(false);

  const statCards = [
    {
      icon: Users,
      label: "Total Students",
      value: stats?.totalStudents ?? "—",
      color: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
      clickable: true,
      onClick: () => setShowStudentsModal(true),
    },
    { icon: BookOpen,      label: "Active Courses",  value: stats?.activeCourses ?? "—",           color: "text-accent",       bg: "bg-accent/10",      border: "border-accent/20",      clickable: false },
    { icon: ClipboardList, label: "Quiz Attempts",   value: stats?.totalQuizAttempts ?? "—",       color: "text-blue-400",     bg: "bg-blue-400/10",    border: "border-blue-400/20",    clickable: false },
    { icon: TrendingUp,    label: "Average Engagement",  value: stats ? `${stats.avgEngagement}%` : "—", color: "text-success", bg: "bg-success/10", border: "border-success/20", clickable: false },
  ];

  if (isLoading) {
    return <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      {showStudentsModal && <StudentsModal onClose={() => setShowStudentsModal(false)} />}

      <div className="space-y-8 pb-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold font-display">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform overview and real-time analytics</p>
        </div>

        {/* Stat cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((s) => (
            <Card
              key={s.label}
              className={`border ${s.border} relative overflow-hidden transition-all ${
                s.clickable
                  ? "cursor-pointer hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5"
                  : "card-hover"
              }`}
              onClick={s.clickable ? s.onClick : undefined}
            >
              <div className={`absolute top-0 right-0 h-24 w-24 ${s.bg} rounded-full -translate-y-1/2 translate-x-1/2 blur-xl opacity-60`} />
              <CardContent className="p-5 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} border ${s.border} ${s.color}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium flex items-center gap-0.5 text-success">
                    <ArrowUpRight className="h-3 w-3" />live
                  </span>
                </div>
                <p className="text-3xl font-bold font-display">
                  {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  {s.label}
                  {s.clickable && (
                    <span className="text-primary/60 text-[10px] font-medium">(click to view)</span>
                  )}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gemini status card */}
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
                    <Bar dataKey="avgScore" radius={[6, 6, 0, 0]} fill="url(#adminBarGrad)" name="Average Score" />
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
    </>
  );
}
