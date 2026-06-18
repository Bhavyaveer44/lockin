import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider, Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lockin — your camera, your focus coach",
  description:
    "On-device focus tracking. Your camera feed never leaves your device — only an AI debrief does.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
          <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
            <Link href="/" className="font-mono text-lg font-bold tracking-tight">
              lock<span className="text-emerald-400">in</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Show when="signed-in">
                <Link href="/session" className="hover:text-emerald-400">
                  Session
                </Link>
                <Link href="/today" className="hover:text-emerald-400">
                  Today
                </Link>
                <UserButton />
              </Show>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="rounded-full bg-emerald-500 px-4 py-1.5 font-medium text-neutral-950 hover:bg-emerald-400">
                    Sign in
                  </button>
                </SignInButton>
              </Show>
            </nav>
          </header>
          <main className="flex-1 flex flex-col">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
