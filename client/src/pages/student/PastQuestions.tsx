import { useState, useMemo } from "react";
import { Search, FileText, Download, BookOpen, ChevronRight, Hash, GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCourses, useQuizzes } from "@/hooks/useSupabaseQuery";
import jsPDF from "jspdf";
import type { Quiz } from "@/lib/types";

export default function PastQuestions() {
  const [search, setSearch] = useState("");
  const { data: courses = [], isLoading: coursesLoading } = useCourses();
  const { data: quizzes = [], isLoading: quizzesLoading } = useQuizzes();
  
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const filteredCourses = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return courses;
    return courses.filter(c => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [search, courses]);

  const selectedCourse = useMemo(() => {
    return courses.find(c => c.id === selectedCourseId) || null;
  }, [selectedCourseId, courses]);

  const courseQuizzes = useMemo(() => {
    if (!selectedCourseId) return [];
    return quizzes.filter(q => q.course_id === selectedCourseId);
  }, [selectedCourseId, quizzes]);

  const handleDownloadPDF = (quiz: Quiz) => {
    if (!selectedCourse) return;
    
    const doc = new jsPDF();
    const courseTitle = selectedCourse.title;
    
    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(courseTitle, 14, 20);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(`Practice Exam: ${quiz.title}`, 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 38);
    
    // Separator line
    doc.setDrawColor(200);
    doc.line(14, 42, 196, 42);
    
    doc.setTextColor(0); // reset text color to black
    let yPos = 52;
    
    quiz.questions?.forEach((q, index) => {
      // Add new page if close to bottom
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      
      // Question text
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const questionLines = doc.splitTextToSize(`${index + 1}. ${q.text}`, 180);
      doc.text(questionLines, 14, yPos);
      yPos += questionLines.length * 6;
      
      // Options
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const options = (q.options as string[]) || [];
      const letters = ['A', 'B', 'C', 'D', 'E'];
      
      options.forEach((opt, optIndex) => {
        if (yPos > 280) {
          doc.addPage();
          yPos = 20;
        }
        const optLines = doc.splitTextToSize(`   ${letters[optIndex]}. ${opt}`, 180);
        doc.text(optLines, 14, yPos);
        yPos += optLines.length * 6;
      });
      
      yPos += 8; // space between questions
    });
    
    doc.save(`${courseTitle.replace(/\s+/g, '_')}_${quiz.title.replace(/\s+/g, '_')}_Practice.pdf`);
  };

  const isLoading = coursesLoading || quizzesLoading;

  return (
    <div className="flex h-full flex-col gap-6 pb-10">
      
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          Past Questions
        </h1>
        <p className="text-muted-foreground">Search for a course and download practice exams.</p>
      </div>

      <div className="relative max-w-2xl w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for a course by title or category..."
          className="pl-12 h-14 text-base rounded-2xl bg-card border-border/60 shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid md:grid-cols-12 gap-8">
          
          {/* Left Column: Course List */}
          <div className="md:col-span-4 space-y-4">
            <h2 className="font-bold text-lg font-display">Courses</h2>
            <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-2">
              {filteredCourses.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-2xl border-border/60 bg-card/40">
                  <p className="text-muted-foreground text-sm">No courses found.</p>
                </div>
              ) : (
                filteredCourses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCourseId(c.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 group flex justify-between items-center ${
                      selectedCourseId === c.id
                        ? "bg-primary/10 border-primary/30 text-primary shadow-sm"
                        : "bg-card border-border/60 hover:bg-secondary/50 hover:border-border"
                    }`}
                  >
                    <div className="min-w-0 pr-4">
                      <p className={`font-semibold text-sm truncate ${selectedCourseId === c.id ? "text-primary" : "text-foreground"}`}>
                        {c.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{c.category}</p>
                    </div>
                    <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-transform ${selectedCourseId === c.id ? "text-primary translate-x-1" : "text-muted-foreground group-hover:translate-x-1"}`} />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Quizzes */}
          <div className="md:col-span-8 space-y-4">
            <h2 className="font-bold text-lg font-display flex items-center gap-2">
              <FileText className="h-5 w-5 text-accent" />
              {selectedCourse ? "Practice Quizzes" : "Select a Course"}
            </h2>

            {!selectedCourse ? (
              <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-border/60 rounded-3xl bg-card/30">
                <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <GraduationCap className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Ready to practice?</h3>
                <p className="text-muted-foreground text-sm mt-1 max-w-sm">
                  Select a course from the list to view and download available practice quizzes.
                </p>
              </div>
            ) : courseQuizzes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center border border-border/60 rounded-3xl bg-card/60">
                <p className="text-4xl mb-3">📄</p>
                <p className="font-semibold text-lg">No quizzes available</p>
                <p className="text-sm text-muted-foreground mt-1">This course doesn't have any quizzes yet.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {courseQuizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="bg-card border border-border/60 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                  >
                    <div>
                      <h3 className="font-bold text-lg">{quiz.title}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5"><Hash className="h-4 w-4" /> {quiz.questions?.length || 0} Questions</span>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleDownloadPDF(quiz)}
                      className="gap-2 shrink-0 sm:w-auto w-full"
                    >
                      <Download className="h-4 w-4" /> Download PDF
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
