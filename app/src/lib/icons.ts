// Small pixel icons drawn as SVG. Each icon is a grid of characters mapped to colors.

const PAL: Record<string, string> = {
  k: "#2a1d33", // ink
  w: "#f8eedb", // paper
  y: "#ffcf4a", // gold
  o: "#e8a33a", // dark gold
  r: "#ff7a6b", // coral
  p: "#f4a6b8", // pink
  b: "#7fc3e8", // fish blue
  d: "#4f8fbf", // dark blue
  g: "#00ec97", // NEAR green
  s: "#b9cdfa", // ghost
  t: "#8a7fb0", // stone
  u: "#5f557f", // dark stone
  n: "#9a6a3b", // wood
  m: "#c9a27a", // light wood
};

const ICONS: Record<string, string[]> = {
  house: [
    "....kk....",
    "...kyyk...",
    "..kyyyyk..",
    ".kyyyyyyk.",
    "kkkkkkkkkk",
    ".knnnnnnk.",
    ".knnkknnk.",
    ".knnkknnk.",
    ".knnkknnk.",
    ".kkkkkkkk.",
  ],
  cat: [
    ".k......k.",
    "kpk....kpk",
    "kwwkkkkwwk",
    "kwwwwwwwwk",
    "kwkwwwwkwk",
    "kwkwwwwkwk",
    "kwwwppwwwk",
    "kwwwkkwwwk",
    ".kwwwwwwk.",
    "..kkkkkk..",
  ],
  paper: [
    "kkkkkkkk..",
    "kwwwwwwkk.",
    "kwkkkkwwk.",
    "kwwwwwwwk.",
    "kwkkkkkwk.",
    "kwwwwwwwk.",
    "kwkkkkkwk.",
    "kwwwwwwwk.",
    "kwkkkwwwk.",
    "kkkkkkkkk.",
  ],
  tomb: [
    "...kkkk...",
    "..kttttk..",
    ".kttttttk.",
    ".ktkttktk.",
    ".kttkkttk.",
    ".ktkttktk.",
    ".kttttttk.",
    ".kttttttk.",
    "kkkkkkkkkk",
    "kuuuuuuuuk",
  ],
  book: [
    "kkkkk.kkkk",
    "kwwwkkwwwk",
    "kwkwkkwkwk",
    "kwwwkkwwwk",
    "kwkwkkwkwk",
    "kwwwkkwwwk",
    "kwkwkkwkwk",
    "kwwwkkwwwk",
    "kkkkkkkkkk",
    "....kk....",
  ],
  ff: [
    "..........",
    "k...k.....",
    "kk..kk....",
    "kyk.kyk...",
    "kyykkyyk..",
    "kyykkyyk..",
    "kyk.kyk...",
    "kk..kk....",
    "k...k.....",
    "..........",
  ],
  moon: [
    "...kkkk...",
    "..kyyyyk..",
    ".kyyykk...",
    ".kyyk.....",
    "kyyk......",
    "kyyk......",
    ".kyyk.....",
    ".kyyykk...",
    "..kyyyyk..",
    "...kkkk...",
  ],
  heart: [
    "..........",
    ".kk...kk..",
    "krrk.krrk.",
    "krrrkrrrk.",
    "krrrrrrrk.",
    ".krrrrrk..",
    "..krrrk...",
    "...krk....",
    "....k.....",
    "..........",
  ],
  ghost: [
    "...kkkk...",
    "..kssssk..",
    ".kssssssk.",
    ".kskssksk.",
    ".kssssssk.",
    ".kssssssk.",
    ".kssssssk.",
    ".kssssssk.",
    ".ksksksk..",
    ".k.k.k.k..",
  ],
  fish: [
    "..........",
    "..........",
    "...kkkk.kk",
    "..kbbbbkbk",
    ".kbkbbbbbk",
    ".kbbbbbkbk",
    "..kddddkdk",
    "...kkkk.kk",
    "..........",
    "..........",
  ],
  coin: [
    "...kkkk...",
    "..kyyyyk..",
    ".kyyoyyyk.",
    ".kyyoyyyk.",
    ".kyyoyyyk.",
    ".kyyoyyyk.",
    ".kyyoyyyk.",
    "..kyyyyk..",
    "...kkkk...",
    "..........",
  ],
  key: [
    ".kkk......",
    "kgggk.....",
    "kg.gk.....",
    "kgggk.....",
    ".kgk......",
    ".kgk......",
    ".kggk.....",
    ".kgk......",
    ".kggk.....",
    ".kkk......",
  ],
  paw: [
    "..kk..kk..",
    ".kppkkppk.",
    ".kppkkppk.",
    "kk.kkkk.kk",
    "kpk....kpk",
    "kpkkkkkkpk",
    ".kkwwwwkk.",
    ".kwwppwwk.",
    ".kwwwwwwk.",
    "..kkkkkk..",
  ],
  bot: [
    "....kk....",
    "....kg....",
    ".kkkkkkkk.",
    "kwwwwwwwwk",
    "kwgkwwkgwk",
    "kwwwwwwwwk",
    "kwwkkkkwwk",
    "kwwwwwwwwk",
    ".kkkkkkkk.",
    "..k....k..",
  ],
  up: [
    "....k.....",
    "...kgk....",
    "..kgggk...",
    ".kgggggk..",
    "kkkgggkkk.",
    "..kgggk...",
    "..kgggk...",
    "..kkkkk...",
    "..........",
    "..........",
  ],
  down: [
    "..kkkkk...",
    "..krrrk...",
    "..krrrk...",
    "kkkrrrkkk.",
    ".krrrrrk..",
    "..krrrk...",
    "...krk....",
    "....k.....",
    "..........",
    "..........",
  ],
};

export type IconName = keyof typeof ICONS;

export function iconSvg(name: IconName): string {
  const rows = ICONS[name];
  let rects = "";
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === ".") {
        x++;
        continue;
      }
      let x1 = x + 1;
      while (x1 < row.length && row[x1] === ch) x1++;
      rects += `<rect x="${x}" y="${y}" width="${x1 - x}" height="1" fill="${PAL[ch]}"/>`;
      x = x1;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" shape-rendering="crispEdges">${rects}</svg>`;
}

/** Pixel paw cursor as a data URI. */
export const PAW_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 10 10" shape-rendering="crispEdges">${iconSvg("paw").replace(/^<svg[^>]*>|<\/svg>$/g, "")}</svg>`,
)}") 4 2, auto`;
