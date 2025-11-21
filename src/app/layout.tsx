import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ViewProvider } from "./components/ViewContext";
import { PermissionsProvider } from "./components/PermissionsContext";
import ThemeInit from "./components/ThemeInit";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import SyncStatus from "./components/SyncStatus";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Drainage Inspection",
  description: "Drainage Inspection workspace",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/icon.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeInit />
        <ServiceWorkerRegister />
        <SyncStatus />
        <ViewProvider>
          <PermissionsProvider>
            {children}
          </PermissionsProvider>
        </ViewProvider>
      </body>
    </html>
  );
}
