import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileBarChart, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { downloadCSV } from "@/lib/export";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminReports() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownloadUsers = async () => {
    setDownloading("User Export");
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role, phone, bio, created_at");

      if (error) throw error;

      const formattedData = (data as unknown as Array<{ id: string; full_name: string | null; role: string; phone: string | null; bio: string | null; created_at: string }>).map((u) => ({
        "User ID": u.id,
        "Full Name": u.full_name || "N/A",
        "Role": u.role,
        "Phone": u.phone || "N/A",
        "Bio": u.bio || "N/A",
        "Joined Date": new Date(u.created_at).toLocaleDateString(),
      }));

      downloadCSV(formattedData, `users_export_${new Date().toISOString().split("T")[0]}.csv`);
      toast({ title: "Success", description: "Users export downloaded successfully." });
    } catch (err: Error | unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast({ title: "Export Failed", description: msg, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadCourses = async () => {
    setDownloading("Course Catalog");
    try {
      const { data, error } = await supabase
        .from("courses")
        .select(`
          title,
          category,
          level,
          status,
          created_at,
          profiles:instructor_id (full_name)
        `);

      if (error) throw error;

      const doc = new jsPDF();
      doc.text("Course Catalog", 14, 15);
      
      const tableData = (data as unknown as Array<{ title: string; category: string | null; level: string | null; status: string; profiles: { full_name: string | null } | null; created_at: string }>).map((c) => [
        c.title,
        c.category || "N/A",
        c.level || "N/A",
        c.status,
        c.profiles?.full_name || "Unknown Instructor",
        new Date(c.created_at).toLocaleDateString(),
      ]);

      autoTable(doc, {
        head: [["Title", "Category", "Level", "Status", "Instructor", "Created At"]],
        body: tableData,
        startY: 20,
      });

      doc.save(`course_catalog_${new Date().toISOString().split("T")[0]}.pdf`);
      toast({ title: "Success", description: "Course catalog downloaded successfully." });
    } catch (err: Error | unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast({ title: "Export Failed", description: msg, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadEnrollments = async () => {
    setDownloading("Enrollment Data");
    try {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          progress,
          enrolled_at,
          last_accessed_at,
          profiles (full_name),
          courses (title)
        `);

      if (error) throw error;

      const formattedData = (data as unknown as Array<{ progress: number | null; enrolled_at: string; last_accessed_at: string | null; profiles: { full_name: string | null } | null; courses: { title: string | null } | null }>).map((e) => ({
        "Student Name": e.profiles?.full_name || "Unknown",
        "Course Title": e.courses?.title || "Unknown",
        "Progress (%)": e.progress || 0,
        "Enrolled At": new Date(e.enrolled_at).toLocaleDateString(),
        "Last Accessed": e.last_accessed_at ? new Date(e.last_accessed_at).toLocaleDateString() : "Never",
      }));

      downloadCSV(formattedData, `enrollments_export_${new Date().toISOString().split("T")[0]}.csv`);
      toast({ title: "Success", description: "Enrollment data downloaded successfully." });
    } catch (err: Error | unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast({ title: "Export Failed", description: msg, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadQuizPerformance = async () => {
    setDownloading("Quiz Performance");
    try {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select(`
          score,
          passed,
          completed_at,
          profiles (full_name),
          quizzes (title)
        `);

      if (error) throw error;

      const formattedData = (data as unknown as Array<{ score: number; passed: boolean; completed_at: string | null; profiles: { full_name: string | null } | null; quizzes: { title: string | null } | null }>).map((a) => ({
        "Student Name": a.profiles?.full_name || "Unknown",
        "Quiz Title": a.quizzes?.title || "Unknown",
        "Score": a.score,
        "Passed": a.passed ? "Yes" : "No",
        "Completed At": a.completed_at ? new Date(a.completed_at).toLocaleString() : "Incomplete",
      }));

      downloadCSV(formattedData, `quiz_performance_${new Date().toISOString().split("T")[0]}.csv`);
      toast({ title: "Success", description: "Quiz performance data downloaded successfully." });
    } catch (err: Error | unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      toast({ title: "Export Failed", description: msg, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const reports = [
    { title: "User Export", desc: "Download full list of all users, roles, and status", type: "CSV", action: handleDownloadUsers },
    { title: "Course Catalog", desc: "Export details of all published and draft courses", type: "PDF", action: handleDownloadCourses },
    { title: "Enrollment Data", desc: "Detailed breakdown of student enrollments and progress", type: "CSV", action: handleDownloadEnrollments },
    { title: "Quiz Performance", desc: "Export all quiz attempts, scores, and averages", type: "CSV", action: handleDownloadQuizPerformance },
  ];

  return (
    <div className="space-y-8 pb-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">System Reports</h1>
        <p className="text-muted-foreground">Export platform data and analytics</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.title} className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <FileBarChart className="h-4 w-4 text-primary" /> {report.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground min-h-[40px]">{report.desc}</p>
              <Button 
                className="w-full gap-2 border-border/60" 
                variant="outline"
                onClick={report.action}
                disabled={downloading !== null}
              >
                {downloading === report.title ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {downloading === report.title ? "Generating..." : `Download ${report.type}`}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
