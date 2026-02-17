import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Capacity-aware Roadmap Builder",
  description: "Prototype for capacity-aware roadmap planning"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
