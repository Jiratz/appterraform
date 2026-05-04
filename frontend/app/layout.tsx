import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "./components/Toast";
import { ThemeProvider, ThemeToggle } from "./components/ThemeProvider";

export const metadata: Metadata = {
  title: "OCI Terraform Manager",
  description: "สร้าง OCI Infrastructure ง่ายๆ ไม่ต้องเขียน Terraform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="dark">
      <body className="bg-gray-950 antialiased">
        <ThemeProvider>
          <ToastProvider>
            <ThemeToggle />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
