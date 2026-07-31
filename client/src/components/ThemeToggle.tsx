import { useEffect, useState } from "react";
import { MoonStar, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm"
        aria-label="Toggle color theme"
      >
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-background text-foreground shadow-sm transition-colors hover:bg-muted"
      aria-label="Toggle color theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </button>
  );
}
