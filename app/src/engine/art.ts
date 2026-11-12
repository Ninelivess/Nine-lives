// Every cat's portrait is generated from its on-chain state, so the NFT image changes as the
// cat lives: plump when fed, thin and sweating when hungry, a ghost when it dies.

export interface ArtInput {
  id: number;
  personality: string;
  alive: boolean;
  fish: number;
  hunger: number;
}

const FUR: Record<string, [string, string]> = {
  shark: ["#5b6b82", "#3f4b5e"],
  hoarder: ["#e0a458", "#b9813d"],
  bluffer: ["#6d6875", "#4a4650"],
  gambler: ["#2f2f3a", "#1c1c24"],
  saint: ["#f4efe6", "#d9cfbf"],
  follower: ["#f6f1ea", "#dcd2c4"],
  panicker: ["#e98a5b", "#c5683d"],
  monopolist: ["#c9a227", "#9c7c17"],
  lazy: ["#9a8c98", "#776a76"],
};

const EYES: Record<string, string> = {
  shark: "#7fd1b9",
  hoarder: "#5aa9e6",
  bluffer: "#f7b801",
  gambler: "#ffd23f",
  saint: "#8ecae6",
  follower: "#90be6d",
  panicker: "#f94144",
  monopolist: "#43aa8b",
  lazy: "#b388eb",
};

function accessory(p: string): string {
  switch (p) {
    case "shark": // sunglasses
      return `<g><rect x="70" y="92" width="26" height="14" rx="5" fill="#111"/><rect x="104" y="92" width="26" height="14" rx="5" fill="#111"/><rect x="95" y="96" width="10" height="3" fill="#111"/></g>`;
    case "hoarder": // a stash of fish
      return `<g transform="translate(140 168)"><ellipse cx="0" cy="0" rx="16" ry="7" fill="#7fb7d6"/><path d="M14 0 l9 -6 v12z" fill="#7fb7d6"/><ellipse cx="-4" cy="-9" rx="14" ry="6" fill="#9ccbe3"/><path d="M8 -9 l8 -5 v10z" fill="#9ccbe3"/></g>`;
    case "bluffer": // top hat
      return `<g><rect x="70" y="58" width="60" height="8" rx="3" fill="#1b1b1b"/><rect x="81" y="26" width="38" height="34" rx="3" fill="#1b1b1b"/><rect x="81" y="50" width="38" height="6" fill="#c1121f"/></g>`;
    case "gambler": // dice
      return `<g transform="translate(138 160) rotate(12)"><rect width="22" height="22" rx="4" fill="#fff" stroke="#222" stroke-width="2"/><circle cx="6" cy="6" r="2.4" fill="#222"/><circle cx="16" cy="16" r="2.4" fill="#222"/><circle cx="11" cy="11" r="2.4" fill="#222"/></g>`;
    case "saint": // heart scarf
      return `<g><path d="M66 132 q34 18 68 0 v10 q-34 18 -68 0z" fill="#e5383b"/><path d="M100 150 c-6 -8 -16 -2 -10 6 l10 9 l10 -9 c6 -8 -4 -14 -10 -6z" fill="#fff" opacity=".9"/></g>`;
    case "follower": // little flag
      return `<g><rect x="146" y="120" width="3" height="48" fill="#6c584c"/><path d="M149 120 h22 l-6 7 l6 7 h-22z" fill="#90be6d"/></g>`;
    case "panicker": // sweat drops
      return `<g fill="#8ecae6"><path d="M142 70 q6 10 0 14 q-6 -4 0 -14z"/><path d="M58 76 q5 8 0 11 q-5 -3 0 -11z"/></g>`;
    case "monopolist": // crown
      return `<g><path d="M74 46 l8 -22 l12 14 l6 -18 l6 18 l12 -14 l8 22z" fill="#ffd23f" stroke="#c9a227" stroke-width="2"/><circle cx="100" cy="24" r="3" fill="#e63946"/></g>`;
    case "lazy": // sleeping cap
      return `<g><path d="M58 82 C62 56 96 40 132 58 C146 50 154 44 160 34 C162 52 152 66 142 78 Z" fill="#4361ee"/><path d="M58 82 C80 70 120 68 142 78 L140 86 C118 76 82 78 60 90Z" fill="#f1f1f1"/><circle cx="160" cy="34" r="7" fill="#fff"/></g>`;
    default:
      return "";
  }
}

export function catSvg(c: ArtInput, size = 200): string {
  const ghost = !c.alive;
  const [fur, shade] = ghost ? ["#e8f1ff", "#c7d7f2"] : FUR[c.personality] ?? ["#999", "#777"];
  const eye = ghost ? "#9fb6dd" : EYES[c.personality] ?? "#7fd1b9";
  const hungry = c.alive && c.hunger > 0;
  const fat = c.alive && c.fish >= 5;
  const bodyRx = hungry ? 34 : fat ? 50 : 42;
  const opacity = ghost ? 0.78 : 1;
  const eyes = ghost
    ? `<path d="M76 98 l10 10 M86 98 l-10 10 M114 98 l10 10 M124 98 l-10 10" stroke="#7d93bd" stroke-width="4" stroke-linecap="round"/>`
    : hungry
      ? `<ellipse cx="84" cy="100" rx="7" ry="9" fill="${eye}"/><ellipse cx="116" cy="100" rx="7" ry="9" fill="${eye}"/><circle cx="84" cy="102" r="3" fill="#111"/><circle cx="116" cy="102" r="3" fill="#111"/>`
      : `<ellipse cx="84" cy="100" rx="8" ry="10" fill="${eye}"/><ellipse cx="116" cy="100" rx="8" ry="10" fill="${eye}"/><ellipse cx="84" cy="101" rx="2.6" ry="7" fill="#111"/><ellipse cx="116" cy="101" rx="2.6" ry="7" fill="#111"/>`;
  const mouth = hungry
    ? `<ellipse cx="100" cy="124" rx="6" ry="5" fill="#5a2a2a"/>`
    : ghost
      ? `<path d="M92 124 q8 -6 16 0" stroke="#7d93bd" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<path d="M92 120 q8 8 16 0" stroke="#3a2a2a" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const bottom = ghost
    ? `<path d="M${100 - bodyRx} 160 q0 40 10 40 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 q8 -10 16 0 q10 0 10 -40z" fill="${fur}"/>`
    : `<ellipse cx="100" cy="188" rx="${bodyRx - 6}" ry="8" fill="${shade}"/>`;
  const halo = ghost ? `<ellipse cx="100" cy="30" rx="30" ry="8" fill="none" stroke="#ffd23f" stroke-width="5"/>` : "";
  const tail = ghost ? "" : `<path d="M${100 + bodyRx - 6} 172 q40 -10 30 -60 q-2 -10 6 -10" stroke="${shade}" stroke-width="12" fill="none" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 210" width="${size}" height="${(size * 210) / 200}" role="img" aria-label="cat #${c.id}">
<g opacity="${opacity}">
${tail}
<ellipse cx="100" cy="158" rx="${bodyRx}" ry="38" fill="${fur}" stroke="rgba(255,255,255,.14)" stroke-width="2"/>
${bottom}
<path d="M58 84 L62 40 L88 66 Z" fill="${fur}"/><path d="M142 84 L138 40 L112 66 Z" fill="${fur}"/>
<path d="M64 74 L66 50 L82 66 Z" fill="${shade}"/><path d="M136 74 L134 50 L118 66 Z" fill="${shade}"/>
<ellipse cx="100" cy="104" rx="48" ry="42" fill="${fur}" stroke="rgba(255,255,255,.14)" stroke-width="2"/>
${eyes}
<path d="M96 112 l4 4 l4 -4z" fill="#e5989b"/>
${mouth}
<path d="M58 112 h-22 M58 118 h-20 M142 112 h22 M142 118 h20" stroke="${ghost ? "#9fb6dd" : "#2b2b2b"}" stroke-width="1.5" opacity=".5"/>
${ghost ? "" : accessory(c.personality)}
${halo}
</g>
</svg>`;
}
