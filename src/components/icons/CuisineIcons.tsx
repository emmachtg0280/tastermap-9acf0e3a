/**
 * Sticker-style cuisine and UI icons (Duolingo / UberEats vibe).
 * Each icon exports:
 *   - a React component (for JSX rendering)
 *   - a raw inner-SVG string (INNER_*) suitable for embedding
 *     inside a Google Maps marker data-URL.
 *
 * Common design language: viewBox 24x24, chunky white stroke on
 * the outer silhouette, 2–3 flat colors, tiny highlight, soft
 * drop-shadow applied at the <svg> wrapper level.
 */

import type { CSSProperties, ReactElement, SVGProps } from "react";
import type { Cuisine } from "@/lib/places.shared";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const wrapper = (
  inner: string,
  size = 22,
  extra?: SVGProps<SVGSVGElement>,
  style?: CSSProperties,
) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    style={{
      filter: "drop-shadow(0 1.5px 0 rgba(43,43,43,0.9))",
      ...style,
    }}
    {...extra}
    dangerouslySetInnerHTML={{ __html: inner }}
  />
);

/* ─────────── Cuisine icons ─────────── */

// Pasta (italien) — bowl with noodles + tomato
export const INNER_PASTA = `
<ellipse cx='12' cy='16.5' rx='9' ry='4.5' fill='#F1E7D2' stroke='#2b2b2b' stroke-width='1.4'/>
<path d='M5 15 q7 -3 14 0' stroke='#F5B800' stroke-width='2' fill='none' stroke-linecap='round'/>
<path d='M6 13 q6 -3 12 0' stroke='#FFC94A' stroke-width='2' fill='none' stroke-linecap='round'/>
<circle cx='13' cy='13' r='1.8' fill='#E14B3B' stroke='#2b2b2b' stroke-width='1'/>
<path d='M12.5 11.3 q0.8 -1 1.6 0' stroke='#2E7D32' stroke-width='1' fill='none' stroke-linecap='round'/>`;
export const PastaIcon = (p: IconProps) => wrapper(INNER_PASTA, p.size, p);

// Baguette (français) — golden baguette
export const INNER_BAGUETTE = `
<rect x='3' y='9' width='18' height='7' rx='3.5' fill='#E8A94A' stroke='#2b2b2b' stroke-width='1.4' transform='rotate(-12 12 12)'/>
<g transform='rotate(-12 12 12)'>
  <path d='M7 11 l1.5 3 M11 10.5 l1.5 3 M15 11 l1.5 3' stroke='#2b2b2b' stroke-width='1.2' stroke-linecap='round'/>
</g>
<path d='M4 8 q3 -2 6 0' stroke='#F5C77A' stroke-width='1.2' fill='none' opacity='0.7'/>`;
export const BaguetteIcon = (p: IconProps) => wrapper(INNER_BAGUETTE, p.size, p);

// Dumpling (chinois)
export const INNER_DUMPLING = `
<path d='M4 15 q0 -7 8 -7 q8 0 8 7 z' fill='#F5E7C4' stroke='#2b2b2b' stroke-width='1.4'/>
<path d='M4 15 h16' stroke='#2b2b2b' stroke-width='1.4'/>
<path d='M7 12 q1.5 -2 3 0 M11 11.5 q1.5 -2 3 0 M15 12 q1.5 -2 3 0' stroke='#2b2b2b' stroke-width='1.1' fill='none' stroke-linecap='round'/>
<path d='M9 8 q3 -3 6 0' stroke='#E5D5A8' stroke-width='1.2' fill='none' opacity='0.7'/>`;
export const DumplingIcon = (p: IconProps) => wrapper(INNER_DUMPLING, p.size, p);

// Sushi (japonais) — nigiri
export const INNER_SUSHI = `
<rect x='3' y='11' width='18' height='7' rx='3' fill='#FFF6E6' stroke='#2b2b2b' stroke-width='1.4'/>
<rect x='3' y='8.5' width='18' height='4.5' rx='2.2' fill='#FF7A5C' stroke='#2b2b2b' stroke-width='1.4'/>
<path d='M6 10 q3 -1.5 6 0 q3 1.5 6 0' stroke='#ffffff' stroke-width='1' fill='none' opacity='0.7'/>
<rect x='10.5' y='7' width='3' height='14' fill='#2E3A2E' stroke='#2b2b2b' stroke-width='1.2'/>`;
export const SushiIcon = (p: IconProps) => wrapper(INNER_SUSHI, p.size, p);

// Curry (indien) — bowl with dot pattern
export const INNER_CURRY = `
<path d='M3 12 h18 v1 a9 5 0 0 1 -18 0 z' fill='#E8A54A' stroke='#2b2b2b' stroke-width='1.4' stroke-linejoin='round'/>
<ellipse cx='12' cy='12' rx='9' ry='2.2' fill='#D68A2A' stroke='#2b2b2b' stroke-width='1.4'/>
<circle cx='9' cy='12' r='0.9' fill='#5C3A15'/>
<circle cx='13' cy='11.6' r='0.9' fill='#5C3A15'/>
<circle cx='15.5' cy='12.2' r='0.7' fill='#5C3A15'/>
<path d='M9 9 q1 -2 2 0 M13 8.5 q1 -2 2 0' stroke='#ffffff' stroke-width='1' fill='none' opacity='0.7'/>`;
export const CurryIcon = (p: IconProps) => wrapper(INNER_CURRY, p.size, p);

// Taco (mexicain)
export const INNER_TACO = `
<path d='M3 17 q9 -14 18 0 z' fill='#F5C46B' stroke='#2b2b2b' stroke-width='1.4' stroke-linejoin='round'/>
<path d='M6 15 q6 -5 12 0' fill='#7BB661' stroke='#2b2b2b' stroke-width='1.2'/>
<circle cx='9' cy='14' r='1' fill='#E14B3B' stroke='#2b2b2b' stroke-width='0.9'/>
<circle cx='13' cy='13.4' r='1' fill='#FFE066' stroke='#2b2b2b' stroke-width='0.9'/>
<circle cx='16' cy='14' r='1' fill='#E14B3B' stroke='#2b2b2b' stroke-width='0.9'/>`;
export const TacoIcon = (p: IconProps) => wrapper(INNER_TACO, p.size, p);

// Chili (thaï) — red chili with leaf
export const INNER_CHILI = `
<path d='M6 20 q0 -12 12 -14 q-1 12 -12 14 z' fill='#E23B2E' stroke='#2b2b2b' stroke-width='1.4' stroke-linejoin='round'/>
<path d='M15 7 q3 -3 6 -1 q-2 4 -5 3' fill='#2E9E4E' stroke='#2b2b2b' stroke-width='1.3' stroke-linejoin='round'/>
<path d='M9 15 q3 -2 6 -5' stroke='#ffffff' stroke-width='1' fill='none' opacity='0.6'/>`;
export const ChiliIcon = (p: IconProps) => wrapper(INNER_CHILI, p.size, p);

// Paella (espagnol) — pan with rice & shrimp
export const INNER_PAELLA = `
<circle cx='12' cy='13' r='8.5' fill='#F5D77A' stroke='#2b2b2b' stroke-width='1.4'/>
<rect x='19' y='12' width='4' height='2' rx='1' fill='#2b2b2b'/>
<path d='M8 11 q4 -3 8 2' stroke='#FF7A5C' stroke-width='2' fill='none' stroke-linecap='round'/>
<circle cx='9' cy='14' r='0.9' fill='#E14B3B'/>
<circle cx='14' cy='15' r='0.9' fill='#E14B3B'/>
<circle cx='11.5' cy='16' r='0.7' fill='#2E7D32'/>`;
export const PaellaIcon = (p: IconProps) => wrapper(INNER_PAELLA, p.size, p);

// Olive (grec)
export const INNER_OLIVE = `
<ellipse cx='12' cy='14' rx='7' ry='6' fill='#7A9F3F' stroke='#2b2b2b' stroke-width='1.4'/>
<ellipse cx='10' cy='12' rx='2' ry='1.4' fill='#B8D67A' opacity='0.7'/>
<path d='M12 8 q3 -4 8 -3 q-1 5 -6 5' fill='#2E9E4E' stroke='#2b2b2b' stroke-width='1.3' stroke-linejoin='round'/>
<circle cx='12' cy='16' r='1.4' fill='#E14B3B' stroke='#2b2b2b' stroke-width='1'/>`;
export const OliveIcon = (p: IconProps) => wrapper(INNER_OLIVE, p.size, p);

// Burger (américain)
export const INNER_BURGER = `
<path d='M3 10 q9 -8 18 0 z' fill='#E8A94A' stroke='#2b2b2b' stroke-width='1.4' stroke-linejoin='round'/>
<circle cx='9' cy='7.5' r='0.5' fill='#ffffff'/>
<circle cx='13' cy='6.8' r='0.5' fill='#ffffff'/>
<rect x='3' y='10' width='18' height='2.2' fill='#7BB661' stroke='#2b2b2b' stroke-width='1.2'/>
<rect x='3' y='12' width='18' height='2.4' fill='#6B3A1E' stroke='#2b2b2b' stroke-width='1.2'/>
<path d='M3 15 q9 4 18 0 v1 q-9 4 -18 0 z' fill='#E8A94A' stroke='#2b2b2b' stroke-width='1.4' stroke-linejoin='round'/>`;
export const BurgerIcon = (p: IconProps) => wrapper(INNER_BURGER, p.size, p);

// Salad (végé)
export const INNER_SALAD = `
<path d='M3 12 h18 v1 a9 5 0 0 1 -18 0 z' fill='#F1E7D2' stroke='#2b2b2b' stroke-width='1.4' stroke-linejoin='round'/>
<ellipse cx='12' cy='12' rx='9' ry='2.2' fill='#7BB661' stroke='#2b2b2b' stroke-width='1.4'/>
<circle cx='9' cy='11' r='1.4' fill='#E14B3B' stroke='#2b2b2b' stroke-width='1'/>
<circle cx='14' cy='11' r='1.2' fill='#FFE066' stroke='#2b2b2b' stroke-width='1'/>
<path d='M11 10 q1 -3 3 -1' stroke='#2E7D32' stroke-width='1.2' fill='none' stroke-linecap='round'/>`;
export const SaladIcon = (p: IconProps) => wrapper(INNER_SALAD, p.size, p);

// Fallback plate — "Tous"
export const INNER_PLATE = `
<circle cx='12' cy='12' r='9' fill='#ffffff' stroke='#2b2b2b' stroke-width='1.4'/>
<circle cx='12' cy='12' r='5.5' fill='#F5E7C4' stroke='#2b2b2b' stroke-width='1.2'/>
<path d='M9.5 11 q2.5 -2 5 0' stroke='#E8A94A' stroke-width='1.2' fill='none' stroke-linecap='round'/>`;
export const PlateIcon = (p: IconProps) => wrapper(INNER_PLATE, p.size, p);

/* ─────────── Discovery / state icons ─────────── */

export const INNER_SPARKLE = `
<path d='M12 3 l1.8 5.6 L19.5 10 l-5.7 1.7 L12 17 l-1.8 -5.3 L4.5 10 l5.7 -1.4 z' fill='#FFC94A' stroke='#2b2b2b' stroke-width='1.4' stroke-linejoin='round'/>
<circle cx='19' cy='5' r='1.3' fill='#FFE066' stroke='#2b2b2b' stroke-width='1'/>
<circle cx='5' cy='18' r='1' fill='#FFE066' stroke='#2b2b2b' stroke-width='1'/>`;
export const SparkleIcon = (p: IconProps) => wrapper(INNER_SPARKLE, p.size, p);

export const INNER_FLAME = `
<path d='M12 3 q4 4 4 8 q0 3 -2 4 q1 -3 -1 -5 q-1 4 -3 3 q-2 -1 -2 -4 q0 -4 4 -6 z' fill='#E14B3B' stroke='#2b2b2b' stroke-width='1.4' stroke-linejoin='round'/>
<path d='M12 20 q-5 0 -6 -4 q0 -3 3 -5 q0 4 2 5 q2 -1 2 -3 q3 2 3 5 q-1 4 -4 4 z' fill='#FF7A2E' stroke='#2b2b2b' stroke-width='1.4' stroke-linejoin='round'/>
<path d='M11 17 q1 -2 2 0' stroke='#FFE066' stroke-width='1' fill='none'/>`;
export const FlameIcon = (p: IconProps) => wrapper(INNER_FLAME, p.size, p);

/* ─────────── Mapping ─────────── */

import frenchAsset from "@/assets/cuisines/french.png.asset.json";
import italianAsset from "@/assets/cuisines/italian.png.asset.json";
import chineseAsset from "@/assets/cuisines/chinese.png.asset.json";
import japaneseAsset from "@/assets/cuisines/japanese.png.asset.json";
import indianAsset from "@/assets/cuisines/indian.png.asset.json";
import mexicanAsset from "@/assets/cuisines/mexican.png.asset.json";
import thaiAsset from "@/assets/cuisines/thai.png.asset.json";
import spanishAsset from "@/assets/cuisines/spanish.png.asset.json";
import greekAsset from "@/assets/cuisines/greek.png.asset.json";
import americanAsset from "@/assets/cuisines/american.png.asset.json";
import vegetarianAsset from "@/assets/cuisines/vegetarian.png.asset.json";
import anyAsset from "@/assets/cuisines/any.png.asset.json";
import { useEffect, useState } from "react";

export const CUISINE_META: Record<
  Cuisine,
  { label: string; Icon: (p: IconProps) => ReactElement; inner: string; image: string }
> = {
  any:        { label: "Tous",        Icon: PlateIcon,    inner: INNER_PLATE,    image: anyAsset.url        },
  french:     { label: "Français",    Icon: BaguetteIcon, inner: INNER_BAGUETTE, image: frenchAsset.url     },
  italian:    { label: "Italien",     Icon: PastaIcon,    inner: INNER_PASTA,    image: italianAsset.url    },
  chinese:    { label: "Chinois",     Icon: DumplingIcon, inner: INNER_DUMPLING, image: chineseAsset.url    },
  japanese:   { label: "Japonais",    Icon: SushiIcon,    inner: INNER_SUSHI,    image: japaneseAsset.url   },
  indian:     { label: "Indien",      Icon: CurryIcon,    inner: INNER_CURRY,    image: indianAsset.url     },
  mexican:    { label: "Mexicain",    Icon: TacoIcon,     inner: INNER_TACO,     image: mexicanAsset.url    },
  thai:       { label: "Thaï",        Icon: ChiliIcon,    inner: INNER_CHILI,    image: thaiAsset.url       },
  spanish:    { label: "Espagnol",    Icon: PaellaIcon,   inner: INNER_PAELLA,   image: spanishAsset.url    },
  greek:      { label: "Grec",        Icon: OliveIcon,    inner: INNER_OLIVE,    image: greekAsset.url      },
  american:   { label: "Américain",   Icon: BurgerIcon,   inner: INNER_BURGER,   image: americanAsset.url   },
  vegetarian: { label: "Végétarien",  Icon: SaladIcon,    inner: INNER_SALAD,    image: vegetarianAsset.url },
};

const PRIORITY: Cuisine[] = [
  "italian", "japanese", "french", "chinese", "indian",
  "mexican", "thai", "spanish", "greek", "american", "vegetarian",
];

export function pickCuisine(cs: Cuisine[]): Cuisine {
  for (const p of PRIORITY) if (cs.includes(p)) return p;
  return "any";
}

/** PNG-based appetizing cuisine icon (sticker illustration). */
export function CuisineIcon({
  cuisines,
  size = 32,
  className = "",
  shadow = false,
}: {
  cuisines: Cuisine[];
  size?: number;
  className?: string;
  shadow?: boolean;
}) {
  const c = pickCuisine(cuisines);
  return (
    <img
      src={CUISINE_META[c].image}
      alt={CUISINE_META[c].label}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      className={`object-contain select-none pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        ...(shadow ? { filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.18))" } : {}),
      }}
    />
  );
}

/** Raw inner SVG (legacy fallback). */
export function cuisineInnerSvg(cuisines: Cuisine[]): string {
  return CUISINE_META[pickCuisine(cuisines)].inner;
}

/** Fetch a cuisine PNG once and return it as a base64 data URL,
 *  needed for embedding inside a Google Maps marker SVG data-URL
 *  (external URL refs are blocked in browser-rendered SVG images). */
const dataUrlCache = new Map<Cuisine, string>();
export async function loadCuisineDataUrl(c: Cuisine): Promise<string> {
  const cached = dataUrlCache.get(c);
  if (cached) return cached;
  const res = await fetch(CUISINE_META[c].image);
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  dataUrlCache.set(c, dataUrl);
  return dataUrl;
}

/** Preload every cuisine PNG as a base64 data URL. Returns null until ready. */
export function useCuisineDataUrls(): Record<Cuisine, string> | null {
  const [urls, setUrls] = useState<Record<Cuisine, string> | null>(null);
  useEffect(() => {
    let cancelled = false;
    const keys = Object.keys(CUISINE_META) as Cuisine[];
    Promise.all(keys.map(async (c) => [c, await loadCuisineDataUrl(c)] as const))
      .then((entries) => {
        if (!cancelled) setUrls(Object.fromEntries(entries) as Record<Cuisine, string>);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return urls;
}

