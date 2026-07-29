/**
 * useTelemetry — The core behavioral telemetry hook.
 *
 * Captures ground-truth engagement signals:
 * - Active focus time (pauses on tab switch & idle)
 * - Batched event dispatch (30s intervals)
 * - sendBeacon on unload for zero data loss
 * - Convenience trackers for video, scroll, quiz
 * - Priority (unbatched) channel for explicit feedback
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { TelemetryAPI, TelemetryConfig, TelemetryEvent } from "@/lib/telemetry/types";
import { generateId, generateSessionId, sendBatch, sendPriorityEvent } from "@/lib/telemetry/utils";

const DEFAULT_BATCH_INTERVAL = 30_000;   // 30 seconds
const DEFAULT_IDLE_TIMEOUT = 180_000;    // 3 minutes
const DEFAULT_MAX_BATCH = 100;

export function useTelemetry(config: TelemetryConfig): TelemetryAPI {
  const { endpoint, batchIntervalMs = DEFAULT_BATCH_INTERVAL, idleTimeoutMs = DEFAULT_IDLE_TIMEOUT, maxBatchSize = DEFAULT_MAX_BATCH } = config;

  const location = useLocation();
  const { user } = useAuth();
  const userId = user?.id;
  const canTrack = !!userId;
  const sessionIdRef = useRef(generateSessionId());
  const eventQueueRef = useRef<TelemetryEvent[]>([]);

  // ── Active Time Tracking ─────────────────────────────────────────
  const activeTimeStorageKey = userId ? `active_time_${userId}` : null;
  const initialAccumulated = activeTimeStorageKey
    ? parseInt(localStorage.getItem(activeTimeStorageKey) || "0", 10)
    : 0;

  const [activeTimeMs, setActiveTimeMs] = useState(initialAccumulated);
  const [isActive, setIsActive] = useState(!document.hidden);
  const activeTimerStartRef = useRef<number>(document.hidden ? 0 : Date.now());
  const accumulatedTimeRef = useRef(initialAccumulated);

  // Sync state if userId changes
  useEffect(() => {
    if (activeTimeStorageKey) {
      const stored = parseInt(localStorage.getItem(activeTimeStorageKey) || "0", 10);
      accumulatedTimeRef.current = stored;
      setActiveTimeMs(stored);
      if (activeTimerStartRef.current > 0) {
        activeTimerStartRef.current = Date.now();
      }
    } else {
      accumulatedTimeRef.current = 0;
      setActiveTimeMs(0);
      if (activeTimerStartRef.current > 0) {
        activeTimerStartRef.current = Date.now();
      }
    }
  }, [activeTimeStorageKey]);
  /** Pause the active timer and return elapsed ms since last resume */
  const pauseTimer = useCallback(() => {
    if (activeTimerStartRef.current > 0) {
      const elapsed = Date.now() - activeTimerStartRef.current;
      accumulatedTimeRef.current += elapsed;
      activeTimerStartRef.current = 0;
      setActiveTimeMs(accumulatedTimeRef.current);
    }
    setIsActive(false);
  }, []);

  /** Resume the active timer */
  const resumeTimer = useCallback(() => {
    activeTimerStartRef.current = Date.now();
    setIsActive(true);
  }, []);

  /** Get current total active time */
  const getCurrentActiveTime = useCallback((): number => {
    const running = activeTimerStartRef.current > 0
      ? Date.now() - activeTimerStartRef.current
      : 0;
    return accumulatedTimeRef.current + running;
  }, []);

  // ── Event Creation ───────────────────────────────────────────────
  const createEvent = useCallback(
    (type: TelemetryEvent["type"], payload: Record<string, unknown> = {}): TelemetryEvent => ({
      id: generateId(),
      type,
      timestamp: Date.now(),
      activeTimeMs: getCurrentActiveTime(),
      payload,
      route: location.pathname,
      sessionId: sessionIdRef.current,
      user_id: userId!,
    }),
    [getCurrentActiveTime, location.pathname, userId]
  );

  // ── Queue & Flush ────────────────────────────────────────────────
  const flush = useCallback(() => {
    const events = eventQueueRef.current.splice(0);
    sendBatch(endpoint, events);
  }, [endpoint]);

  const enqueue = useCallback(
    (event: TelemetryEvent) => {
      eventQueueRef.current.push(event);
      if (eventQueueRef.current.length >= maxBatchSize) {
        flush();
      }
    },
    [flush, maxBatchSize]
  );

  // ── Public API ───────────────────────────────────────────────────
  const trackEvent = useCallback(
    (type: TelemetryEvent["type"], payload?: Record<string, unknown>) => {
      if (!canTrack) return;
      enqueue(createEvent(type, payload));
    },
    [enqueue, createEvent, canTrack]
  );

  const trackVideoSeek = useCallback(
    (oldTime: number, newTime: number) => {
      if (!canTrack) return;
      const delta = newTime - oldTime;
      enqueue(
        createEvent("video_seek", {
          oldTime,
          newTime,
          delta,
          direction: delta < 0 ? "rewind" : "forward",
        })
      );
    },
    [enqueue, createEvent, canTrack]
  );

  const trackScrollDepth = useCallback(
    (percentage: number) => {
      if (!canTrack) return;
      enqueue(
        createEvent("scroll_depth", {
          percentage: Math.round(percentage),
          activeTimeAtScroll: getCurrentActiveTime(),
        })
      );
    },
    [enqueue, createEvent, getCurrentActiveTime, canTrack]
  );

  const trackQuizHesitation = useCallback(
    (questionId: string, timeSpentMs: number) => {
      if (!canTrack) return;
      enqueue(
        createEvent("quiz_hesitation", { questionId, timeSpentMs })
      );
    },
    [enqueue, createEvent, canTrack]
  );

  const sendFeedback = useCallback(
    (type: "feedback_positive" | "feedback_negative", payload?: Record<string, unknown>) => {
      if (!canTrack) return;
      sendPriorityEvent(endpoint, createEvent(type, payload));
    },
    [endpoint, createEvent, canTrack]
  );

  // ── Page Visibility (Open Tab Problem) ───────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        pauseTimer();
        if (canTrack) enqueue(createEvent("focus_lost"));
      } else {
        resumeTimer();
        if (canTrack) enqueue(createEvent("focus_gained"));
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [pauseTimer, resumeTimer, enqueue, createEvent, canTrack]);

  // ── Idle Detection (3-min no-input) ──────────────────────────────
  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout>;
    let isIdle = false;

    const resetIdle = () => {
      clearTimeout(idleTimer);
      if (isIdle) {
        isIdle = false;
        resumeTimer();
        if (canTrack) enqueue(createEvent("idle_end"));
      }
      idleTimer = setTimeout(() => {
        isIdle = true;
        pauseTimer();
        if (canTrack) enqueue(createEvent("idle_start"));
      }, idleTimeoutMs);
    };

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle(); // Start the idle timer

    return () => {
      clearTimeout(idleTimer);
      events.forEach((e) => window.removeEventListener(e, resetIdle));
    };
  }, [idleTimeoutMs, pauseTimer, resumeTimer, enqueue, createEvent, canTrack]);

  // ── Batch Flush Interval ─────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(flush, batchIntervalMs);
    return () => clearInterval(interval);
  }, [flush, batchIntervalMs]);

  // ── Session Start / Unload ───────────────────────────────────────
  useEffect(() => {
    if (!canTrack) return;

    enqueue(createEvent("session_start"));

    const handleUnload = () => {
      if (!canTrack) return;
      enqueue(createEvent("session_end", { totalActiveTimeMs: getCurrentActiveTime() }));
      // Flush remaining events via sendBeacon
      const events = eventQueueRef.current.splice(0);
      sendBatch(endpoint, events);
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
      // Component unmount — flush remaining
      handleUnload();
    };
  }, [canTrack, enqueue, createEvent, getCurrentActiveTime, endpoint]);

  // If the user logs out/auth state changes, ensure we don't send queued events.
  useEffect(() => {
    if (!canTrack) {
      eventQueueRef.current = [];
    }
  }, [canTrack]);

  // ── Update activeTimeMs periodically for UI display ──────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const current = getCurrentActiveTime();
      setActiveTimeMs(current);
      if (activeTimeStorageKey) {
        localStorage.setItem(activeTimeStorageKey, current.toString());
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [getCurrentActiveTime, activeTimeStorageKey]);

  return {
    trackEvent,
    trackVideoSeek,
    trackScrollDepth,
    trackQuizHesitation,
    sendFeedback,
    activeTimeMs,
    isActive,
    sessionId: sessionIdRef.current,
  };
}
