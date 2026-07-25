import { useState, useEffect, useRef } from "react";
import { trackVideoReplay, trackVideoProgress } from "../lib/telemetry/studentTracker";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface VideoPlayerProps {
  videoId: string;
  videoUrl: string;
  durationMinutes: number;
  onEnded?: () => void;
  onStruggle?: (reason: string) => void;
}

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: {
      Player: new (
        target: HTMLIFrameElement | null,
        config: { events: { onStateChange: (event: { data: number }) => void } }
      ) => YouTubePlayer;
    };
  }
}

interface YouTubePlayer {
  getCurrentTime(): number;
  getDuration(): number;
}

export default function VideoPlayer({ videoId, videoUrl, durationMinutes, onEnded, onStruggle }: VideoPlayerProps) {
  const { user } = useAuth();
  const [showTranscript, setShowTranscript] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTimeSeconds, setActiveTimeSeconds] = useState(0);
  const [pauses, setPauses] = useState(0);
  const [replays, setReplays] = useState(0);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const hasTriggeredStruggle = useRef<boolean>(false);

  // Loading API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = String(url).match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const ytId = getYouTubeId(videoUrl);
  const embedUrl = ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1` : "";
  const thumbnailUrl = ytId ? `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg` : "";

  const handlePlay = async () => {
    setIsPlaying(true);
    if (!videoId || !user) return;
    try {
      const isReplay = await trackVideoReplay(user.id, videoId);
      if (isReplay) {
        setReplays(prev => prev + 1);
        setTimeout(() => setShowTranscript(true), 500);
      }
    } catch (err) {
      console.warn("[VideoPlayer] Telemetry error:", err);
    }
  };

  const handleIframeLoad = () => {
    if (ytId && !playerRef.current && window.YT && window.YT.Player) {
      playerRef.current = new window.YT.Player(iframeRef.current, {
        events: {
          onStateChange: (event: { data: number }) => {
            // YT.PlayerState.PAUSED is 2
            if (event.data === 2) {
              setPauses(prev => prev + 1);
            }
            // YT.PlayerState.ENDED is 0
            if (event.data === 0) {
              console.log("[VideoPlayer] Ended event triggered");
              if (onEnded) onEnded();
              if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            }
          },
        },
      });
    }
  };

  // ─── 2. Struggle Detection & Sync ───────────────────────────────────────────
  
  useEffect(() => {
    if (isPlaying && ytId && user?.id) {
      progressIntervalRef.current = setInterval(() => {
        if (!playerRef.current || !playerRef.current.getCurrentTime || !playerRef.current.getDuration) return;

        try {
          // Increment active time
          setActiveTimeSeconds(prev => prev + 1);

          const currentTime = Math.floor(playerRef.current.getCurrentTime());
          const totalDuration = playerRef.current.getDuration() || durationMinutes * 60;
          const progressPct = totalDuration > 0 ? Math.min(100, Math.floor((currentTime / totalDuration) * 100)) : 0;
          
          if (currentTime > 0 && (currentTime % 10 === 0 || progressPct === 100)) {
            trackVideoProgress(user.id!, videoId, progressPct, currentTime);
          }

          // Trigger logic
          if (!hasTriggeredStruggle.current && onStruggle) {
            let struggleReason = "";
            if (activeTimeSeconds > totalDuration * 1.5) struggleReason = "time";
            else if (pauses >= 3) struggleReason = "pauses";
            else if (replays >= 3) struggleReason = "replays";

            if (struggleReason) {
              hasTriggeredStruggle.current = true;
              onStruggle(struggleReason);
            }
          }

          // End reached safety check
          if (progressPct >= 99 || (totalDuration > 0 && totalDuration - currentTime < 2)) {
            if (onEnded) onEnded();
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          }
        } catch (e) {
          // Player instance error, typically during loading
        }
      }, 1000);
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, ytId, user?.id, videoId, durationMinutes, onEnded, onStruggle, pauses, replays, activeTimeSeconds]);

  if (!ytId) return <div className="p-4 text-red-500 text-center bg-red-500/10 rounded-xl border border-red-500/20">Invalid YouTube URL.</div>;

  return (
    <div className="space-y-4 w-full max-w-3xl mx-auto my-6">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black shadow-2xl group transition-all duration-500">
        {!isPlaying ? (
          <div
            className="absolute inset-0 w-full h-full cursor-pointer flex items-center justify-center bg-cover bg-center transition-transform duration-700 hover:scale-[1.02]"
            style={{ backgroundImage: `url(${thumbnailUrl})` }}
            onClick={handlePlay}
          >
            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all duration-300" />
            <div className="relative z-10 w-20 h-14 bg-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:bg-red-500 transition-all duration-300 shadow-xl shadow-red-600/30">
              <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        ) : (
          <>
            <iframe
              key={ytId}
              ref={iframeRef}
              width="100%"
              height="100%"
              src={embedUrl}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={handleIframeLoad}
              className="absolute left-0 top-0 opacity-100 transition-opacity duration-500"
            />
          </>
        )}
      </div>

      {showTranscript && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-4 duration-500 backdrop-blur-sm">
          <div className="flex-1">
            <h4 className="text-sm font-bold text-primary flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              Learning Support Active
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">Need more context? The transcript could help clear things up!</p>
          </div>
          <Button variant="default" size="sm" onClick={() => setShowTranscript(false)}>Read Transcript</Button>
        </div>
      )}
    </div>
  );
}