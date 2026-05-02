import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AutoReloadOnChunkError } from "@/components/auto-reload-on-chunk-error";

export const metadata: Metadata = {
  title: "Creative Nexus Command Centre",
  description: "AI-native agency operating system by Creative Nexus Global",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            <AutoReloadOnChunkError />
            {children}
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
