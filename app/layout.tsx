import type { Metadata, Viewport } from "next";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import "./globals.css";

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`;

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://nearme-sand.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "Near Me", template: "%s · Near Me" },
  description: "Share your location temporarily, see everyone on one map, and find somewhere to meet.",
  applicationName: "Near Me",
  appleWebApp: { capable: true, title: "Near Me", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Near Me",
    description: "Share your location temporarily, see everyone on one map, and find somewhere to meet.",
    siteName: "Near Me",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a className="skip" href="#content">
          Skip to content
        </a>
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
