import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GhostChat — Meet New People Instantly",
  description: "Start anonymous text and video conversations with strangers around the world. Fast, secure, and free matching.",
  keywords: "chat, anonymous chat, video chat, meet strangers, random chat, WebRTC, secure chat",
  icons: {
    icon: '/favicon.svg'
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var defaultUrl = "${process.env.NEXT_PUBLIC_SERVER_URL || ''}";
                if (!defaultUrl) {
                  defaultUrl = window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1")
                    ? "http://localhost:4000"
                    : "https://ghostchat-backend.onrender.com";
                }
                window.GHOSTCHAT_SERVER_URL = localStorage.getItem("ghostchat_backend_url") || defaultUrl;
              })();
            `
          }}
        />
      </head>
      <body className="min-h-full flex flex-col antialiased bg-white text-brand-black">
        {children}
      </body>
    </html>
  );
}

