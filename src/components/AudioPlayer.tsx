"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { AudiobookPlaylist, PlaybackSpeed, UserProgress } from "@/types";
import { PLAYBACK_SPEEDS } from "@/types";
import { saveProgress, beaconSaveProgress } from "@/lib/progress-client";
import { proxiedAudioUrl } from "@/lib/proxy";

interface AudioPlayerProps {
  playlist: AudiobookPlaylist;
  initialProgress: UserProgress | null;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const total = Math.floor(value);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function deriveChapterTitle(
  chapter: { url: string; title?: string },
  index: number,
): string {
  if (chapter.title && chapter.title.trim()) return chapter.title.trim();
  try {
    const path = new URL(chapter.url).pathname.split("/").filter(Boolean).pop();
    if (path) return decodeURIComponent(path);
  } catch {
    /* ignore */
  }
  return `Chapter ${index + 1}`;
}

export function AudioPlayer({
  playlist,
  initialProgress,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasPlayingRef = useRef(false);
  const isPlayingRef = useRef(false);
  const chapterIndexRef = useRef(0);
  const speedRef = useRef<PlaybackSpeed>(1);

  const [chapterIndex, setChapterIndex] = useState(
    initialProgress?.chapterIndex ?? 0,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(
    initialProgress?.timestamp ?? 0,
  );
  const [buffered, setBuffered] = useState(0);
  const [speed, setSpeed] = useState<PlaybackSpeed>(
    (initialProgress?.speed as PlaybackSpeed | undefined) ?? 1,
  );
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sleepTimerEndAt, setSleepTimerEndAt] = useState<number | null>(null);
  const [sleepTimerSelected, setSleepTimerSelected] = useState<number | null>(null);
  const [sleepRemaining, setSleepRemaining] = useState(0);
  const [sleepPickerOpen, setSleepPickerOpen] = useState(false);
  const [resumeMessage, setResumeMessage] = useState<string | null>(
    initialProgress && initialProgress.timestamp > 0
      ? `Resumed chapter ${initialProgress.chapterIndex + 1} at ${formatTime(
          initialProgress.timestamp,
        )}`
      : null,
  );

  chapterIndexRef.current = chapterIndex;
  speedRef.current = speed;
  isPlayingRef.current = isPlaying;

  const totalChapters = playlist.chapters.length;
  const currentChapter = playlist.chapters[chapterIndex];
  const chapterTitle = useMemo(
    () => deriveChapterTitle(currentChapter, chapterIndex),
    [currentChapter, chapterIndex],
  );
  const chapterTitles = useMemo(
    () => playlist.chapters.map((c, i) => deriveChapterTitle(c, i)),
    [playlist.chapters],
  );

  const saveNow = useCallback(
    async (chapter: number, timestamp: number, playbackSpeed: number) => {
      setSaveStatus("saving");
      const ok = await saveProgress({
        url: playlist.sourceUrl,
        title: playlist.title,
        chapters: playlist.chapters,
        chapterIndex: chapter,
        timestamp,
        speed: playbackSpeed,
      });
      if (ok) {
        setSaveStatus("saved");
        setSaveError(null);
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1500);
      } else {
        setSaveStatus("error");
        setSaveError("Could not save progress. Check the browser console.");
      }
    },
    [playlist.sourceUrl, playlist.title, playlist.chapters],
  );

  useEffect(() => {
    const id = setTimeout(() => {
      const audio = audioRef.current;
      void saveNow(
        chapterIndexRef.current,
        audio?.currentTime ?? 0,
        audio?.playbackRate ?? speedRef.current,
      );
    }, 800);
    saveTimerRef.current = id;
    return () => {
      if (saveTimerRef.current === id) {
        clearTimeout(id);
        saveTimerRef.current = null;
      }
    };
  }, [chapterIndex, isPlaying, speed, saveNow]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    setIsReady(false);
    setError(null);
    setBuffered(0);
  }, [chapterIndex, playlist.sourceUrl]);

  useEffect(() => {
    function beacon() {
      const audio = audioRef.current;
      beaconSaveProgress({
        url: playlist.sourceUrl,
        title: playlist.title,
        chapters: playlist.chapters,
        chapterIndex: chapterIndexRef.current,
        timestamp: audio?.currentTime ?? 0,
        speed: audio?.playbackRate ?? speedRef.current,
      });
    }
    const onUnload = () => beacon();
    const onHide = () => beacon();
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [playlist.sourceUrl, playlist.title, playlist.chapters]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let cancelled = false;
    const onLoadedMetadata = () => {
      if (cancelled) return;
      setDuration(audio.duration || 0);
      const resume =
        initialProgress &&
        chapterIndex === initialProgress.chapterIndex &&
        initialProgress.timestamp > 0 &&
        initialProgress.timestamp < (audio.duration || Infinity);
      if (resume) {
        audio.currentTime = initialProgress.timestamp;
        setCurrentTime(initialProgress.timestamp);
        const playPromise = audio.play();
        if (playPromise) {
          playPromise.catch(() => {
            // Autoplay blocked — leave UI in paused state for the user to resume.
          });
        }
      } else {
        setCurrentTime(0);
      }
      setIsReady(true);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onProgress = () => {
      if (audio.buffered.length > 0) {
        setBuffered(audio.buffered.end(audio.buffered.length - 1));
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      void saveNow(
        chapterIndexRef.current,
        audio.currentTime,
        audio.playbackRate || speedRef.current,
      );
    };
    const onEnded = () => {
      wasPlayingRef.current = true;
      if (chapterIndex < totalChapters - 1) {
        setChapterIndex((i) => i + 1);
      } else {
        setIsPlaying(false);
      }
    };
    const onError = () => {
      setError("Failed to load audio. The link may be unavailable.");
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("progress", onProgress);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      cancelled = true;
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("progress", onProgress);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [chapterIndex, initialProgress, saveNow, totalChapters]);

  useEffect(() => {
    if (!isReady) return;
    if (!wasPlayingRef.current) return;
    wasPlayingRef.current = false;
    const audio = audioRef.current;
    if (!audio) return;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        setIsPlaying(false);
      });
    }
  }, [chapterIndex, isReady]);

  useEffect(() => {
    if (sleepTimerEndAt === null) {
      setSleepRemaining(0);
      return;
    }
    const tick = () => {
      const remainingMs = sleepTimerEndAt - Date.now();
      if (remainingMs <= 0) {
        setSleepRemaining(0);
        setSleepTimerEndAt(null);
        const audio = audioRef.current;
        if (audio && !audio.paused) {
          audio.pause();
        }
        return;
      }
      setSleepRemaining(remainingMs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sleepTimerEndAt]);

  useEffect(() => {
    if (isPlaying && sleepTimerEndAt === null && sleepTimerSelected === null) {
      const DEFAULT_MINUTES = 45;
      setSleepTimerSelected(DEFAULT_MINUTES);
      setSleepTimerEndAt(Date.now() + DEFAULT_MINUTES * 60_000);
    }
  }, [isPlaying, sleepTimerEndAt, sleepTimerSelected]);

  function setSleepTimer(minutes: number | null) {
    setSleepPickerOpen(false);
    if (minutes === null) {
      setSleepTimerEndAt(null);
      setSleepTimerSelected(null);
      setSleepRemaining(0);
      return;
    }
    setSleepTimerSelected(minutes);
    setSleepTimerEndAt(Date.now() + minutes * 60_000);
  }

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;

    const updateMetadata = () => {
      if (typeof MediaMetadata === "undefined") return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapterTitle,
        artist: playlist.title,
        album: `${playlist.title} · Chapter ${chapterIndex + 1} of ${totalChapters}`,
        artwork: [
          { src: "/icon", sizes: "192x192", type: "image/png" },
        ],
      });
    };

    const updatePosition = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      try {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate,
          position: Math.min(audio.currentTime, audio.duration),
        });
      } catch {
        /* ignore */
      }
    };

    const onPlay = () => {
      navigator.mediaSession.playbackState = "playing";
    };
    const onPause = () => {
      navigator.mediaSession.playbackState = "paused";
    };

    const handlePlay = () => audio.play().catch(() => {});
    const handlePause = () => audio.pause();
    const handleSeek = (details: MediaSessionActionDetails) => {
      if (details.seekTime !== undefined && Number.isFinite(details.seekTime)) {
        audio.currentTime = Math.max(0, details.seekTime);
      }
    };
    const handleSeekTo = (details: MediaSessionActionDetails) => {
      if (details.fastSeek && Number.isFinite(details.fastSeek)) {
        const offset = details.fastSeek as unknown as number;
        const target = (audio.currentTime ?? 0) + offset;
        audio.currentTime = Math.max(0, target);
      }
    };
    const handlePrev = () => {
      if (chapterIndex > 0) {
        wasPlayingRef.current = isPlayingRef.current;
        setChapterIndex((i) => i - 1);
      }
    };
    const handleNext = () => {
      if (chapterIndex < totalChapters - 1) {
        wasPlayingRef.current = isPlayingRef.current;
        setChapterIndex((i) => i + 1);
      }
    };
    const handleStop = () => {
      audio.pause();
    };

    try {
      navigator.mediaSession.setActionHandler("play", handlePlay);
      navigator.mediaSession.setActionHandler("pause", handlePause);
      navigator.mediaSession.setActionHandler("seekbackward", handleSeek);
      navigator.mediaSession.setActionHandler("seekforward", handleSeek);
      navigator.mediaSession.setActionHandler("seekto", handleSeekTo);
      navigator.mediaSession.setActionHandler("previoustrack", handlePrev);
      navigator.mediaSession.setActionHandler("nexttrack", handleNext);
      navigator.mediaSession.setActionHandler("stop", handleStop);
    } catch {
      /* some browsers don't support all actions */
    }

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("loadedmetadata", updatePosition);
    audio.addEventListener("timeupdate", updatePosition);
    audio.addEventListener("ratechange", updatePosition);
    updateMetadata();
    updatePosition();
    navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing";

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("loadedmetadata", updatePosition);
      audio.removeEventListener("timeupdate", updatePosition);
      audio.removeEventListener("ratechange", updatePosition);
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("seekbackward", null);
        navigator.mediaSession.setActionHandler("seekforward", null);
        navigator.mediaSession.setActionHandler("seekto", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
        navigator.mediaSession.setActionHandler("stop", null);
      } catch {
        /* ignore */
      }
    };
  }, [chapterIndex, chapterTitle, playlist.title, playlist.sourceUrl, totalChapters]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {
        setError("Unable to start playback. Try again.");
      });
    } else {
      audio.pause();
    }
  }

  function skipBy(deltaSeconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Math.min(
      Math.max(0, audio.currentTime + deltaSeconds),
      duration || audio.duration || 0,
    );
    audio.currentTime = next;
    setCurrentTime(next);
  }

  function seekTo(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
    void saveNow(
      chapterIndexRef.current,
      value,
      audio.playbackRate || speedRef.current,
    );
  }

  function seekToFraction(fraction: number) {
    if (!duration) return;
    const clamped = Math.min(1, Math.max(0, fraction));
    seekTo(clamped * duration);
  }

  function handleSeekPointerDown(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (!duration) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const rect = target.getBoundingClientRect();
    const update = (clientX: number) => {
      const fraction = (clientX - rect.left) / rect.width;
      seekToFraction(fraction);
    };
    update(event.clientX);
    const move = (e: PointerEvent) => update(e.clientX);
    const up = (e: PointerEvent) => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", up);
      target.removeEventListener("pointercancel", up);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", up);
    target.addEventListener("pointercancel", up);
  }

  function handleSeekKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!duration) return;
    const step = event.shiftKey ? 30 : 5;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      seekTo(Math.min(duration, (audioRef.current?.currentTime ?? 0) + step));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seekTo(Math.max(0, (audioRef.current?.currentTime ?? 0) - step));
    } else if (event.key === "Home") {
      event.preventDefault();
      seekTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      seekTo(duration);
    }
  }

  function goPrev() {
    if (chapterIndex > 0) {
      wasPlayingRef.current = isPlayingRef.current;
      setChapterIndex((i) => i - 1);
    } else {
      seekTo(0);
    }
  }

  function goNext() {
    if (chapterIndex < totalChapters - 1) {
      wasPlayingRef.current = isPlayingRef.current;
      setChapterIndex((i) => i + 1);
    }
  }

  function selectChapter(index: number) {
    if (index < 0 || index >= totalChapters) return;
    wasPlayingRef.current = isPlayingRef.current;
    setChapterIndex(index);
  }

  if (!currentChapter) {
    return (
      <p className="text-sm text-red-300">
        This playlist has no playable chapters.
      </p>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-2xl border border-border bg-surface/70 p-6 shadow-xl backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted">
              {playlist.title}
            </p>
            <h2 className="mt-1 truncate text-2xl font-semibold">
              {chapterTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Chapter {chapterIndex + 1} of {totalChapters}
            </p>
          </div>
          {resumeMessage ? (
            <button
              type="button"
              onClick={() => setResumeMessage(null)}
              className="shrink-0 rounded-md border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs text-brand-200 hover:bg-brand-500/20"
            >
              {resumeMessage}
            </button>
          ) : null}
        </div>

        <div className="mt-6">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={duration || 0}
            aria-valuenow={Math.min(currentTime, duration || 0)}
            aria-valuetext={formatTime(currentTime)}
            onPointerDown={handleSeekPointerDown}
            onKeyDown={handleSeekKeyDown}
            className="group relative h-2 w-full cursor-pointer touch-none overflow-hidden rounded-full bg-border"
          >
            <div
              className="absolute inset-y-0 left-0 bg-white/20"
              style={{ width: `${bufferedPercent}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-brand-500 transition-[width] duration-100"
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-500 opacity-0 shadow transition group-hover:opacity-100"
              style={{ left: `${progressPercent}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted">
            <span>{formatTime(currentTime)}</span>
            <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-5">
          <IconButton onClick={goPrev} ariaLabel="Previous chapter">
            <SkipBackIcon />
          </IconButton>
          <IconButton onClick={() => skipBy(-15)} ariaLabel="Back 15 seconds">
            <RewindIcon />
          </IconButton>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!isReady}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg shadow-brand-500/30 transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <IconButton onClick={() => skipBy(15)} ariaLabel="Forward 15 seconds">
            <ForwardIcon />
          </IconButton>
          <IconButton onClick={goNext} ariaLabel="Next chapter">
            <SkipForwardIcon />
          </IconButton>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Speed</span>
            <div className="flex overflow-hidden rounded-md border border-border">
              {PLAYBACK_SPEEDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSpeed(value)}
                  className={`px-2.5 py-1 text-xs transition ${
                    speed === value
                      ? "bg-brand-500 text-white"
                      : "text-foreground hover:bg-surface-elevated"
                  }`}
                >
                  {value}x
                </button>
              ))}
            </div>
          </div>
          <SleepTimerControl
            isActive={sleepTimerEndAt !== null}
            remainingMs={sleepRemaining}
            isOpen={sleepPickerOpen}
            onToggle={() => setSleepPickerOpen((v) => !v)}
            onSelect={setSleepTimer}
            selectedMinutes={sleepTimerSelected}
          />
          <a
            href={currentChapter.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            Open source
          </a>
          <SaveStatusBadge status={saveStatus} error={saveError} />
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <audio
          ref={audioRef}
          src={proxiedAudioUrl(currentChapter.url)}
          preload="metadata"
        />
      </div>

      <aside className="rounded-2xl border border-border bg-surface/70 p-4 shadow-xl backdrop-blur">
        <h3 className="px-2 text-sm font-semibold text-foreground">Chapters</h3>
        <ol className="mt-3 max-h-[28rem] space-y-1 overflow-y-auto pr-1">
          {playlist.chapters.map((chapter, index) => {
            const active = index === chapterIndex;
            return (
              <li key={`${chapter.url}-${index}`}>
                <button
                  type="button"
                  onClick={() => selectChapter(index)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                    active
                      ? "bg-brand-500/15 text-brand-200"
                      : "text-foreground hover:bg-surface-elevated"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      active
                        ? "bg-brand-500 text-white"
                        : "bg-surface-elevated text-muted"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="truncate">{chapterTitles[index]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}

interface IconButtonProps {
  onClick: () => void;
  ariaLabel: string;
  children: React.ReactNode;
}

const SLEEP_OPTIONS = [15, 30, 45, 60, 90] as const;

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SleepTimerControl({
  isActive,
  remainingMs,
  isOpen,
  onToggle,
  onSelect,
  selectedMinutes,
}: {
  isActive: boolean;
  remainingMs: number;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (minutes: number | null) => void;
  selectedMinutes: number | null;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const menuWidth = Math.min(176, window.innerWidth - 16);
      const desiredLeft = rect.right - menuWidth;
      const left = Math.max(8, Math.min(desiredLeft, window.innerWidth - menuWidth - 8));
      setMenuPos({ top: rect.bottom + 8, left });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("orientationchange", update);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onDocClick(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (wrapperRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onToggle();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onToggle();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onToggle]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-label="Sleep timer"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Sleep timer"
        className={`flex min-h-[2.25rem] items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${
          isActive
            ? "border-brand-500/40 bg-brand-500/10 text-brand-200"
            : "border-border text-foreground hover:bg-surface-elevated"
        }`}
      >
        <MoonIcon />
        {isActive ? formatCountdown(remainingMs) : "Sleep"}
      </button>
      {isOpen && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: Math.min(176, window.innerWidth - 16),
              }}
              className="z-50 overflow-hidden rounded-md border border-border bg-surface-elevated shadow-2xl"
            >
              <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Stop after
              </div>
              {SLEEP_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selectedMinutes === minutes && isActive}
                  onClick={() => onSelect(minutes)}
                  className={`flex min-h-[2.75rem] w-full items-center justify-between px-3 py-2 text-sm transition ${
                    selectedMinutes === minutes && isActive
                      ? "bg-brand-500/15 text-brand-200"
                      : "text-foreground hover:bg-surface active:bg-surface"
                  }`}
                >
                  <span>{minutes} minutes</span>
                  {selectedMinutes === minutes && isActive ? (
                    <CheckIcon />
                  ) : null}
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                onClick={() => onSelect(null)}
                className="flex min-h-[2.75rem] w-full items-center gap-2 border-t border-border px-3 py-2 text-sm text-muted transition hover:bg-surface hover:text-foreground active:bg-surface"
              >
                <span>Turn off</span>
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SaveStatusBadge({
  status,
  error,
}: {
  status: "idle" | "saving" | "saved" | "error";
  error: string | null;
}) {
  if (status === "idle") return null;
  const base = "rounded-md px-2.5 py-1 text-xs transition";
  if (status === "saving") {
    return (
      <span className={`${base} border border-border bg-surface-elevated text-muted`}>
        Saving…
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className={`${base} border border-brand-500/40 bg-brand-500/10 text-brand-200`}>
        ✓ Saved
      </span>
    );
  }
  return (
    <span
      className={`${base} border border-red-500/40 bg-red-500/10 text-red-200`}
      title={error ?? undefined}
    >
      Save failed
    </span>
  );
}

function IconButton({ onClick, ariaLabel, children }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition hover:bg-surface-elevated"
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}

function RewindIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 19 2 12l9-7zM22 19l-9-7 9-7z" />
    </svg>
  );
}

function ForwardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 19 22 12l-9-7zM2 19l9-7-9-7z" />
    </svg>
  );
}

function SkipBackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 20 9 12l10-8zM5 19V5" />
    </svg>
  );
}

function SkipForwardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 4 10 8-10 8zM19 5v14" />
    </svg>
  );
}
