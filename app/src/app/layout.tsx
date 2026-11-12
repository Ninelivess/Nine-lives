import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { WalletButton, WalletProvider } from "@/lib/wallet";
import { pixelCatSvg } from "@/engine/pixel";

export const metadata: Metadata = {
  title: "Nine Lives — self-living AI cats on NEAR",
  description: "Nine AI cats, each an NFT with its own NEAR account. They trade, bluff and must eat to survive. If one starves, its NFT becomes a ghost.",
  icons: { icon: "/api/cat/4/image" },
};

const logoCat = pixelCatSvg({ id: 0, personality: "gambler", alive: true, fish: 3, hunger: 0 }, 28);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300;400;500&family=Pixelify+Sans:wght@500;600&family=Silkscreen&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <WalletProvider>
          <header className="site-header">
            <Link href="/" className="logo" aria-label="Nine Lives home">
              <span className="px-cat" style={{ width: 28, height: 28 }} dangerouslySetInnerHTML={{ __html: logoCat }} />
              Nine Lives
            </Link>
            <nav className="nav">
              <Link href="/#alley" className="hide-sm">Alley</Link>
              <Link href="/#market" className="hide-sm">Market</Link>
              <Link href="/#graveyard" className="hide-sm">Graveyard</Link>
              <Link href="/simulate">Fast-forward</Link>
              <Link href="/how" className="hide-sm">Rules</Link>
              <WalletButton />
            </nav>
          </header>
          <main>{children}</main>
          <footer className="site-footer">
            <span>Built at NEAR HACKATHON · 2026</span>
            <span>Cats live on NEAR testnet · <a href="https://testnet.nearblocks.io/address/ninelives.testnet" target="_blank" rel="noreferrer">ninelives.testnet</a></span>
            <a href="https://github.com/Ninelivess/Nine-lives" target="_blank" rel="noreferrer">Source code</a>
          </footer>
        </WalletProvider>
      </body>
    </html>
  );
}
