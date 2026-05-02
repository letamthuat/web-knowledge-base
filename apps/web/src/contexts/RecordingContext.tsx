"use client";

import { createContext, useContext, ReactNode } from "react";
import { useAudioRecorder, AudioRecorderResult } from "@/hooks/useAudioRecorder";
import { useScreenRecorder, ScreenRecorderResult } from "@/hooks/useScreenRecorder";

interface RecordingContextValue {
  audioRecorder: AudioRecorderResult;
  screenRecorder: ScreenRecorderResult;
}

const RecordingContext = createContext<RecordingContextValue | null>(null);

export function RecordingProvider({ children }: { children: ReactNode }) {
  const audioRecorder = useAudioRecorder();
  const screenRecorder = useScreenRecorder();

  return (
    <RecordingContext.Provider value={{ audioRecorder, screenRecorder }}>
      {children}
    </RecordingContext.Provider>
  );
}

export function useRecording(): RecordingContextValue {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error("useRecording must be used inside RecordingProvider");
  return ctx;
}
