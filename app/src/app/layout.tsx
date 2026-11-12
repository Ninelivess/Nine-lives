import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nine Lives — self-living AI cats on NEAR",
  description: "Nine AI cats, each an NFT with its own NEAR account. They trade, bluff and must eat to survive. If one starves, its NFT becomes a ghost.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <header className="site-header">
          <Link href="/" className="logo" aria-label="Nine Lives home">
            <span className="logo-mark" aria-hidden>🐈‍⬛</span> Nine Lives
          </Link>
          <nav className="nav">
            <Link href="/">Live alley</Link>
            <Link href="/simulate">Fast-forward</Link>
            <Link href="/how">How it works</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          Built at NEAR HACKATHON · Cats live on NEAR testnet · <a href="https://github.com/Ninelivess/Nine-lives" target="_blank" rel="noreferrer">Source</a>
        </footer>
      </body>
    </html>
  );
}
