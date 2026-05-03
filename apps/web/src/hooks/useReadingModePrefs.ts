"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/_generated/api";

export type ReadingTheme = "light" | "sepia" | "dark";
export type FontFamily = "serif" | "sans" | "mono";
export type ColumnWidth = "narrow" | "medium" | "wide";

export interface ReadingModePrefs {
  theme: ReadingTheme;
  fontFamily: FontFamily;
  fontSize: number;
  lineHeight: number;
  columnWidth: ColumnWidth;
}

const DEFAULTS: ReadingModePrefs = {
  theme: "light",
  fontFamily: "sans",
  fontSize: 16,
  lineHeight: 1.6,
  columnWidth: "medium",
};

export function useReadingModePrefs(format?: string): ReadingModePrefs {
  const me = useQuery(api.users.queries.me);
  const rm = me?.preferences?.readingMode;

  return {
    theme: (format ? rm?.themeByFormat?.[format] as ReadingTheme | undefined : undefined) ?? DEFAULTS.theme,
    fontFamily: (rm?.fontFamily as FontFamily) ?? DEFAULTS.fontFamily,
    fontSize: rm?.fontSize ?? DEFAULTS.fontSize,
    lineHeight: rm?.lineHeight ?? DEFAULTS.lineHeight,
    columnWidth: (rm?.columnWidth as ColumnWidth) ?? DEFAULTS.columnWidth,
  };
}

export function useUpdateReadingModePrefs() {
  return useMutation(api.users.mutations.updateReadingModePreferences);
}
