import { pixelCatSvg } from "@/engine/pixel";
import { view } from "@/engine/rpc";

// NFT media: the pixel portrait is drawn from the cat's live on-chain state.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const catId = Number(id);
  let svg: string;
  try {
    const c = await view<{ id: number; personality: string; alive: boolean; fish: number; hunger: number; generation?: number } | null>("get_cat", { cat_id: catId });
    if (!c) return new Response("No such cat", { status: 404 });
    svg = pixelCatSvg({ id: c.id, personality: c.personality, alive: c.alive, fish: c.fish, hunger: c.hunger, generation: c.generation }, 512, true);
  } catch {
    return new Response("RPC unavailable", { status: 502 });
  }
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=30" } });
}
