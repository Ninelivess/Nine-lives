import { catSvg } from "@/engine/art";
import { view } from "@/engine/rpc";

// NFT media: the portrait is drawn from the cat's live on-chain state.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const catId = Number(id);
  let svg: string;
  try {
    const c = await view<{ id: number; personality: string; alive: boolean; fish: number; hunger: number } | null>("get_cat", { cat_id: catId });
    if (!c) return new Response("No such cat", { status: 404 });
    svg = catSvg({ id: c.id, personality: c.personality, alive: c.alive, fish: c.fish, hunger: c.hunger }, 400);
  } catch {
    return new Response("RPC unavailable", { status: 502 });
  }
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=30" } });
}
