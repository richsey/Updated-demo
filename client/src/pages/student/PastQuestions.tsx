import { useState, useMemo } from "react";
import { Search, FileText, Download, BookOpen, ChevronRight, Clock, Hash, BookMarked, ExternalLink, Eye, X, GraduationCap, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Data Model ─────────────────────────────────────────────────────────────
interface PastPaper {
  paper_id: string;
  course_details: { code: string; title: string; level: number; department: string };
  exam_metadata: { year: number; semester: 1 | 2; type: "mid-term" | "final" | "quiz" | "resit"; duration_minutes: number; total_questions: number };
  files: { pdf_url: string; };
  viewed?: boolean;
}

// ─── Sample Data ─────────────────────────────────────────────────────────────
const PAPERS: PastPaper[] = [
  { paper_id: "1", course_details: { code: "CSC 201", title: "Data Structures & Algorithms", level: 200, department: "Computer Science" }, exam_metadata: { year: 2024, semester: 1, type: "final", duration_minutes: 120, total_questions: 60 }, files: { pdf_url: "#" }, viewed: true },
  { paper_id: "2", course_details: { code: "CSC 201", title: "Data Structures & Algorithms", level: 200, department: "Computer Science" }, exam_metadata: { year: 2023, semester: 2, type: "mid-term", duration_minutes: 90, total_questions: 40 }, files: { pdf_url: "#" }, viewed: false },
  { paper_id: "3", course_details: { code: "CSC 201", title: "Data Structures & Algorithms", level: 200, department: "Computer Science" }, exam_metadata: { year: 2023, semester: 1, type: "final", duration_minutes: 120, total_questions: 60 }, files: { pdf_url: "#" }, viewed: false },
  { paper_id: "4", course_details: { code: "MTH 202", title: "Linear Algebra", level: 200, department: "Mathematics" }, exam_metadata: { year: 2024, semester: 1, type: "final", duration_minutes: 180, total_questions: 80 }, files: { pdf_url: "#" }, viewed: true },
  { paper_id: "5", course_details: { code: "MTH 202", title: "Linear Algebra", level: 200, department: "Mathematics" }, exam_metadata: { year: 2024, semester: 1, type: "mid-term", duration_minutes: 90, total_questions: 50 }, files: { pdf_url: "#" }, viewed: false },
  { paper_id: "6", course_details: { code: "CSC 301", title: "Operating Systems", level: 300, department: "Computer Science" }, exam_metadata: { year: 2024, semester: 2, type: "final", duration_minutes: 120, total_questions: 70 }, files: { pdf_url: "#" }, viewed: false },
  { paper_id: "7", course_details: { code: "CSC 301", title: "Operating Systems", level: 300, department: "Computer Science" }, exam_metadata: { year: 2023, semester: 2, type: "resit", duration_minutes: 180, total_questions: 80 }, files: { pdf_url: "#" }, viewed: false },
  { paper_id: "8", course_details: { code: "ENG 101", title: "Technical Writing", level: 100, department: "Engineering" }, exam_metadata: { year: 2024, semester: 1, type: "mid-term", duration_minutes: 60, total_questions: 30 }, files: { pdf_url: "#" }, viewed: true },
  { paper_id: "9", course_details: { code: "CSC 401", title: "Machine Learning", level: 400, department: "Computer Science" }, exam_metadata: { year: 2024, semester: 2, type: "final", duration_minutes: 150, total_questions: 65 }, files: { pdf_url: "#" }, viewed: false },
  { paper_id: "10", course_details: { code: "CSC 401", title: "Machine Learning", level: 400, department: "Computer Science" }, exam_metadata: { year: 2023, semester: 1, type: "mid-term", duration_minutes: 90, total_questions: 40 }, files: { pdf_url: "#" }, viewed: false },
];

const TYPE_CONFIG = {
  "mid-term":  { label: "Mid-Term",  color: "bg-amber-500/15 text-amber-400 border-amber-500/30"  },
  "final":     { label: "Final",     color: "bg-primary/15 text-primary border-primary/30"          },
  "quiz":      { label: "Quiz",      color: "bg-accent/15 text-accent border-accent/30"             },
  "resit":     { label: "Resit",     color: "bg-rose-500/15 text-rose-400 border-rose-500/30"       },
};

const SEM_LABEL: Record<number, string> = { 1: "First Semester", 2: "Second Semester" };
const LEVEL_LABEL: Record<number, string> = { 100: "Year 1 / Freshman", 200: "Year 2 / Sophomore", 300: "Year 3 / Junior", 400: "Year 4 / Senior" };

// ─── Component ───────────────────────────────────────────────────────────────
export default function PastQuestions() {
  const [search, setSearch] = useState("");
  const [selectedLevel, setSelectedLevel] = useState<number | "all">("all");
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<string>("all");
  const [previewPaper, setPreviewPaper] = useState<PastPaper | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(
    new Set(PAPERS.filter((p) => p.viewed).map((p) => p.paper_id))
  );

  // Build course list for sidebar tree
  const courseTree = useMemo(() => {
    const map: Record<string, { code: string; title: string; level: number; count: number }> = {};
    PAPERS.forEach((p) => {
      const key = p.course_details.code;
      if (!map[key]) map[key] = { code: p.course_details.code, title: p.course_details.title, level: p.course_details.level, count: 0 };
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => a.level - b.level || a.code.localeCompare(b.code));
  }, []);

  const levels = [...new Set(courseTree.map((c) => c.level))].sort();

  const filteredCourses = courseTree.filter((c) => {
    const q = search.toLowerCase();
    return (selectedLevel === "all" || c.level === selectedLevel) &&
      (c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
  });

  // Papers for the selected course
  const displayedPapers = useMemo(() => {
    if (!activeCourse) return [];
    return PAPERS.filter((p) =>
      p.course_details.code === activeCourse &&
      (activeTypeFilter === "all" || p.exam_metadata.type === activeTypeFilter)
    ).sort((a, b) => b.exam_metadata.year - a.exam_metadata.year || b.exam_metadata.semester - a.exam_metadata.semester);
  }, [activeCourse, activeTypeFilter]);

  const activeCourseDetails = activeCourse ? courseTree.find((c) => c.code === activeCourse) : null;

  const handleOpenPreview = (paper: PastPaper) => {
    setPreviewPaper(paper);
    setViewedIds((prev) => new Set([...prev, paper.paper_id]));
  };

  return (
    <div className="flex h-full gap-0 -m-6 overflow-hidden" style={{ height: "calc(100vh - 3.5rem)" }}>

      {/* ── Left Sidebar: Course Tree ─────────────────────────────────────── */}
      <aside className="w-72 flex-shrink-0 border-r border-border/60 bg-card/40 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border/60 space-y-3">
          <div className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-primary" />
            <h2 className="font-bold font-display text-base">Past Questions</h2>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-400 leading-relaxed">
            <span className="mt-0.5">⚠️</span>
            <span>Sample previews only — real papers &amp; downloads coming soon.</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search course code..."
              className="pl-9 h-8 text-xs bg-secondary/40 border-border/60"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedLevel("all")}
              className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${selectedLevel === "all" ? "bg-primary/15 text-primary border-primary/30" : "border-border/60 text-muted-foreground hover:text-foreground"}`}
            >All Levels</button>
            {levels.map((l) => (
              <button
                key={l}
                onClick={() => setSelectedLevel(l)}
                className={`text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${selectedLevel === l ? "bg-primary/15 text-primary border-primary/30" : "border-border/60 text-muted-foreground hover:text-foreground"}`}
              >{l} Level</button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {levels.filter((l) => selectedLevel === "all" || l === selectedLevel).map((level) => {
            const courses = filteredCourses.filter((c) => c.level === level);
            if (courses.length === 0) return null;
            return (
              <div key={level} className="mb-3">
                <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest px-3 py-2">
                  {LEVEL_LABEL[level] || `Year ${level / 100}`}
                </p>
                {courses.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => { setActiveCourse(c.code); setActiveTypeFilter("all"); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between group transition-all duration-150 ${activeCourse === c.code ? "bg-primary/15 text-primary border border-primary/20" : "hover:bg-secondary/60 text-foreground/70 hover:text-foreground"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-mono font-bold ${activeCourse === c.code ? "text-primary" : "text-foreground"}`}>{c.code}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{c.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <span className="text-[10px] text-muted-foreground">{c.count}</span>
                      <ChevronRight className={`h-3 w-3 transition-transform ${activeCourse === c.code ? "rotate-90 text-primary" : "text-muted-foreground"}`} />
                    </div>
                  </button>
                ))}
              </div>
            );
          })}

          {filteredCourses.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4 space-y-2">
              <p className="text-3xl">🔍</p>
              <p className="text-sm font-semibold">No courses found</p>
              <p className="text-xs text-muted-foreground">Try a different code or level</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Workspace ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-background/50">
        {!activeCourse ? (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full space-y-5 text-center p-8">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <GraduationCap className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-display">Select a Course</h2>
              <p className="text-muted-foreground text-sm max-w-xs">
                Choose a course from the left sidebar to browse its past examination papers.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-4">
              {courseTree.slice(0, 4).map((c) => (
                <button key={c.code} onClick={() => setActiveCourse(c.code)}
                  className="font-mono text-xs font-bold px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary hover:bg-primary/15 transition-all"
                >{c.code}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Past Questions</span>
              <ChevronRight className="h-3 w-3" />
              <span>{LEVEL_LABEL[activeCourseDetails?.level ?? 100]}</span>
              <ChevronRight className="h-3 w-3" />
              <span className="font-mono font-bold text-foreground">{activeCourseDetails?.code}</span>
            </div>

            {/* Course Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-2xl font-black text-primary tracking-tight">{activeCourseDetails?.code}</p>
                <h1 className="text-xl font-bold font-display mt-1">{activeCourseDetails?.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {LEVEL_LABEL[activeCourseDetails?.level ?? 100]} · {displayedPapers.length} paper{displayedPapers.length !== 1 ? "s" : ""} available
                </p>
              </div>
            </div>

            {/* Type Filter Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {["all", "final", "mid-term", "quiz", "resit"].map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTypeFilter(t)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all capitalize ${activeTypeFilter === t ? "bg-primary/15 text-primary border-primary/30" : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"}`}
                >
                  {t === "all" ? "All Types" : TYPE_CONFIG[t as keyof typeof TYPE_CONFIG]?.label ?? t}
                </button>
              ))}
            </div>

            {/* Papers List */}
            <div className="space-y-3">
              {displayedPapers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-3 text-center border border-dashed border-border/60 rounded-3xl bg-card/30">
                  <p className="text-4xl">📄</p>
                  <p className="font-semibold">No papers available for this filter</p>
                  <p className="text-sm text-muted-foreground">Try selecting "All Types" or check back later.</p>
                </div>
              ) : (
                displayedPapers.map((paper) => {
                  const typeCfg = TYPE_CONFIG[paper.exam_metadata.type];
                  const isViewed = viewedIds.has(paper.paper_id);
                  return (
                    <div
                      key={paper.paper_id}
                      className="group bg-card/60 border border-border/60 rounded-2xl p-5 flex items-center gap-5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
                    >
                      {/* File Icon */}
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-border/60 bg-secondary/50 text-muted-foreground group-hover:bg-primary/10 group-hover:border-primary/20 group-hover:text-primary transition-all">
                        <FileText className="h-6 w-6" />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          <span className="font-bold text-base">{paper.exam_metadata.year}</span>
                          <span className="text-muted-foreground text-sm">{SEM_LABEL[paper.exam_metadata.semester]}</span>
                          <Badge className={`text-[10px] font-bold px-2 py-0.5 border ${typeCfg.color}`}>
                            {typeCfg.label}
                          </Badge>
                          {isViewed && (
                            <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" /> Viewed
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {paper.exam_metadata.total_questions} Questions</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {paper.exam_metadata.duration_minutes} Minutes</span>
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> PDF</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs border-border/60 hover:border-primary/40 hover:text-primary h-8"
                          onClick={() => handleOpenPreview(paper)}
                        >
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Button>
                        <Button
                          size="sm"
                          disabled
                          className="gap-1.5 text-xs h-8 opacity-40 cursor-not-allowed"
                        >
                          <Download className="h-3.5 w-3.5" /> Download
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Right Preview Panel (Slide-out) ────────────────────────────────── */}
      {previewPaper && (
        <aside className="w-80 flex-shrink-0 border-l border-border/60 bg-card/80 backdrop-blur-lg flex flex-col overflow-hidden animate-in slide-in-from-right-8 duration-300">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <h3 className="font-bold font-display text-sm">Exam Preview</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setPreviewPaper(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Identity */}
            <div className="space-y-2">
              <p className="font-mono text-xl font-black text-primary">{previewPaper.course_details.code}</p>
              <p className="font-semibold text-sm leading-snug">{previewPaper.course_details.title}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={`text-[10px] font-bold border ${TYPE_CONFIG[previewPaper.exam_metadata.type].color}`}>
                  {TYPE_CONFIG[previewPaper.exam_metadata.type].label}
                </Badge>
                <span className="text-xs text-muted-foreground">{previewPaper.exam_metadata.year} · {SEM_LABEL[previewPaper.exam_metadata.semester]}</span>
              </div>
            </div>

            <div className="h-px bg-border/40" />

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total Questions", value: previewPaper.exam_metadata.total_questions, icon: Hash },
                { label: "Duration", value: `${previewPaper.exam_metadata.duration_minutes}m`, icon: Clock },
                { label: "Level", value: `${previewPaper.course_details.level} Lvl`, icon: GraduationCap },
                { label: "Format", value: "PDF", icon: FileText },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-secondary/40 rounded-xl p-3 border border-border/40">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Icon className="h-3 w-3" />
                    <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
                  </div>
                  <p className="font-bold text-sm">{value}</p>
                </div>
              ))}
            </div>

            <div className="h-px bg-border/40" />

            {/* PDF Preview Placeholder */}
            <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/20 flex flex-col items-center justify-center py-12 space-y-3 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-muted-foreground">PDF Preview</p>
                <p className="text-[10px] text-muted-foreground/60">Open the PDF to view full contents</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs mt-2" asChild>
                <a href={previewPaper.files.pdf_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" /> Open in Browser
                </a>
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-border/60 space-y-2">
            <Button disabled className="w-full h-11 text-sm font-bold opacity-40 cursor-not-allowed gap-2">
              <Download className="h-4 w-4" /> Download Coming Soon
            </Button>
          </div>
        </aside>
      )}
    </div>
  );
}
