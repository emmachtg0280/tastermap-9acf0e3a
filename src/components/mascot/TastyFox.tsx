/**
 * TastyFox — the Tastemap brand character.
 *
 * ONE master illustration, rendered as a single <img>. No SVG face layers,
 * no per-component variations: the character can never look misaligned or
 * inconsistent between screens. A gentle idle float is the only animation.
 */
import foxAsset from "@/assets/tasty-fox.png.asset.json";

export function TastyFox({ size = 160 }: { size?: number }) {
  return (
    <img
      src={foxAsset.url}
      alt="Tasty, la mascotte Tastemap"
      width={size}
      height={size}
      draggable={false}
      className="select-none pointer-events-none animate-mascot-hop drop-shadow-[0_14px_16px_rgba(43,20,0,0.18)]"
      style={{ width: size, height: size }}
    />
  );
}

export default TastyFox;
