import type { Metadata, Viewport } from "next";
import { Roboto, Roboto_Condensed } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import { LionWatermark } from "@/components/lion-watermark";
import { MountainSkyline } from "@/components/mountain-skyline";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ReminderScheduler } from "@/components/reminder-scheduler";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { AuthProvider } from "@/lib/auth-context";
import { TasksProvider } from "@/lib/tasks-context";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  weight: ["400", "500", "700"],
  subsets: ["latin", "cyrillic"],
});

const robotoCondensed = Roboto_Condensed({
  variable: "--font-roboto-condensed",
  weight: ["400", "700"],
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "AI-планер дня",
  description: "Диктуй або пиши все, що в голові — розберемо на задачі пізніше.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Day Planner",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  verification: {
    google: "O6Zglftw6sTguYK2VKZBQ6OwYG0tQWJDmFKsjrakjbo",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#04170f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${roboto.variable} ${robotoCondensed.variable} antialiased`}>
      <body className="text-brand-text">
        <AuthProvider>
          <TasksProvider>
            <ServiceWorkerRegister />
            <ReminderScheduler />
            <div className="relative flex h-dvh flex-col overflow-hidden overscroll-none">
              <MountainSkyline />
              <LionWatermark />
              <PullToRefresh>{children}</PullToRefresh>
              <BottomNav />
            </div>
          </TasksProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
