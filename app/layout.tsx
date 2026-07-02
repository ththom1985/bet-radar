import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bet-Radar — Fußball Value-Wetten",
  description: "Value-Analyse für die europäischen Topligen",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-white/10 bg-[#0d1526]">
          <div className="mx-auto max-w-6xl px-5 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
              <span className="text-emerald-400">⚽</span> Bet-Radar
            </Link>
            <nav className="flex gap-1 text-sm">
              <NavLink href="/">Top-Wetten</NavLink>
              <NavLink href="/matches">Spiele</NavLink>
              <NavLink href="/portfolio">Tracker</NavLink>
              <NavLink href="/ranking">WM-Rangliste</NavLink>
            </nav>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-6xl px-5 py-8">{children}</main>

        <footer className="border-t border-white/10 text-xs text-white/40">
          <div className="mx-auto max-w-6xl px-5 py-4 leading-relaxed">
            <strong className="text-white/60">Hinweis:</strong> Bet-Radar ist ein Analyse-Werkzeug,
            keine Wett-Empfehlung und keine Gewinngarantie. Ein positiver „Value" bedeutet nur, dass
            das Modell optimistischer ist als der Buchmacher — nicht, dass die Wette gewinnt.
            Glücksspiel kann süchtig machen. Nur mit Geld spielen, dessen Verlust du verkraftest.
            Hilfe: <span className="text-white/60">buwei.de · 0800 1372700</span>
          </div>
        </footer>
      </body>
    </html>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/5 transition-colors"
    >
      {children}
    </Link>
  );
}
