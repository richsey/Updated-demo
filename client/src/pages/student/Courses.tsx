import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Clock, Star, Users, Search, PlayCircle, Code,
  Filter, Loader2, ChevronDown, X, SlidersHorizontal,
} from "lucide-react";
import { useCourses } from "@/hooks/useSupabaseQuery";

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  format: string;
  thumbnail: string;
  instructor: string;
  rating: number;
  duration_minutes: number;
  enrolled_count: number;
}

const CATEGORIES  = ["All", "Frontend", "Backend", "Languages", "Styling"];
const DIFFICULTIES = ["All", "beginner", "intermediate", "advanced"];
const FORMATS      = ["All", "video", "interactive", "article"];
const SORT_OPTIONS = [
  { label: "Newest",     value: "newest" },
  { label: "Highest Rated", value: "rating" },
  { label: "Most Popular",  value: "popular" },
  { label: "Shortest",   value: "shortest" },
];

const difficultyConfig: Record<string, { label: string; class: string }> = {
  beginner:     { label: "Beginner",     class: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  intermediate: { label: "Intermediate", class: "bg-amber-50 text-amber-700 border-amber-200"   },
  advanced:     { label: "Advanced",     class: "bg-rose-50 text-rose-700 border-rose-200"     },
};

const formatIcons: Record<string, typeof PlayCircle> = {
  video: PlayCircle,
  interactive: Code,
  article: Code,
};

const difficultyLabel = (d: string) => difficultyConfig[d]?.label ?? d;

export default function Courses() {
  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [format, setFormat]         = useState("All");
  const [sortBy, setSortBy]         = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  const { data: courses = [], isLoading } = useCourses();

  const activeFilterCount = [
    category !== "All",
    difficulty !== "All",
    format !== "All",
    sortBy !== "newest",
  ].filter(Boolean).length;

  const clearAll = () => {
    setSearch("");
    setCategory("All");
    setDifficulty("All");
    setFormat("All");
    setSortBy("newest");
  };

  const filtered = (courses as Course[])
    .filter((c) => {
      const safeTitle       = c?.title ?? "";
      const safeDescription = c?.description ?? "";
      const matchSearch =
        safeTitle.toLowerCase().includes(search.toLowerCase()) ||
        safeDescription.toLowerCase().includes(search.toLowerCase());
      const matchCat   = category   === "All" || c?.category   === category;
      const matchDiff  = difficulty === "All" || c?.difficulty  === difficulty;
      const matchFmt   = format     === "All" || c?.format      === format;
      return matchSearch && matchCat && matchDiff && matchFmt;
    })
    .sort((a, b) => {
      if (sortBy === "rating")   return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === "popular")  return (b.enrolled_count ?? 0) - (a.enrolled_count ?? 0);
      if (sortBy === "shortest") return (a.duration_minutes ?? 0) - (b.duration_minutes ?? 0);
      return 0; // newest — keep DB order
    });

  return (
    <div className="space-y-8 pb-6">
      <div className="space-y-1">
        <h1 className="text-4xl font-bold font-display">Courses</h1>
        <p className="text-muted-foreground">Browse our library of AI-curated learning materials</p>
      </div>

      {/* ── Search + Filter Bar ── */}
      <div className="glass rounded-2xl border border-border/60 p-4 space-y-3">
        <div className="flex gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="course-search"
              placeholder="Search courses, topics..."
              className="pl-10 h-10 bg-secondary/50 border-border/60 focus:border-primary/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter toggle button */}
          <Button
            id="toggle-filters-btn"
            variant={showFilters || activeFilterCount > 0 ? "default" : "outline"}
            className={
              showFilters || activeFilterCount > 0
                ? "gradient-primary border-0 text-white glow-sm h-10 gap-2 flex-shrink-0"
                : "border-border/60 text-muted-foreground hover:text-foreground h-10 gap-2 flex-shrink-0"
            }
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-bold">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${showFilters ? "rotate-180" : ""}`}
            />
          </Button>

          {/* Sort */}
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer flex-shrink-0"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* ── Collapsible filter panel ── */}
        {showFilters && (
          <div className="border-t border-border/50 pt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Category */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    id={`cat-filter-${cat.toLowerCase()}`}
                    onClick={() => setCategory(cat)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium border transition-all duration-150 ${
                      category === cat
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border bg-background"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Difficulty</p>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <button
                    key={d}
                    id={`diff-filter-${d}`}
                    onClick={() => setDifficulty(d)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium border transition-all duration-150 ${
                      difficulty === d
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border bg-background"
                    }`}
                  >
                    {d === "All" ? "All Levels" : difficultyLabel(d)}
                  </button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Format</p>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f}
                    id={`fmt-filter-${f}`}
                    onClick={() => setFormat(f)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium border transition-all duration-150 ${
                      format === f
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border bg-background"
                    }`}
                  >
                    {f === "All" ? "All Formats" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="text-xs text-muted-foreground hover:text-destructive gap-1.5 h-7"
                >
                  <X className="h-3 w-3" />
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Active filter chips ── */}
      {(category !== "All" || difficulty !== "All" || format !== "All") && !showFilters && (
        <div className="flex flex-wrap gap-2">
          {category !== "All" && (
            <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {category}
              <button onClick={() => setCategory("All")} className="hover:text-primary/60 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {difficulty !== "All" && (
            <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {difficultyLabel(difficulty)}
              <button onClick={() => setDifficulty("All")} className="hover:text-primary/60 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {format !== "All" && (
            <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              {format.charAt(0).toUpperCase() + format.slice(1)}
              <button onClick={() => setFormat("All")} className="hover:text-primary/60 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Showing <span className="text-foreground font-medium">{filtered.length}</span> course{filtered.length !== 1 ? "s" : ""}
            {category !== "All" && <> in <span className="text-primary font-medium">{category}</span></>}
          </p>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((course: Course) => {
              const diff = difficultyConfig[course.difficulty] ?? difficultyConfig.beginner;
              const FormatIcon = formatIcons[course.format] || PlayCircle;
              return (
                <Link key={course.id} to={`/courses/${course.id}`} className="group block">
                  <div className="relative rounded-2xl border border-border/60 bg-card overflow-hidden card-hover h-full flex flex-col">
                    <div className="relative h-40 overflow-hidden bg-secondary">
                      <img
                        src={course.thumbnail}
                        alt={course.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                      <div className="absolute bottom-3 left-3 flex gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border ${diff.class}`}>
                          {diff.label}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white">
                          <FormatIcon className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>

                    <div className="p-5 flex flex-col flex-1 space-y-3">
                      <div>
                        <Badge variant="secondary" className="text-xs mb-2 bg-secondary/80">
                          {course.category}
                        </Badge>
                        <h3 className="text-base font-bold font-display group-hover:text-primary transition-colors leading-tight">
                          {course.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>
                      </div>

                      <div className="mt-auto pt-3 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            by <span className="text-foreground/80 font-medium">{course.instructor}</span>
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                              {course.rating}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {course.enrolled_count?.toLocaleString()}
                            </span>
                            {course.duration_minutes && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {Math.round(course.duration_minutes / 60)}h
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-20 space-y-3">
              <div className="text-5xl">🔍</div>
              <h3 className="text-xl font-bold font-display">No courses found</h3>
              <p className="text-muted-foreground text-sm">Try adjusting your search or filters</p>
              <Button variant="outline" onClick={clearAll}>
                <X className="h-4 w-4 mr-2" /> Clear all filters
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}