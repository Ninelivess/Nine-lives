// Pixel-art cats, drawn from on-chain state. 32x32 sprites, original art.
// The left half of the base sprite is written by hand and mirrored; accessories are overlays.

export interface PixelInput {
  id: number;
  personality: string;
  alive: boolean;
  fish: number;
  hunger: number;
}

// Legend: . empty, O outline, F fur, S shade, L light (muzzle, belly, paws), P pink (ears, nose),
// B blush, K eye, W eye shine, M mouth.
const HALF = [
  "................",
  "................",
  "....OO..........",
  "....OFO.........",
  "...OFPFO........",
  "...OFPPFO.......",
  "...OFPPFFOOOOOOO",
  "..OFFPFFFFFFFFFF",
  "..OFFFFFFFFFFFFF",
  ".OFFFFFFFFFFFFFF",
  ".OFFFFFFFFFFFFFF",
  ".OFFFFFFFFFFFFFF",
  ".OFFFFFWKFFFFFFF",
  ".OFFFFFKKFFFFFFF",
  ".OFFFFFKKFFFFFFF",
  ".OFFBBFFFFFFFLLP",
  ".OFFFFFFFFFFLLML",
  "..OFFFFFFFFFLLLM",
  "..OFFFFFFFFFFLLL",
  "...OFFFFFFFFFFFF",
  "....OOFFFFFFFFFF",
  "......OSFFFFFFFF",
  ".....OSFFFFFFFFF",
  ".....OSFFFFFLLLL",
  "....OSFFFFFLLLLL",
  "....OSFFFFFLLLLL",
  "....OSFFFFOLLLLL",
  "....OSFFFFOLLLLO",
  "....OSFFFFOLLLLO",
  "....OSSFFOLLLLLO",
  ".....OOOOOOOOOOO",
  "................",
];

const BASE: string[] = HALF.map((h) => h + [...h].reverse().join(""));

type Palette = Record<"O" | "F" | "S" | "L" | "P" | "B" | "K" | "W" | "M", string> & { bg: [string, string] };

const PALETTES: Record<string, Palette> = {
  shark: { O: "#1b2233", F: "#7b93b5", S: "#56698a", L: "#d6e1ef", P: "#f2a0b0", B: "#f6b8c4", K: "#141a26", W: "#ffffff", M: "#1b2233", bg: ["#1d2b46", "#0f1626"] },
  hoarder: { O: "#3a1f0d", F: "#f4a95e", S: "#d07d36", L: "#fde6c6", P: "#f59aa6", B: "#ffb3a7", K: "#2a160a", W: "#ffffff", M: "#3a1f0d", bg: ["#4a2a12", "#1f1208"] },
  bluffer: { O: "#1d1b26", F: "#8a879b", S: "#65627a", L: "#c9c6d6", P: "#e79bb0", B: "#f0b2c2", K: "#ffcf3f", W: "#fff6c8", M: "#1d1b26", bg: ["#2c2840", "#14121f"] },
  gambler: { O: "#07060b", F: "#34304a", S: "#221f33", L: "#4d4868", P: "#d9798f", B: "#a0577a", K: "#ffd23f", W: "#fffbe0", M: "#07060b", bg: ["#3a1846", "#150a1c"] },
  saint: { O: "#3b3445", F: "#f6f1e7", S: "#d9d0c0", L: "#ffffff", P: "#f4a6b8", B: "#ffc2cf", K: "#2e7fd1", W: "#ffffff", M: "#3b3445", bg: ["#1e3c4f", "#0d1b24"] },
  follower: { O: "#33303a", F: "#f7f2ea", S: "#d9d2c6", L: "#ffffff", P: "#f2a3b4", B: "#ffc0cc", K: "#3f8f4a", W: "#ffffff", M: "#33303a", bg: ["#1f3d2a", "#0d1a12"] },
  panicker: { O: "#3a120a", F: "#f0805e", S: "#c95a3d", L: "#ffd9c8", P: "#ffa4b0", B: "#ff9c8c", K: "#d7263d", W: "#ffffff", M: "#3a120a", bg: ["#4d1a1a", "#1f0a0a"] },
  monopolist: { O: "#3a2a05", F: "#e4b93f", S: "#b48a1e", L: "#f8e7a8", P: "#f2a0a0", B: "#ffc0a0", K: "#1c7a5b", W: "#ffffff", M: "#3a2a05", bg: ["#463711", "#1d1606"] },
  lazy: { O: "#2a2233", F: "#ab9cbb", S: "#857595", L: "#e2d9ec", P: "#f0a8c0", B: "#f5bfd3", K: "#5b3d8a", W: "#ffffff", M: "#2a2233", bg: ["#2c2448", "#130f20"] },
};

const GHOST: Palette = { O: "#6b7fa8", F: "#e9f1ff", S: "#c8d6f2", L: "#ffffff", P: "#c8d6f2", B: "#dbe5fb", K: "#6b7fa8", W: "#e9f1ff", M: "#6b7fa8", bg: ["#18233d", "#0a0f1c"] };

type Px = [number, number, string]; // row, col, color key or literal color

/** Accessory pixels per personality, drawn on top of the cat. Literal colors start with '#'. */
function accessory(p: string): Px[] {
  const px: Px[] = [];
  const row = (r: number, c0: number, s: string, map: Record<string, string>) =>
    [...s].forEach((ch, i) => ch !== "." && px.push([r, c0 + i, map[ch] ?? ch]));
  switch (p) {
    case "shark": {
      // sunglasses
      const m = { k: "#0b0d12", g: "#3a4a66", w: "#ffffff" };
      row(11, 5, "kkkkkkkkkkkkkkkkkkkkkk", m);
      row(12, 5, "kgwgkk........kkgwgkk.", m);
      row(13, 5, ".kggk..........kggk...", m);
      row(14, 5, "..kk............kk....", m);
      break;
    }
    case "hoarder": {
      // tabby stripes + a fish held at the belly
      const m = { s: "S" };
      row(7, 13, "s.s.s.", m);
      row(8, 14, "s..s", m);
      const f = { b: "#7fc3e8", d: "#3d7fa8", w: "#ffffff" };
      row(24, 9, "..bbbbbbbbb.d.", f);
      row(25, 9, ".bbwbbbbbbbbdd", f);
      row(26, 9, "..bbbbbbbbb.d.", f);
      break;
    }
    case "bluffer": {
      // top hat with a red band
      const m = { k: "#141218", r: "#d7263d", h: "#2b2833" };
      row(0, 10, "..kkkkkkkkkk..", m);
      row(1, 10, "..khhhhhhhhk..", m);
      row(2, 10, "..khhhhhhhhk..", m);
      row(3, 10, "..khhhhhhhhk..", m);
      row(4, 10, "..krrrrrrrrk..", m);
      row(5, 10, "kkkkkkkkkkkkkk", m);
      break;
    }
    case "gambler": {
      // a die in the paws
      const m = { w: "#ffffff", k: "#1a1a1a", g: "#cfcfd8" };
      row(24, 12, "wwwwwww", m);
      row(25, 12, "wkwwwkw", m);
      row(26, 12, "wwwkwww", m);
      row(27, 12, "wkwwwkw", m);
      row(28, 12, "ggggggg", m);
      break;
    }
    case "saint": {
      // red scarf with a white heart
      const m = { r: "#e5383b", d: "#b5222a", w: "#ffffff" };
      row(20, 6, "rrrrrrrrrrrrrrrrrrrr", m);
      row(21, 6, "drrrrrrrrrrrrrrrrrrd", m);
      row(22, 13, "rwrwr", m);
      row(23, 13, "rwwwr", m);
      row(24, 14, "rwr", m);
      row(25, 15, "r", m);
      break;
    }
    case "follower": {
      // grey patches + a tiny green flag
      const m = { g: "#b9b2c4" };
      row(7, 17, "ggg", m);
      row(8, 16, "gggggg", m);
      row(9, 17, "gggg", m);
      row(23, 7, "gg", m);
      row(24, 6, "ggg", m);
      const f = { p: "#6b4f3a", g: "#5cc46a", d: "#3a9a48" };
      row(18, 27, "pgg", f);
      row(19, 27, "pggd", f);
      row(20, 27, "pgg", f);
      for (let r = 21; r <= 29; r++) row(r, 27, "p", f);
      break;
    }
    case "panicker": {
      // wide eyes + sweat drops
      const m = { w: "#ffffff", b: "#7fd6ff" };
      row(12, 6, "w", m);
      row(13, 6, "w", m);
      row(12, 25, "w", m);
      row(13, 25, "w", m);
      row(6, 26, "b", m);
      row(7, 25, "bbb", m);
      row(8, 25, "bbb", m);
      row(9, 3, "b", m);
      row(10, 2, "bbb", m);
      break;
    }
    case "monopolist": {
      // crown with gems
      const m = { y: "#ffd23f", d: "#c99a12", r: "#e63946", g: "#2ec4b6" };
      row(1, 10, "y....y....y.", m);
      row(2, 10, "yy..yyy..yy.", m);
      row(3, 10, "yyyyyyyyyyy.", m);
      row(4, 10, "yryyygyyyry.", m);
      row(5, 10, "ddddddddddd.", m);
      break;
    }
    case "lazy": {
      // sleepy eyes + nightcap
      const m = { k: "K", f: "F" };
      row(12, 7, "ff", m);
      row(13, 7, "kk", m);
      row(14, 7, "ff", m);
      row(12, 23, "ff", m);
      row(13, 23, "kk", m);
      row(14, 23, "ff", m);
      const c = { b: "#4361ee", d: "#2f47c4", w: "#ffffff" };
      row(3, 20, "...bb.ww", c);
      row(4, 14, "....bbbbbbdww", c);
      row(5, 10, "..bbbbbbbbbbbd", c);
      row(6, 8, "wwwwwwwwwwwwwwww", c);
      break;
    }
  }
  return px;
}

function hungryOverlay(): Px[] {
  // sad brows, a tear and an open mouth
  return [
    [11, 6, "O"], [10, 7, "O"], [11, 25, "O"], [10, 24, "O"],
    [15, 9, "#7fd6ff"], [16, 9, "#7fd6ff"], [15, 22, "#7fd6ff"],
    [17, 14, "M"], [17, 15, "M"], [17, 16, "M"], [17, 17, "M"], [18, 15, "M"], [18, 16, "M"],
  ];
}

function ghostOverlay(): Px[] {
  const px: Px[] = [];
  // X eyes
  for (const c of [7, 23]) {
    px.push([12, c - 1, "K"], [12, c + 1, "K"], [13, c, "K"], [14, c - 1, "K"], [14, c + 1, "K"]);
    px.push([12, c, "F"], [13, c - 1, "F"], [13, c + 1, "F"], [14, c, "F"]);
  }
  return px;
}

function tail(): Px[] {
  const px: Px[] = [];
  const pts: [number, number][] = [[28, 26], [27, 27], [26, 28], [25, 28], [24, 28], [23, 27], [22, 27], [29, 25], [29, 24]];
  for (const [r, c] of pts) {
    px.push([r, c, "F"], [r - 1, c, "O"], [r, c + 1, "O"]);
  }
  px.push([21, 27, "O"], [22, 26, "O"], [23, 26, "O"], [29, 23, "O"], [30, 24, "O"], [30, 25, "O"], [29, 26, "O"]);
  return px;
}

/** Wavy ghost bottom: cut the paws off and replace them with a wave. */
function ghostBottom(grid: string[][]): void {
  for (let r = 27; r < 32; r++) for (let c = 0; c < 32; c++) grid[r][c] = ".";
  const wave = ["....OFFFFFFFFFFFFFFFFFFFFFFFO....", "....OFFOFFFOFFFFFFOFFFOFFFFO.....", ".....OO.OOO.OOOOOO.OOO.OOOO......"];
  wave.forEach((s, i) => [...s.slice(0, 32)].forEach((ch, c) => ch !== "." && (grid[27 + i][c] = ch)));
}

export function pixelGrid(c: PixelInput): { grid: string[][]; pal: Palette } {
  const pal = c.alive ? PALETTES[c.personality] ?? PALETTES.shark : GHOST;
  const grid = BASE.map((r) => [...r]);
  const put = (px: Px[]) => px.forEach(([r, col, v]) => r >= 0 && r < 32 && col >= 0 && col < 32 && (grid[r][col] = v));
  if (c.alive) put(tail());
  if (c.alive) put(accessory(c.personality));
  if (c.alive && c.hunger > 0) put(hungryOverlay());
  if (!c.alive) {
    put(ghostOverlay());
    ghostBottom(grid);
  }
  return { grid, pal };
}

function color(pal: Palette, v: string): string | null {
  if (v === ".") return null;
  if (v.startsWith("#")) return v;
  return (pal as unknown as Record<string, string>)[v] ?? null;
}

/**
 * SVG of the cat. `background: true` adds the tinted tile with scanlines (used for NFT media);
 * the web UI draws its own tile and asks for a transparent sprite.
 */
export function pixelCatSvg(c: PixelInput, size = 256, background = false): string {
  const { grid, pal } = pixelGrid(c);
  const rects: string[] = [];
  for (let r = 0; r < 32; r++) {
    let c0 = 0;
    while (c0 < 32) {
      const col = color(pal, grid[r][c0]);
      let c1 = c0 + 1;
      while (c1 < 32 && color(pal, grid[r][c1]) === col) c1++;
      if (col) rects.push(`<rect x="${c0}" y="${r}" width="${c1 - c0}" height="1" fill="${col}"/>`);
      c0 = c1;
    }
  }
  const halo = c.alive ? "" : `<g fill="#ffd23f"><rect x="10" y="0" width="12" height="1"/><rect x="9" y="1" width="1" height="1"/><rect x="22" y="1" width="1" height="1"/><rect x="10" y="2" width="12" height="1"/></g>`;
  const uid = `${c.id}${c.alive ? "a" : "g"}${c.hunger}`;
  const bg = background
    ? `<defs><linearGradient id="g${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.bg[0]}"/><stop offset="1" stop-color="${pal.bg[1]}"/></linearGradient><pattern id="s${uid}" width="1" height="2" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#000" opacity=".18"/></pattern></defs><rect x="-4" y="-4" width="40" height="40" fill="url(#g${uid})"/><rect x="-4" y="-4" width="40" height="40" fill="url(#s${uid})"/>`
    : "";
  const vb = background ? "-4 -4 40 40" : "0 0 32 32";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="${c.alive ? "cat" : "ghost cat"} #${c.id}">${bg}<g${c.alive ? "" : ' opacity=".9"'}>${rects.join("")}${halo}</g></svg>`;
}

export function tileColors(personality: string, alive: boolean): [string, string] {
  return alive ? (PALETTES[personality] ?? PALETTES.shark).bg : GHOST.bg;
}
