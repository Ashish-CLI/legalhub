import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { startWorker } from '@/lib/analysisWorker';
import { scheduleCleanup } from '@/lib/cleanupJobs';

declare global {
  var workersStarted: boolean;
}

if (typeof globalThis !== 'undefined' && !globalThis.workersStarted) {
  startWorker();    // Process queue every 10s
  scheduleCleanup(); // Cleanup every 6 hours
  globalThis.workersStarted = true;
}


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LegalHub — India's Digital Legal Platform",
  description: "Connect with verified lawyers, manage cases digitally, and access justice from anywhere.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
