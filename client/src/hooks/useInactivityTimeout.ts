import { useEffect, useRef } from "react";

/**
 * A hook that logs out the user after a period of inactivity.
 * It uses Date.now() to ensure that even if the browser/machine is put to sleep,
 * the timeout will correctly trigger upon waking up.
 *
 * @param onTimeout - The function to call when the timeout is reached
 * @param timeoutMinutes - The number of minutes of inactivity before timing out
 * @param isActive - Whether the timeout tracker should be running
 */
export function useInactivityTimeout(
  onTimeout: () => void,
  timeoutMinutes: number = 30,
  isActive: boolean = true
) {
  const lastActiveRef = useRef<number>(Date.now());
  const onTimeoutRef = useRef(onTimeout);

  // Keep the latest callback without re-triggering the main effect
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!isActive) return;

    // Reset the timer when it becomes active
    lastActiveRef.current = Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const updateActivity = () => {
      lastActiveRef.current = Date.now();
    };

    const checkInactivity = () => {
      const now = Date.now();
      if (now - lastActiveRef.current >= timeoutMs) {
        onTimeoutRef.current();
      }
    };

    // Track common user interactions, including custom video activity
    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "videoActivity"];
    events.forEach((event) =>
      document.addEventListener(event, updateActivity, { passive: true })
    );

    // Check inactivity every 30 seconds
    const interval = setInterval(checkInactivity, 30 * 1000);

    // Also check immediately when the tab becomes visible (e.g. waking from sleep)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      events.forEach((event) =>
        document.removeEventListener(event, updateActivity)
      );
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [timeoutMinutes, isActive]);
}
