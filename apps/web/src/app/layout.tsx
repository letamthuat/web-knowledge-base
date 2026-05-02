import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ConvexClientProvider } from "@/providers/ConvexClientProvider";
import { RecordingProvider } from "@/contexts/RecordingContext";
import { AudioRecordingPillFloating } from "@/components/recording/AudioRecordingPill";
import { ScreenRecordingPillFloating } from "@/components/recording/ScreenRecordingPill";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: {
    default: "Web Knowledge Base",
    template: "%s | Web Knowledge Base",
  },
  description: "Kho tri thức cá nhân — đọc, ghi chú, tra cứu mọi lúc mọi nơi",
  manifest: "/manifest.json",
  // PWA (Epic 8)
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Web KB",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={inter.className}>
        {/* ConvexClientProvider bọc ConvexReactClient + Better Auth session */}
        <ConvexClientProvider>
          <RecordingProvider>
            {children}
            <AudioRecordingPillFloating />
            <ScreenRecordingPillFloating />
          </RecordingProvider>
          {/* Toast notifications dùng tiếng Việt (NFR37) */}
          <Toaster
            richColors
            position="top-right"
            toastOptions={{
              duration: 4000,
            }}
          />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
