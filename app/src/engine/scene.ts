// The alley at night, drawn in pixels on a 480x270 grid. Static layers only; the cats are
// placed on top by AlleyStory. Everything here is original pixel art made of <rect>s.

export const W = 480;
export const H = 270;
export const GROUND = 238;
export const HOME_TOP = 216;
export const HOME_X = [100, 143, 187, 230, 274, 317, 361, 404, 448];

const r = (x: number, y: number, w: number, h: number, fill: string, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra}/>`;

/** Tiny deterministic random numbers so the scene is the same on every render. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// 3x5 pixel glyphs for the neon sign
const GLYPHS: Record<string, string[]> = {
  F: ["111", "100", "110", "100", "100"],
  I: ["111", "010", "010", "010", "111"],
  S: ["111", "100", "111", "001", "111"],
  H: ["101", "101", "111", "101", "101"],
};

function word(text: string, x: number, y: number, px: number, fill: string): string {
  let out = "";
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (!g) return;
    g.forEach((row, ry) => [...row].forEach((b, rx) => b === "1" && (out += r(x + (i * 4 + rx) * px, y + ry * px, px, px, fill))));
  });
  return out;
}

function moon(cx: number, cy: number, rad: number): string {
  let out = "";
  for (let y = -rad; y <= rad; y++) {
    const half = Math.round(Math.sqrt(rad * rad - y * y));
    out += r(cx - half, cy + y, half * 2, 1, "#fff2c2");
  }
  out += r(cx - 6, cy - 4, 4, 3, "#ecdca2") + r(cx + 4, cy + 3, 5, 4, "#ecdca2") + r(cx - 2, cy + 8, 3, 2, "#ecdca2");
  return out;
}

function skyline(): string {
  const rand = rng(7);
  const blocks: [number, number, number][] = [
    [66, 40, 98], [106, 30, 112], [136, 52, 86], [188, 38, 104], [226, 46, 94],
    [330, 40, 102], [370, 30, 116], [400, 50, 92], [450, 30, 106],
  ];
  let out = "";
  for (const [x, w, top] of blocks) {
    out += r(x, top, w, 150 - top + 1, "#0c1130");
    out += r(x, top, w, 1, "#161c45");
    for (let wy = top + 6; wy < 146; wy += 7) {
      for (let wx = x + 4; wx < x + w - 4; wx += 6) {
        const lit = rand() < 0.22;
        out += r(wx, wy, 2, 3, lit ? "#ffd27a" : "#141a40", lit ? ` class="win" style="animation-delay:${(rand() * 6).toFixed(1)}s"` : "");
      }
    }
  }
  // water tower on a roof
  out += r(244, 76, 14, 10, "#0c1130") + r(246, 86, 2, 8, "#0c1130") + r(254, 86, 2, 8, "#0c1130") + r(243, 74, 16, 2, "#161c45");
  return out;
}

function wall(): string {
  let out = r(60, 150, 420, GROUND - 150, "#2e2230");
  for (let y = 150; y < GROUND; y += 6) {
    out += r(60, y, 420, 1, "#251b27");
    const off = ((y - 150) / 6) % 2 === 0 ? 0 : 6;
    for (let x = 60 + off; x < 480; x += 12) out += r(x, y + 1, 1, 5, "#251b27");
  }
  out += r(60, 148, 420, 3, "#4a3646") + r(60, 151, 420, 1, "#1e1520");
  // drainpipe
  out += r(470, 150, 3, GROUND - 150, "#1f2638") + r(468, 170, 7, 2, "#2c3550") + r(468, 210, 7, 2, "#2c3550");
  // graffiti cat face
  out += r(206, 176, 8, 1, "#3f2f40") + r(205, 177, 1, 5, "#3f2f40") + r(214, 177, 1, 5, "#3f2f40") + r(206, 182, 8, 1, "#3f2f40") + r(205, 174, 2, 2, "#3f2f40") + r(213, 174, 2, 2, "#3f2f40");
  return out;
}

function lamp(): string {
  const x = 296;
  let out = `<polygon points="${x - 4},118 ${x + 8},118 ${x + 52},${GROUND} ${x - 48},${GROUND}" fill="#ffe7a3" opacity=".07"/>`;
  out += r(x, 118, 3, GROUND - 118, "#161a2a") + r(x - 4, 112, 12, 4, "#161a2a") + r(x - 2, 116, 8, 2, "#ffe7a3") + r(x - 3, 110, 10, 2, "#22273b");
  out += `<circle cx="${x + 2}" cy="117" r="14" fill="#ffe7a3" opacity=".12"/>`;
  return out;
}

function shop(): string {
  let out = r(0, 108, 64, GROUND - 108, "#232845") + r(0, 106, 66, 3, "#323a63");
  // neon sign: FISH in NEAR green
  out += `<g class="neon">${word("FISH", 9, 118, 3, "#00ec97")}</g>`;
  out += `<g opacity=".35" filter="url(#glow)">${word("FISH", 9, 118, 3, "#00ec97")}</g>`;
  // awning
  for (let x = 0; x < 66; x += 6) out += r(x, 160, 3, 8, "#e5383b") + r(x + 3, 160, 3, 8, "#f1ece3");
  for (let x = 0; x < 66; x += 6) out += r(x, 168, 3, 2, "#e5383b") + r(x + 3, 168, 3, 1, "#f1ece3");
  // window with hanging fish
  out += r(5, 176, 34, 48, "#10132a") + r(5, 176, 34, 1, "#3a4370");
  for (const [fx, fy] of [[10, 184], [22, 188], [14, 200], [26, 204]] as const) {
    out += r(fx, fy, 7, 3, "#7fc3e8") + r(fx + 7, fy - 1, 2, 5, "#5aa0c8") + r(fx + 1, fy + 1, 1, 1, "#0b0d18") + r(fx + 3, fy - 4, 1, 4, "#3a4370");
  }
  // door
  out += r(44, 184, 16, 54, "#151933") + r(44, 184, 16, 1, "#3a4370") + r(56, 210, 2, 2, "#ffd27a");
  // sign board
  out += r(6, 228, 30, 10, "#1b1f38") + r(6, 228, 30, 1, "#3a4370");
  return out;
}

function ground(): string {
  let out = r(0, GROUND, W, H - GROUND, "#1a1522") + r(0, GROUND, W, 1, "#3a2e44");
  const rand = rng(3);
  for (let y = GROUND + 4; y < H; y += 5) {
    for (let x = (y % 10 === 0 ? 0 : 5); x < W; x += 10) out += r(x, y, 6 + Math.round(rand() * 2), 2, "#211a2b");
  }
  // puddle reflecting the moon
  out += r(330, 254, 40, 3, "#202848") + r(336, 257, 28, 2, "#202848") + r(348, 255, 6, 1, "#fff2c2", ' opacity=".5"');
  return out;
}

export function sceneBackground(): string {
  const rand = rng(11);
  let stars = "";
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand() * W);
    const y = Math.floor(rand() * 100);
    if (Math.abs(x - 410) < 26 && Math.abs(y - 40) < 26) continue;
    stars += r(x, y, 1, 1, "#ffffff", ` class="tw" style="animation-delay:${(rand() * 4).toFixed(2)}s"`);
  }
  return [
    `<defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>`,
    `<radialGradient id="moonglow"><stop offset="0" stop-color="#fff2c2" stop-opacity=".35"/><stop offset="1" stop-color="#fff2c2" stop-opacity="0"/></radialGradient></defs>`,
    r(0, 0, W, 40, "#090c22"), r(0, 40, W, 40, "#0c1029"), r(0, 80, W, 36, "#111634"), r(0, 116, W, 40, "#171c40"),
    stars,
    `<circle cx="410" cy="40" r="46" fill="url(#moonglow)" class="moonglow"/>`,
    moon(410, 40, 16),
    skyline(),
    wall(),
    lamp(),
    shop(),
    ground(),
  ].join("");
}

// ---------------------------------------------------------------- homes

type Home = { back: string; front: string; insideY: number };

function outline(x: number, y: number, w: number, h: number, c: string) {
  return r(x, y, w, 1, c) + r(x, y + h - 1, w, 1, c) + r(x, y, 1, h, c) + r(x + w - 1, y, 1, h, c);
}

export function home(i: number): Home {
  const cx = HOME_X[i];
  const t = HOME_TOP;
  const h = GROUND - t;
  const x = cx - 17;
  const w = 34;
  const inside = 210;
  switch (i) {
    case 0: // cardboard box
      return {
        back: r(x + 1, t - 2, w - 2, 3, "#5a3a1d"),
        front: r(x, t, w, h, "#b9834a") + outline(x, t, w, h, "#4a2d14") + r(cx - 2, t, 4, h, "#d3a067") + r(x - 5, t - 4, 7, 2, "#c8935a") + r(x - 3, t - 2, 5, 2, "#c8935a") + r(x + w - 2, t - 4, 7, 2, "#c8935a") + r(x + w - 2, t - 2, 5, 2, "#c8935a") + r(x + 4, t + 12, 8, 1, "#8a5c2c") + r(x + 4, t + 14, 6, 1, "#8a5c2c"),
        insideY: inside,
      };
    case 1: { // laundry basket
      let f = r(x, t, w, h, "#e3cf9f") + outline(x, t, w, h, "#7a6233");
      for (let yy = t + 3; yy < GROUND - 1; yy += 3) for (let xx = x + 2 + ((yy - t) % 6 === 0 ? 0 : 2); xx < x + w - 2; xx += 4) f += r(xx, yy, 2, 1, "#b79e65");
      f += r(x + 3, t - 4, 2, 4, "#7a6233") + r(x + w - 5, t - 4, 2, 4, "#7a6233") + r(x + 3, t - 5, 6, 1, "#7a6233") + r(x + w - 9, t - 5, 6, 1, "#7a6233");
      return { back: r(x + 1, t - 1, w - 2, 2, "#5f4c25"), front: f, insideY: inside };
    }
    case 2: { // trash can with a tilted lid
      let f = r(x + 1, t, w - 2, h, "#7c8594") + outline(x + 1, t, w - 2, h, "#2f3542") + r(x, t, w, 3, "#5f6776");
      for (let xx = x + 5; xx < x + w - 4; xx += 5) f += r(xx, t + 4, 1, h - 6, "#5f6776");
      const lid = r(x + w - 4, t - 10, 3, 12, "#8f98a8") + r(x + w - 1, t - 12, 2, 14, "#5f6776") + r(x + w - 6, t - 6, 2, 3, "#5f6776");
      return { back: r(x + 2, t - 1, w - 4, 2, "#1d222c"), front: f + lid, insideY: inside };
    }
    case 3: // wooden crate
      return {
        back: r(x + 1, t - 1, w - 2, 2, "#3e2814"),
        front: r(x, t, w, h, "#9a6a3b") + outline(x, t, w, h, "#4a2f15") + r(x, t + 7, w, 1, "#6e4a26") + r(x, t + 14, w, 1, "#6e4a26") + r(x + 3, t + 1, 2, h - 2, "#b88250") + r(x + w - 5, t + 1, 2, h - 2, "#b88250"),
        insideY: inside,
      };
    case 4: { // flower pot
      let f = "";
      for (let yy = 0; yy < h; yy++) {
        const half = 17 - Math.floor(yy / 4);
        f += r(cx - half, t + yy, half * 2, 1, yy < 4 ? "#df7a4c" : "#c8643b");
        f += r(cx - half, t + yy, 1, 1, "#7a3318") + r(cx + half - 1, t + yy, 1, 1, "#7a3318");
      }
      f += r(cx - 17, t, 34, 1, "#7a3318") + r(cx - 17, t + 4, 34, 1, "#9e4a26");
      f += r(x - 3, t - 7, 2, 7, "#3fa35a") + r(x - 6, t - 9, 4, 3, "#5cc46a") + r(x - 1, t - 11, 4, 3, "#5cc46a");
      return { back: r(x + 2, t - 1, w - 4, 2, "#4a2310"), front: f, insideY: inside };
    }
    case 5: { // paper bag
      let f = r(x + 1, t, w - 2, h, "#d8b98a") + outline(x + 1, t, w - 2, h, "#7a5c34");
      for (let xx = x + 1; xx < x + w - 1; xx += 4) f += r(xx, t - 2, 2, 2, "#d8b98a") + r(xx, t - 3, 2, 1, "#7a5c34");
      f += r(x + 6, t + 3, 1, h - 5, "#c09c68") + r(x + w - 7, t + 3, 1, h - 5, "#c09c68");
      return { back: r(x + 2, t - 1, w - 4, 2, "#5b4122"), front: f, insideY: inside };
    }
    case 6: { // blue fish crate
      let f = r(x, t, w, h, "#3d7fb3") + outline(x, t, w, h, "#1a3e5c");
      for (let yy = t + 4; yy < GROUND - 3; yy += 6) for (let xx = x + 4; xx < x + w - 4; xx += 6) f += r(xx, yy, 3, 3, "#244f75");
      f += r(x + w - 2, t - 3, 6, 3, "#7fc3e8") + r(x + w + 4, t - 4, 2, 5, "#5aa0c8");
      return { back: r(x + 1, t - 1, w - 2, 2, "#132c43"), front: f, insideY: inside };
    }
    case 7: { // treasure chest with an open lid
      const back = r(x, t - 12, w, 12, "#6e4320") + r(x, t - 12, w, 2, "#ffd23f") + r(x + 3, t - 10, 2, 10, "#c99a12") + r(x + w - 5, t - 10, 2, 10, "#c99a12") + r(x + 1, t - 1, w - 2, 2, "#2e1a08");
      const front = r(x, t, w, h, "#8a5a2b") + outline(x, t, w, h, "#3e2410") + r(x + 3, t, 3, h, "#ffd23f") + r(x + w - 6, t, 3, h, "#ffd23f") + r(cx - 3, t + 4, 6, 7, "#ffd23f") + r(cx - 1, t + 6, 2, 3, "#3e2410") + r(x, t + 13, w, 1, "#6a4220");
      return { back, front, insideY: inside };
    }
    default: { // cat bed
      const bt = GROUND - 12;
      let f = r(x - 2, bt, w + 4, 12, "#6c5ba8") + r(x - 2, bt, w + 4, 3, "#8f7fd0") + r(x - 3, bt + 1, 1, 10, "#3d3170") + r(x + w + 2, bt + 1, 1, 10, "#3d3170") + r(x - 2, GROUND - 1, w + 4, 1, "#3d3170");
      f += r(x + 4, bt + 6, 2, 2, "#8f7fd0") + r(x + 14, bt + 7, 2, 2, "#8f7fd0") + r(x + 24, bt + 6, 2, 2, "#8f7fd0");
      return { back: r(x - 1, bt - 2, w + 2, 2, "#4b3d86"), front: f, insideY: 214 };
    }
  }
}

/** A small pixel fish (used for trade animations and icons). */
export function fishPixels(): string {
  return r(0, 1, 6, 3, "#7fc3e8") + r(6, 0, 2, 5, "#5aa0c8") + r(1, 2, 1, 1, "#0b0d18") + r(0, 1, 6, 1, "#a8dcf5");
}
