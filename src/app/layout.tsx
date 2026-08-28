import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider, themeScript } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { NetworkProvider } from "@/components/network-provider";

export const metadata: Metadata = {
  title: {
    default: "Confluence — AI chat, alone or together",
    template: "%s · Confluence",
  },
  description:
    "A ChatGPT/Discord hybrid: private 1:1 AI chat plus opt-in AI participation inside multi-user rooms. Streaming, moderated, and built on Supabase.",
  openGraph: {
    title: "Confluence — AI chat, alone or together",
    description:
      "Private 1:1 AI chat plus opt-in AI participation inside multi-user rooms.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <NetworkProvider>
            <ToastProvider>
              <SessionProvider>{children}</SessionProvider>
            </ToastProvider>
          </NetworkProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
