import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { SupabaseProvider } from "@/providers/SupabaseProvider";
import { RecordingProvider } from "@/contexts/RecordingContext";
import { AudioRecordingPillFloating } from "@/components/recording/AudioRecordingPill";
import { ScreenRecordingPillFloating } from "@/components/recording/ScreenRecordingPill";
import { AppSettingsPanel } from "@/components/AppSettingsPanel";
import { BottomNavDynamic as BottomNav } from "@/components/nav/BottomNavDynamic";
import { DataPrefetcherDynamic as DataPrefetcher } from "@/components/DataPrefetcherDynamic";
import { AppShellDynamic as AppShell } from "@/components/AppShellDynamic";
import { InstallBanner } from "@/components/pwa/InstallBanner";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"] });

export const metadata: Metadata = {
  title: {
    default: "Web Knowledge Base",
    template: "%s | Web Knowledge Base",
  },
  description: "Kho tri thức cá nhân — đọc, ghi chú, tra cứu mọi lúc mọi nơi",
  manifest: "/manifest.webmanifest",
  icons: {
    shortcut: "/favicon.ico",
    apple: "/icons/apple-touch-icon.png",
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Web KB",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1A365D",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="vi" suppressHydrationWarning>
      {/* Restore reading theme before first paint to avoid flash */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('rm-theme');if(t==='sepia'||t==='dark'||t==='light'){document.documentElement.classList.add('rm-'+t);}}catch(e){}})();` }} />
        <script dangerouslySetInnerHTML={{ __html: `
          if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(regs) {
                for (var i = 0; i < regs.length; i++) { regs[i].unregister(); }
              });
            }
            if ('caches' in window) {
              caches.keys().then(function(keys) {
                for (var i = 0; i < keys.length; i++) { caches.delete(keys[i]); }
              });
            }
          } else {
            if('serviceWorker' in navigator){
              window.addEventListener('load',function(){
                navigator.serviceWorker.register('/sw.js').catch(function(){});
              });
            }
          }
        ` }} />
      </head>
      <body className={inter.className}>
        {/* SupabaseProvider — session do middleware lo, supabase client là singleton */}
        <SupabaseProvider>
          <RecordingProvider>
            <AppShell>{children}</AppShell>
            <DataPrefetcher />
            <AudioRecordingPillFloating />
            <ScreenRecordingPillFloating />
            <BottomNav />
            <InstallBanner />
            <AppSettingsPanel />
          </RecordingProvider>
          {/* Toast notifications dùng tiếng Việt (NFR37) */}
          <Toaster
            richColors
            position="top-right"
            toastOptions={{
              duration: 4000,
            }}
          />
        </SupabaseProvider>
      </body>
    </html>
  );
}
