"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export type AudioRecorderState = "idle" | "recording" | "paused";

export interface AudioRecorderResult {
  state: AudioRecorderState;
  micActive: boolean;
  systemActive: boolean;
  hasSystemAudio: boolean;
  durationMs: number;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  finish: () => Promise<{ blob: Blob; durationMs: number } | null>;
  cancel: () => void;
  toggleMic: () => void;
  toggleSystem: () => void;
}

export function useAudioRecorder(): AudioRecorderResult {
  const [state, setState] = useState<AudioRecorderState>("idle");
  const [micActive, setMicActive] = useState(true);
  const [systemActive, setSystemActive] = useState(false);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  const [durationMs, setDurationMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const sysGainRef = useRef<GainNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const sysStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveFinishRef = useRef<((result: { blob: Blob; durationMs: number } | null) => void) | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    timerRef.current = null;
    autoStopTimerRef.current = null;
  }, []);

  const stopAllStreams = useCallback(() => {
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    sysStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    sysStreamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    micGainRef.current = null;
    sysGainRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      stopAllStreams();
    };
  }, [clearTimers, stopAllStreams]);

  const start = useCallback(async () => {
    if (state !== "idle") return;

    try {
      // Always get mic
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      // Try system audio (Chrome/Edge only)
      // Chrome requires video:true for getDisplayMedia to work and expose audio
      let sysStream: MediaStream | null = null;
      const supportsDisplayAudio =
        typeof navigator.mediaDevices.getDisplayMedia === "function";

      if (supportsDisplayAudio) {
        try {
          sysStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: { width: 1, height: 1, frameRate: 1 },
          } as DisplayMediaStreamOptions);
          sysStreamRef.current = sysStream;
          // Stop video track immediately — we only need audio
          sysStream.getVideoTracks().forEach((t) => t.stop());
        } catch {
          // User cancelled or browser not supported — mic-only is fine
          setSystemActive(false);
        }
      } else {
        setSystemActive(false);
      }

      // Build AudioContext mix
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();

      const micGain = ctx.createGain();
      micGain.gain.value = 1;
      micGainRef.current = micGain;
      ctx.createMediaStreamSource(micStream).connect(micGain).connect(dest);

      if (sysStream && sysStream.getAudioTracks().length > 0) {
        const sysGain = ctx.createGain();
        sysGain.gain.value = 1;
        sysGainRef.current = sysGain;
        ctx.createMediaStreamSource(sysStream).connect(sysGain).connect(dest);
        setHasSystemAudio(true);
        setSystemActive(true);
      } else {
        setHasSystemAudio(false);
        setSystemActive(false);
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(dest.stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const total = accumulatedRef.current;
        resolveFinishRef.current?.({ blob, durationMs: total });
        resolveFinishRef.current = null;
      };

      recorder.start(100); // collect every 100ms
      setMicActive(true);
      setState("recording");

      startTimeRef.current = Date.now();
      accumulatedRef.current = 0;

      // Timer tick every second
      timerRef.current = setInterval(() => {
        setDurationMs(accumulatedRef.current + (Date.now() - startTimeRef.current));
      }, 500);

      // Auto-stop at 2 hours
      const TWO_HOURS = 2 * 60 * 60 * 1000;
      autoStopTimerRef.current = setTimeout(() => {
        import("sonner").then(({ toast }) => {
          toast.warning("Ghi âm đã đạt giới hạn 2 giờ và tự động dừng");
        });
      }, TWO_HOURS);
    } catch (err) {
      stopAllStreams();
      throw err;
    }
  }, [state, stopAllStreams]);

  const pause = useCallback(() => {
    if (state !== "recording" || !recorderRef.current) return;
    recorderRef.current.pause();
    accumulatedRef.current += Date.now() - startTimeRef.current;
    clearTimers();
    setState("paused");
  }, [state, clearTimers]);

  const resume = useCallback(() => {
    if (state !== "paused" || !recorderRef.current) return;
    recorderRef.current.resume();
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setDurationMs(accumulatedRef.current + (Date.now() - startTimeRef.current));
    }, 500);
    setState("recording");
  }, [state]);

  const finish = useCallback((): Promise<{ blob: Blob; durationMs: number } | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || state === "idle") {
        resolve(null);
        return;
      }
      // Accumulate remaining time
      if (state === "recording") {
        accumulatedRef.current += Date.now() - startTimeRef.current;
      }
      clearTimers();
      resolveFinishRef.current = resolve;
      recorder.stop();
      stopAllStreams();
      setState("idle");
      setDurationMs(0);
    });
  }, [state, clearTimers, stopAllStreams]);

  const cancel = useCallback(() => {
    clearTimers();
    if (recorderRef.current && state !== "idle") {
      resolveFinishRef.current = null;
      recorderRef.current.stop();
    }
    stopAllStreams();
    chunksRef.current = [];
    accumulatedRef.current = 0;
    setState("idle");
    setDurationMs(0);
    setMicActive(true);
    setSystemActive(false);
    setHasSystemAudio(false);
  }, [state, clearTimers, stopAllStreams]);

  const toggleMic = useCallback(() => {
    if (!micGainRef.current) return;
    const next = !micActive;
    micGainRef.current.gain.value = next ? 1 : 0;
    setMicActive(next);
  }, [micActive]);

  const toggleSystem = useCallback(() => {
    if (!sysGainRef.current) return;
    const next = !systemActive;
    sysGainRef.current.gain.value = next ? 1 : 0;
    setSystemActive(next);
  }, [systemActive]);

  return {
    state,
    micActive,
    systemActive,
    hasSystemAudio,
    durationMs,
    start,
    pause,
    resume,
    finish,
    cancel,
    toggleMic,
    toggleSystem,
  };
}
