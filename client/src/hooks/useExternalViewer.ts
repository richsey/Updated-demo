/**
 * useExternalViewer — Hook to open ExternalViewer from any trigger element.
 *
 * Usage:
 *   const { open, viewerProps } = useExternalViewer();
 *   ...
 *   <button onClick={() => open({ url, title })}>View</button>
 *   <ExternalViewer {...viewerProps} />
 */

import { useCallback, useRef, useState } from "react";

export interface ExternalViewerOptions {
  /** The URL to load inside the iframe. */
  url: string;
  /**
   * Optional display title shown in the header bar.
   * Falls back to the hostname extracted from the URL.
   */
  title?: string;
  /**
   * Pre-computed embeddability result from the Phase 2 checker.
   * Pass `false` to skip the iframe entirely and show the fallback immediately.
   * Pass `undefined` (or omit) to let the component check at open time.
   */
  embeddable?: boolean;
}

export interface UseExternalViewerReturn {
  /** Call this with a trigger element ref and options to open the viewer. */
  open: (options: ExternalViewerOptions, triggerEl?: HTMLElement | null) => void;
  /** Spread these props onto <ExternalViewer />. */
  viewerProps: ExternalViewerProps;
}

export interface ExternalViewerProps {
  isOpen: boolean;
  url: string;
  title?: string;
  embeddable?: boolean;
  onClose: () => void;
}

export function useExternalViewer(): UseExternalViewerReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [opts, setOpts] = useState<ExternalViewerOptions>({ url: "" });
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback(
    (options: ExternalViewerOptions, triggerEl?: HTMLElement | null) => {
      triggerRef.current = triggerEl ?? null;
      setOpts(options);
      setIsOpen(true);
    },
    []
  );

  const onClose = useCallback(() => {
    setIsOpen(false);
    // Restore focus to the trigger element that opened the viewer
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, []);

  return {
    open,
    viewerProps: {
      isOpen,
      url: opts.url,
      title: opts.title,
      embeddable: opts.embeddable,
      onClose,
    },
  };
}
