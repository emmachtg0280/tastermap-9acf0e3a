/**
 * Marker icon factory for the Tastemap map.
 *
 * Every generated SVG data-URI is memoized by its visual key, so panning,
 * zooming or flipping one restaurant's state never regenerates identical
 * assets. Restaurant markers keep the existing sticker visual language.
 */
import type { Cuisine } from "./places.shared";

export type MarkerState = "done" | "saved" | "new";

export interface MarkerVisual {
  url: string;
  size: number;
  height: number;
}

const iconCache = new Map<string, MarkerVisual>();
const clusterCache = new Map<string, MarkerVisual>();

/** Elegant, minimal personal location indicator with a very subtle pulse. */
export const USER_DOT_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 44 44'>
  <circle cx='22' cy='22' r='7' fill='none' stroke='#3B82F6' stroke-width='1.5' stroke-opacity='0.28'>
    <animate attributeName='r' values='7;16' dur='3.6s' repeatCount='indefinite'/>
    <animate attributeName='stroke-opacity' values='0.28;0' dur='3.6s' repeatCount='indefinite'/>
  </circle>
  <circle cx='22' cy='22' r='8' fill='#3B82F6' fill-opacity='0.12'/>
  <circle cx='22' cy='22' r='5.5' fill='#3B82F6' stroke='#ffffff' stroke-width='2.2'/>
</svg>`;

export interface MarkerIconInput {
  cuisine: Cuisine;
  state: MarkerState;
  active: boolean;
  isNew: boolean;
  dataUrl?: string;
  inner?: string;
}

export function markerIconKey(i: MarkerIconInput): string {
  return `${i.cuisine}|${i.state}|${i.active ? 1 : 0}|${i.isNew ? 1 : 0}|${i.dataUrl ? 1 : 0}`;
}

export function markerIcon(input: MarkerIconInput): MarkerVisual {
  const key = markerIconKey(input);
  const cached = iconCache.get(key);
  if (cached) return cached;

  const { state, active, isNew, dataUrl, inner } = input;
  // Keep density practical. Selection overrides the ring, never the saved/visited badge.
  const base = state === "done" ? 40 : state === "saved" ? 36 : 28;
  const size = active ? base + 6 : base;
  const iconOpacity = 1;
  const bg = state === "done" ? "#fff8d6" : state === "saved" ? "#f1fad9" : "#ffffff";
  const bgOpacity = 1;
  const ring = active
    ? { color: "#ff8642", width: 3.5 }
    : state === "done"
      ? { color: "#ffd426", width: 3 }
      : state === "saved"
        ? { color: "#a8eb12", width: 3 }
        : { color: "#85887d", width: 1.5 };

  const iconSize = size * (state === "new" ? 0.62 : 0.7);
  const iconOffset = (size - iconSize) / 2;
  const imageTag = dataUrl
    ? `<image href='${dataUrl}' x='${iconOffset}' y='${iconOffset}' width='${iconSize}' height='${iconSize}' opacity='${iconOpacity}' preserveAspectRatio='xMidYMid meet'/>`
    : `<g opacity='${iconOpacity}' transform='translate(${iconOffset} ${iconOffset}) scale(${iconSize / 24})'>${inner ?? ""}</g>`;

  const newBadge =
    isNew && state !== "new"
      ? `<g><circle cx='7' cy='8' r='6' fill='#ffd426'/><path d='M7 5.3 l0.8 1.6 l1.8 0.25 l-1.3 1.2 l0.35 1.8 l-1.65 -0.85 l-1.65 0.85 l0.35 -1.8 l-1.3 -1.2 l1.8 -0.25 z' fill='#1a1a1a' stroke-linejoin='round'/></g>`
      : "";

  const doneBadge =
    state === "done"
      ? `<circle cx='${size - 7}' cy='8' r='6.5' fill='#ffd426' stroke='#ffffff' stroke-width='1.8'/><path d='M${size - 9.8} 8 l2 2.2 L${size - 4.6} 5.8' stroke='#1a1a1a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' fill='none'/>`
      : "";
  const savedBadge =
    state === "saved"
      ? `<circle cx='${size - 7}' cy='8' r='6.5' fill='#a8eb12' stroke='#ffffff' stroke-width='1.8'/><path d='M${size - 7} 10.6 c-2.4 -1.6 -3.2 -2.7 -3.2 -3.8 a1.7 1.7 0 0 1 3.2 -0.7 a1.7 1.7 0 0 1 3.2 0.7 c0 1.1 -0.8 2.2 -3.2 3.8 z' fill='#1a1a1a'/>`
      : "";

  const scale = 2;
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='${size * scale}' height='${(size + 4) * scale}' viewBox='0 0 ${size} ${size + 4}'>
  ${active ? `<circle cx='${size / 2}' cy='${size / 2}' r='${size / 2 - 0.75}' fill='none' stroke='#9b3c00' stroke-width='1.5'/>` : ""}
  <circle cx='${size / 2}' cy='${size / 2}' r='${size / 2 - 2}' fill='${bg}' fill-opacity='${bgOpacity}' stroke='${ring.color}' stroke-width='${ring.width}'/>
  ${imageTag}
  ${newBadge}
  ${doneBadge}
  ${savedBadge}
</svg>`.trim();

  const visual: MarkerVisual = {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    size,
    height: size + 4,
  };
  iconCache.set(key, visual);
  return visual;
}

/** Cluster bubble: ring fills yellow in proportion to discovered restaurants. */
export function clusterIcon(count: number, discoveredRatio: number): MarkerVisual {
  const size = Math.min(56, 34 + Math.round(Math.log2(count + 1) * 7));
  // Quantize the ratio so near-identical clusters reuse the same asset.
  const step = Math.round(Math.max(0, Math.min(1, discoveredRatio)) * 10);
  const key = `${size}|${count}|${step}`;
  const cached = clusterCache.get(key);
  if (cached) return cached;

  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const filled = (step / 10) * c;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size * 2}' height='${size * 2}' viewBox='0 0 ${size} ${size}'>
  <circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='#ffffff' fill-opacity='0.94'/>
  <circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='none' stroke='#e3e5dd' stroke-width='2.5'/>
  <circle cx='${size / 2}' cy='${size / 2}' r='${r}' fill='none' stroke='#ffd426' stroke-width='2.5' stroke-linecap='round'
    stroke-dasharray='${filled} ${c}' transform='rotate(-90 ${size / 2} ${size / 2})'/>
  <text x='${size / 2}' y='${size / 2 + 4}' text-anchor='middle' font-family='Plus Jakarta Sans, system-ui, sans-serif' font-size='${size * 0.34}' font-weight='800' fill='#1a1a1a'>${count}</text>
</svg>`;
  const visual: MarkerVisual = {
    url: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    size,
    height: size,
  };
  clusterCache.set(key, visual);
  return visual;
}
