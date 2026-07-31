import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchLecturerStudents } from "@/lib/api/lecturer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search, TrendingUp, BookOpen, Loader2 } from "lucide-react";

function ProgressBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-success" : value >= 50 ? "bg-warning" : value >= 20 ? "bg-primary" : "bg-muted-foreground/40";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

export default function LecturerStudentProgress() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["lecturer-students", user?.id],
    queryFn: () => fetchLecturerStudents(user!.id),
    enabled: !!user,
  });

  const filtered = students.filter(
    (s) =>
      s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.course_title?.toLowerCase().includes(search.toLowerCase())
  );

  const avgProgress =
    students.length > 0
      ? Math.round(students.reduce((a, s) => a + s.progress, 0) / students.length)
      : 0;

  const uniqueStudents = [...new Set(students.map((s) => s.user_id))].length;

  return (
    <div className="space-y-8 pb-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">My Students</h1>
        <p className="text-muted-foreground">Track student progress across all your courses</p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Users, label: "Unique Students", value: uniqueStudents, color: "text-info", bg: "bg-info/10", border: "border-info/20" },
          { icon: BookOpen, label: "Enrollments", value: students.length, color: "text-success", bg: "bg-success/10", border: "border-success/20" },
          { icon: TrendingUp, label: "Average Progress", value: `${avgProgress}%`, color: "text-accent", bg: "bg-accent/10", border: "border-accent/20" },
        ].map((s) => (
          <Card key={s.label} className={`border ${s.border} relative overflow-hidden`}>
            <div className={`absolute top-0 right-0 h-16 w-16 ${s.bg} rounded-full -translate-y-1/2 translate-x-1/2 blur-xl opacity-60`} />
            <CardContent className="flex items-center gap-3 p-4 relative">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg} border ${s.border} ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xl font-bold font-display">{isLoading ? "—" : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="glass rounded-2xl border border-border/60 p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by student name, email, or course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-border/60"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="text-5xl">👥</div>
          <h3 className="text-xl font-bold font-display">
            {search ? "No students match your search" : "No students yet"}
          </h3>
          <p className="text-muted-foreground text-sm">
            {search ? "Try adjusting your search." : "Students will appear here once they enroll in your courses."}
          </p>
        </div>
      ) : (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">
              {filtered.length} enrollment{filtered.length !== 1 ? "s" : ""}
              {search && <span className="text-muted-foreground font-normal ml-1">matching "{search}"</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filtered.map((student, i) => (
                <div key={`${student.user_id}-${student.course_id}-${i}`}
                  className="flex items-center gap-4 p-3 rounded-xl border border-border/50 bg-card/60 hover:bg-card transition-colors"
                >
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-sm">
                    {(student.full_name || student.email || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold truncate">{student.full_name || "Unknown"}</p>
                        <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                      </div>
                      <span className={`text-xs font-bold flex-shrink-0 ${
                        student.progress >= 80 ? "text-success" : student.progress >= 50 ? "text-warning" : "text-muted-foreground"
                      }`}>
                        {student.progress}%
                      </span>
                    </div>
                    <ProgressBar value={student.progress} />
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{student.course_title}</Badge>
                      {student.progress === 100 && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-success/10 text-success border-success/20">Completed</Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
