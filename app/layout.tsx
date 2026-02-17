import type { ReactNode } from "react";

export const metadata = {
  title: "AI PM Roadmap",
  description: "Capacity-aware roadmap builder prototype"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
        {children}
      </body>
    </html>
  );
}
