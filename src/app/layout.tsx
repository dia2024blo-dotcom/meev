import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meev — One app. Every way to hang out.",
  description:
    "Meev is the social super-app: communities, feeds, stories, random 1v1 live rooms, gifts, levels and a living cat mascot. Discord × Instagram × Omegle × Hala in one experience.",
  keywords: ["Meev", "social", "communities", "chat", "random chat", "gifts", "levels"],
  authors: [{ name: "Meev" }],
  icons: {
    // v14: transparent SVG mark first — the cat head in the ONE brand
    // gold→cream gradient (no rim, no plate); PNG stays as fallback.
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/meev-logo.png", sizes: "any" },
    ],
    apple: "/meev-logo.png",
  },
  openGraph: {
    title: "Meev — One app. Every way to hang out.",
    description: "Communities, feeds, stories, 1v1 live rooms, gifts, levels & the living cat.",
    siteName: "Meev",
    type: "website",
  },
};

export const viewport: Viewport = {
  // v15: media-based theme colors matching the v15 canvases — TRUE BLACK
  // night / PURE WHITE day (globals.css) under the single gold->cream
  // brand gradient
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
