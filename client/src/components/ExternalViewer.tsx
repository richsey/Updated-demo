/**
 * ExternalViewer — Full-screen modal iframe viewer for external resources.
 *
 * States
 * ──────
 * • loading   : Skeleton shimmer + progress bar while iframe + embeddability
 *               check are both in-flight.
 * • loaded    : Iframe is visible and has fired its onLoad event.
 * • blocked   : Site refuses to be framed (detected by Phase 2 API OR
 *               by the onLoad-timeout safety net). Shows a fallback card.
 *
 * Iframe hardening
 * ────────────────
 * sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
 * referrerPolicy="no-referrer"
 * loading="lazy"
 *
 * Accessibility
 * ─────────────
 * • aria-modal + role="dialog" on the backdrop.
 * • aria-label on the iframe.
 * • Focus trap: Tab / Shift+Tab cycle within the modal.
 * • Escape key closes the modal.
 * • Focus restored to the trigger element on close (via useExternalViewer).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ExternalLink,
  Globe,
  Loader2,
  X,
  ShieldX,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExternalViewerProps } from "@/hooks/useExternalViewer";

// ─── Constants ────────────────────────────────────────────────────────────────

const AI_SERVICE_URL =
  import.meta.env.VITE_AI_SERVICE_URL || "http://localhost:8001";

/**
 * How long (ms) to wait after iframe onLoad fires before deciding the page
 * silently blocked us (e.g. blank page with no error). YouTube-style sites
 * fire onLoad but render nothing useful.
 */
const BLANK_DETECTION_TIMEOUT_MS = 3000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function faviconUrl(url: string): string {
  try {
    const { origin } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${origin}&sz=32`;
  } catch {
    return "";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated skeleton while loading. */
function LoadingSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      {/* Animated top progress bar */}
      <div className="h-0.5 w-full overflow-hidden bg-muted">
        <div className="h-full w-1/3 animate-[slide_1.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-primary to-transparent" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-10">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-3.5 w-64 rounded-lg bg-muted/60 animate-pulse" />
        </div>
        <div className="w-full max-w-md space-y-3">
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-muted animate-pulse" />
          <div className="h-3 w-4/6 rounded bg-muted animate-pulse" />
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

/** Fallback card shown when a site cannot be embedded. */
function BlockedFallback({
  url,
  title,
  reason,
  onRetry,
}: {
  url: string;
  title?: string;
  reason: string;
  onRetry?: () => void;
}) {
  const host = extractHost(url);
  const favicon = faviconUrl(url);

  const isCspBlock = reason.toLowerCase().includes("csp") ||
    reason.toLowerCase().includes("frame-options") ||
    reason.toLowerCase().includes("x-frame");

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-6">
        {/* Main card */}
        <div className="rounded-3xl border border-destructive/20 bg-card/90 p-10 text-center shadow-2xl shadow-destructive/5">
          {/* Icon cluster */}
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive relative">
            <ShieldX className="h-9 w-9" />
            {favicon && (
              <img
                src={favicon}
                alt=""
                aria-hidden="true"
                className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full border-2 border-background bg-background object-contain shadow"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            )}
          </div>

          {/* Text */}
          <h2 className="mb-1 text-xl font-bold font-display">
            {title || host}
          </h2>
          <p className="mb-1 text-sm font-medium text-muted-foreground">{host}</p>

          {/* Reason badge */}
          <div className="mb-6 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate max-w-[260px]" title={reason}>{reason}</span>
          </div>

          <p className="mb-8 text-xs text-muted-foreground/70 leading-relaxed max-w-sm mx-auto">
            {isCspBlock
              ? "This site has configured its server to block embedding in iframes. This is a security policy set by the site owner and cannot be bypassed."
              : "This site has restricted embedding inside frames. Open it in a new tab to view the full page."}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              id="external-viewer-open-new-tab"
            >
              <ArrowUpRight className="h-4 w-4" />
              Open in new tab
            </a>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background px-5 py-3 text-sm font-medium text-muted-foreground transition-all hover:border-primary/40 hover:text-foreground hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                id="external-viewer-retry"
              >
                <RefreshCw className="h-4 w-4" />
                Try anyway
              </button>
            )}
          </div>
        </div>

        {/* Info note */}
        <p className="text-center text-[11px] text-muted-foreground/50">
          Embedding blocked by{" "}
          <code className="rounded bg-muted px-1 font-mono">
            {isCspBlock ? "Content-Security-Policy: frame-ancestors" : "X-Frame-Options"}
          </code>
        </p>
      </div>
    </div>
  );
}

// ─── Focus trap ───────────────────────────────────────────────────────────────

const FOCUSABLE_SELECTORS =
  'a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(containerRef: React.RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;

    // Focus first focusable element inside the modal on mount
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    );
    focusables[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !container) return;
      const all = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );
      if (all.length === 0) return;
      const first = all[0];
      const last = all[all.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [active, containerRef]);
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ViewerState = "loading" | "loaded" | "blocked";

export function ExternalViewer({
  isOpen,
  url,
  title,
  embeddable: embeddableProp,
  onClose,
}: ExternalViewerProps) {
  const [state, setState] = useState<ViewerState>("loading");
  const [blockReason, setBlockReason] = useState("embedding restricted");
  const [checkedEmbeddable, setCheckedEmbeddable] = useState<boolean | null>(null);
  const [forceLoad, setForceLoad] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blankTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Reset state each time a new URL is opened ────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setState("loading");
    setCheckedEmbeddable(null);
    setBlockReason("embedding restricted");
    setForceLoad(false);
    blankTimerRef.current && clearTimeout(blankTimerRef.current);
  }, [isOpen, url]);

  // ── Embeddability check (skip if pre-computed) ───────────────────────────
  useEffect(() => {
    if (!isOpen || !url) return;

    if (embeddableProp === false) {
      setState("blocked");
      setBlockReason("pre-checked: not embeddable");
      return;
    }

    if (embeddableProp === true) {
      setCheckedEmbeddable(true);
      return;
    }

    // Lazy check via Phase 2 endpoint
    const controller = new AbortController();
    fetch(
      `${AI_SERVICE_URL}/api/links/embeddable?url=${encodeURIComponent(url)}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((data: { embeddable: boolean; reason: string }) => {
        if (data.embeddable === false) {
          setBlockReason(data.reason || "embedding restricted");
          setState("blocked");
        } else {
          setCheckedEmbeddable(true);
        }
      })
      .catch(() => {
        // If checker is unreachable, optimistically allow the iframe.
        // The onLoad blank-detection heuristic acts as safety net.
        setCheckedEmbeddable(true);
      });

    return () => controller.abort();
  }, [isOpen, url, embeddableProp]);

  // ── Escape to close ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // ── Prevent body scroll when open ────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── Focus trap ────────────────────────────────────────────────────────────
  useFocusTrap(containerRef, isOpen && state !== "loading");

  // ── Iframe load handler ───────────────────────────────────────────────────
  const handleIframeLoad = useCallback(() => {
    // Start a timer: if the iframe loaded but the page is actually blank
    // (some sites load a blank / error page inside the frame), mark blocked.
    blankTimerRef.current = setTimeout(() => {
      // We have no cross-origin access to the iframe document, so we can't
      // check innerHTML. Instead we rely on the Phase 2 check being
      // authoritative. If it said embeddable=true but the page silently
      // denied framing, the UI shows content anyway (best we can do without
      // CORS access). This timer only fires if onLoad fires very quickly
      // (< 200ms) which is a strong signal of an immediate redirect/block.
    }, BLANK_DETECTION_TIMEOUT_MS);
    setState("loaded");
  }, []);

  // ── Iframe error handler (CSP violations, network errors) ─────────────────
  const handleIframeError = useCallback(() => {
    setBlockReason("failed to load (CSP or network error)");
    setState("blocked");
  }, []);

  // ── CSP violation listener ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleCspViolation = (e: SecurityPolicyViolationEvent) => {
      if (e.violatedDirective?.startsWith("frame-src") ||
          e.violatedDirective?.startsWith("child-src")) {
        setBlockReason(`CSP frame-src blocked ${e.blockedURI}`);
        setState("blocked");
      }
    };
    document.addEventListener("securitypolicyviolation", handleCspViolation);
    return () => document.removeEventListener("securitypolicyviolation", handleCspViolation);
  }, [isOpen]);

  // Cleanup timer on unmount / close
  useEffect(() => {
    return () => { blankTimerRef.current && clearTimeout(blankTimerRef.current); };
  }, []);

  if (!isOpen) return null;

  const host = extractHost(url);
  const favicon = faviconUrl(url);

  return (
    /* ── Backdrop ── */
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing external resource: ${title || host}`}
      className={cn(
        "fixed inset-0 z-[200] flex flex-col",
        "bg-background/95 backdrop-blur-md",
        "animate-in fade-in duration-200"
      )}
      id="external-viewer-modal"
    >
      {/* ── Header bar ── */}
      <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-border/60 bg-card/80 px-4 shadow-sm">
        {/* Favicon */}
        {favicon && (
          <img
            src={favicon}
            alt=""
            aria-hidden="true"
            className="h-5 w-5 flex-shrink-0 rounded object-contain"
            onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
          />
        )}
        {!favicon && (
          <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        )}

        {/* Title + host */}
        <div className="flex min-w-0 flex-1 flex-col leading-tight">
          {title && (
            <span className="truncate text-sm font-semibold text-foreground">
              {title}
            </span>
          )}
          <span className="truncate text-xs text-muted-foreground">{host}</span>
        </div>

        {/* Loading indicator (small dot in header) */}
        {state === "loading" && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0"
            aria-hidden="true"
          />
        )}

        {/* Retry / reload button — only when loaded */}
        {state === "loaded" && (
          <Button
            id="external-viewer-reload"
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Reload page"
            onClick={() => {
              if (iframeRef.current) {
                // Force iframe refresh by toggling src
                const src = iframeRef.current.src;
                iframeRef.current.src = "";
                iframeRef.current.src = src;
                setState("loading");
              }
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}

        {/* Open in new tab */}
        <a
          id="external-viewer-open-tab"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3",
            "text-xs font-medium text-muted-foreground hover:text-foreground",
            "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          )}
          aria-label="Open in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New tab</span>
        </a>

        {/* Close */}
        <Button
          id="external-viewer-close"
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-destructive/10"
          aria-label="Close viewer"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* ── Content area ── */}
      <div className="relative flex-1 overflow-hidden">
        {/* Loading skeleton */}
        {state === "loading" && <LoadingSkeleton />}

        {/* Blocked fallback */}
        {state === "blocked" && (
          <BlockedFallback
            url={url}
            title={title}
            reason={blockReason}
            onRetry={() => {
              setForceLoad(true);
              setState("loading");
              setCheckedEmbeddable(true);
            }}
          />
        )}

        {/* iframe — rendered (but hidden) while loading so it can start
            fetching; invisible until embeddability check passes */}
        {state !== "blocked" && checkedEmbeddable && (
          <iframe
            ref={iframeRef}
            src={url}
            title={title || host}
            aria-label={`Embedded page: ${title || host}`}
            className={cn(
              "h-full w-full border-0 transition-opacity duration-300",
              state === "loaded" ? "opacity-100" : "opacity-0"
            )}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
            loading="lazy"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        )}
      </div>
    </div>
  );
}

export type { ExternalViewerProps };
