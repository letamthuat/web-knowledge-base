"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export type ScreenRecorderState = "idle" | "recording" | "paused";

export interface ScreenRecorderResult {
  state: ScreenRecorderState;
  micActive: boolean;
  hasMic: boolean;
  sysAudioActive: boolean;
  hasSysAudio: boolean;
  durationMs: number;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  finish: () => Promise<{ blob: Blob; durationMs: number } | null>;
  cancel: () => void;
  toggleMic: () => void;
  toggleSysAudio: () => void;
}

export function useScreenRecorder(): ScreenRecorderResult {
  const [state, setState] = useState<ScreenRecorderState>("idle");
  const [micActive, setMicActive] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const [sysAudioActive, setSysAudioActive] = useState(false);
  const [hasSysAudio, setHasSysAudio] = useState(false);
  const [durationMs, setDurationMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const sysGainRef = useRef<GainNode | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolveFinishRef = useRef<((result: { blob: Blob; durationMs: number } | null) => void) | null>(null);
  // Used to trigger finish dialog when user stops share from browser
  const [pendingFinish, setPendingFinish] = useState<{ blob: Blob; durationMs: number } | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    timerRef.current = null;
    autoStopTimerRef.current = null;
  }, []);

  const stopAllStreams = useCallback(() => {
    displayStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    displayStreamRef.current = null;
    micStreamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    micGainRef.current = null;
    sysGainRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      stopAllStreams();
    };
  }, [clearTimers, stopAllStreams]);

  const start = useCallback(async () => {
    if (state !== "idle") return;

    try {
      // Lấy mic trước — getUserMedia phải được gọi trước getDisplayMedia
      // để tránh Chrome block sau khi user đã dismiss picker
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = micStream;
        setHasMic(true);
        setMicActive(false); // mặc định tắt mic
      } catch {
        setHasMic(false);
        setMicActive(false);
      }

      // Browser native picker — user chọn tab / cửa sổ / toàn màn hình
      // audio: true để browser hỏi "Share tab audio" khi user chọn Tab
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      } as DisplayMediaStreamOptions);
      displayStreamRef.current = displayStream;

      // Build AudioContext mix
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const dest = ctx.createMediaStreamDestination();

      // System audio từ display stream (nếu user đã tick share audio)
      if (displayStream.getAudioTracks().length > 0) {
        const sysGain = ctx.createGain();
        sysGain.gain.value = 1;
        sysGainRef.current = sysGain;
        ctx.createMediaStreamSource(displayStream).connect(sysGain).connect(dest);
        setHasSysAudio(true);
        setSysAudioActive(true);
      } else {
        setHasSysAudio(false);
        setSysAudioActive(false);
      }

      // Mic — tắt mặc định (gain = 0)
      if (micStream && micStream.getAudioTracks().length > 0) {
        const micGain = ctx.createGain();
        micGain.gain.value = 0; // OFF by default
        micGainRef.current = micGain;
        ctx.createMediaStreamSource(micStream).connect(micGain).connect(dest);
      }

      // Combine video track + mixed audio
      const combined = new MediaStream([
        ...displayStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";

      const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || "video/webm" });
        const total = accumulatedRef.current;
        resolveFinishRef.current?.({ blob, durationMs: total });
        resolveFinishRef.current = null;
      };

      // Khi user dừng share từ browser (click "Stop sharing")
      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener("ended", () => {
          if (recorderRef.current && recorderRef.current.state !== "inactive") {
            // Accumulate time
            if (recorderRef.current.state === "recording") {
              accumulatedRef.current += Date.now() - startTimeRef.current;
            }
            clearTimers();
            // Resolve finish via promise
            const blob_promise = new Promise<{ blob: Blob; durationMs: number } | null>((resolve) => {
              resolveFinishRef.current = resolve;
              recorderRef.current!.stop();
            });
            blob_promise.then((result) => {
              if (result) setPendingFinish(result);
            });
            stopAllStreams();
            setState("idle");
            setDurationMs(0);
          }
        });
      }

      recorder.start(100);
      setState("recording");

      startTimeRef.current = Date.now();
      accumulatedRef.current = 0;

      timerRef.current = setInterval(() => {
        setDurationMs(accumulatedRef.current + (Date.now() - startTimeRef.current));
      }, 500);

      const TWO_HOURS = 2 * 60 * 60 * 1000;
      autoStopTimerRef.current = setTimeout(() => {
        import("sonner").then(({ toast }) => {
          toast.warning("Quay màn hình đã đạt giới hạn 2 giờ và tự động dừng");
        });
      }, TWO_HOURS);
    } catch (err) {
      // Cleanup mic stream nếu picker bị cancel sau khi mic đã được cấp
      stopAllStreams();
      setHasMic(false);
      setMicActive(false);
      setHasSysAudio(false);
      setSysAudioActive(false);
      // User dismissed picker — không throw, chỉ return silently
      const isDismiss = err instanceof Error && (
        err.name === "NotAllowedError" || err.name === "AbortError"
      );
      if (!isDismiss) throw err;
    }
  }, [state, stopAllStreams, clearTimers]);

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
    setMicActive(false);
    setHasMic(false);
    setSysAudioActive(false);
    setHasSysAudio(false);
    setPendingFinish(null);
  }, [state, clearTimers, stopAllStreams]);

  const toggleMic = useCallback(() => {
    if (!micGainRef.current) return;
    const next = !micActive;
    micGainRef.current.gain.value = next ? 1 : 0;
    setMicActive(next);
  }, [micActive]);

  const toggleSysAudio = useCallback(() => {
    if (!sysGainRef.current) return;
    const next = !sysAudioActive;
    sysGainRef.current.gain.value = next ? 1 : 0;
    setSysAudioActive(next);
  }, [sysAudioActive]);

  return {
    state,
    micActive,
    hasMic,
    sysAudioActive,
    hasSysAudio,
    durationMs,
    start,
    pause,
    resume,
    finish,
    cancel,
    toggleMic,
    toggleSysAudio,
    // pendingFinish exposed via context for ScreenRecordingPill to handle
    // We attach it as a non-standard field to keep interface clean
    ...(pendingFinish ? { _pendingFinish: pendingFinish, _clearPendingFinish: () => setPendingFinish(null) } : {}),
  } as ScreenRecorderResult & {
    _pendingFinish?: { blob: Blob; durationMs: number };
    _clearPendingFinish?: () => void;
  };
}
