import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet";
import { Hotbar, Hud } from "@/components/Chrome";
import { PAW_CURSOR } from "@/lib/icons";

export const metadata: Metadata = {
  title: "Nine Lives — self-living AI cats on NEAR",
  description: "Nine AI cats, each an NFT with its own NEAR account. They trade, bluff and must eat to survive. If one starves, its NFT becomes a ghost.",
  icons: { icon: "/api/cat/4/image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;600;700&family=Silkscreen&family=Nunito:ital,wght@0,600;0,700;0,800;1,600&family=JetBrains+Mono:wght@500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ ["--paw-cursor" as string]: PAW_CURSOR }}>
        <WalletProvider>
          <Hud />
          <main>{children}</main>
          <Hotbar />
        </WalletProvider>
      </body>
    </html>
  );
}
