"use client";

import { useRecording } from "@/contexts/RecordingContext";
import { useState } from "react";
import { AudioFinishDialog } from "./AudioFinishDialog";

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function PillControls({
  state,
  micActive,
  systemActive,
  hasSystemAudio,
  durationMs,
  pause,
  resume,
  toggleMic,
  toggleSystem,
  onStop,
  size = "sm",
}: {
  state: "recording" | "paused";
  micActive: boolean;
  systemActive: boolean;
  hasSystemAudio: boolean;
  durationMs: number;
  pause: () => void;
  resume: () => void;
  toggleMic: () => void;
  toggleSystem: () => void;
  onStop: () => void;
  size?: "sm" | "md";
}) {
  const isRecording = state === "recording";
  const isPaused = state === "paused";
  const iconCls = size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  const btnCls = `rounded-full p-1 transition-colors ${size === "md" ? "hover:bg-white/20" : "hover:text-white/70"}`;

  return (
    <>
      {/* Mic icon — solid waveform style */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconCls}>
        <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
        <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
      </svg>
      <span className={`tabular-nums text-center ${size === "md" ? "min-w-[3.5rem] text-sm" : "min-w-[3rem] text-xs"}`}>
        {formatDuration(durationMs)}
      </span>

      {/* Toggle mic — mic bình thường hoặc mic gạch chéo */}
      <button
        onClick={toggleMic}
        title={micActive ? "Tắt mic" : "Bật mic"}
        className={`${btnCls} text-white`}
      >
        {micActive ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconCls}>
            <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
            <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconCls}>
            <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" opacity="0.4" />
            <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" opacity="0.4" />
            <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Toggle system audio — loa bình thường hoặc loa gạch chéo */}
      {hasSystemAudio && (
        <button
          onClick={toggleSystem}
          title={systemActive ? "Tắt âm thanh máy tính" : "Bật âm thanh máy tính"}
          className={`${btnCls} text-white`}
        >
          {systemActive ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconCls}>
              <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
              <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.061Z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconCls}>
              <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06Z" opacity="0.4" />
              <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>
      )}

      {/* Pause / Resume */}
      {isRecording ? (
        <button onClick={pause} title="Tạm dừng" className={btnCls}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconCls}>
            <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
          </svg>
        </button>
      ) : (
        <button onClick={resume} title="Tiếp tục" className={btnCls}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconCls}>
            <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
          </svg>
        </button>
      )}

      {/* Stop */}
      <button onClick={onStop} title="Dừng ghi âm" className={btnCls}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={iconCls}>
          <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
        </svg>
      </button>
    </>
  );
}

/** Inline variant — dùng trong TabBar (desktop) */
export function AudioRecordingPill() {
  const { audioRecorder } = useRecording();
  const { state, micActive, systemActive, hasSystemAudio, durationMs, pause, resume, finish, cancel, toggleMic, toggleSystem } = audioRecorder;
  const [finishResult, setFinishResult] = useState<{ blob: Blob; durationMs: number } | null>(null);

  async function handleStop() {
    const result = await finish();
    if (result) setFinishResult(result);
  }

  if (state === "idle" && !finishResult) return null;

  const isActive = state === "recording" || state === "paused";

  return (
    <>
      {isActive && (
        <div
          className={`hidden md:flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium select-none transition-colors shrink-0 ${
            state === "paused" ? "bg-muted text-muted-foreground" : "bg-rose-500 text-white"
          }`}
        >
          <PillControls
            state={state as "recording" | "paused"}
            micActive={micActive}
            systemActive={systemActive}
            hasSystemAudio={hasSystemAudio}
            durationMs={durationMs}
            pause={pause}
            resume={resume}
            toggleMic={toggleMic}
            toggleSystem={toggleSystem}
            onStop={handleStop}
            size="sm"
          />
        </div>
      )}

      {finishResult && (
        <AudioFinishDialog
          blob={finishResult.blob}
          durationMs={finishResult.durationMs}
          onClose={() => setFinishResult(null)}
          onCancel={() => { cancel(); setFinishResult(null); }}
        />
      )}
    </>
  );
}

/** Floating variant — dùng trên mobile (fixed bottom-right) */
export function AudioRecordingPillFloating() {
  const { audioRecorder } = useRecording();
  const { state, micActive, systemActive, hasSystemAudio, durationMs, pause, resume, finish, cancel, toggleMic, toggleSystem } = audioRecorder;
  const [finishResult, setFinishResult] = useState<{ blob: Blob; durationMs: number } | null>(null);

  async function handleStop() {
    const result = await finish();
    if (result) setFinishResult(result);
  }

  if (state === "idle" && !finishResult) return null;

  const isActive = state === "recording" || state === "paused";

  return (
    <>
      {isActive && (
        <div
          className={`md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full px-4 py-2.5 font-medium select-none shadow-lg transition-colors ${
            state === "paused" ? "bg-gray-600 text-white" : "bg-rose-500 text-white"
          }`}
        >
          <PillControls
            state={state as "recording" | "paused"}
            micActive={micActive}
            systemActive={systemActive}
            hasSystemAudio={hasSystemAudio}
            durationMs={durationMs}
            pause={pause}
            resume={resume}
            toggleMic={toggleMic}
            toggleSystem={toggleSystem}
            onStop={handleStop}
            size="md"
          />
        </div>
      )}

      {finishResult && (
        <AudioFinishDialog
          blob={finishResult.blob}
          durationMs={finishResult.durationMs}
          onClose={() => setFinishResult(null)}
          onCancel={() => { cancel(); setFinishResult(null); }}
        />
      )}
    </>
  );
}
