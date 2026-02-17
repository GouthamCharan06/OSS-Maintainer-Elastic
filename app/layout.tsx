import type { Metadata } from "next";
import "./globals.css";
import { DashboardProvider } from "@/components/DashboardProvider";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "OSS Maintainer Agent | Elastic Agent Builder",
  description:
    "Multi-agent intelligence pipeline for open source maintainers. Powered by Elastic Agent Builder, ES|QL, and Elasticsearch. Automates PR risk scoring, repository health analysis, and maintainer briefings.",
  keywords: [
    "Elasticsearch",
    "Agent Builder",
    "ES|QL",
    "Open Source",
    "GitHub",
    "PR Review",
    "Multi-Agent",
    "OSS Maintainer",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <DashboardProvider>
          <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
            <Sidebar />
            <main style={{ flex: 1, height: "100vh", overflow: "hidden" }}>
              {children}
            </main>
          </div>
        </DashboardProvider>
      </body>
    </html>
  );
}
