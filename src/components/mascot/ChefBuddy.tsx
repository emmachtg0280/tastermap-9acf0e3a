/**
 * ChefBuddy — illustrated chibi fox mascot matching the reference art.
 * Uses a hand-illustrated PNG for the true sticker look, with gentle
 * body-level animations (breathing, subtle hop, drop shadow) so it feels
 * alive without the stiff SVG-vector aesthetic.
 */

import foxUrl from "@/assets/mascot-fox.png";

export function ChefBuddy() {
  return (
    <div className="relative select-none pointer-events-none">
      <img
        src={foxUrl}
        alt="Renard mascotte"
        width={188}
        height={188}
        draggable={false}
        className="animate-mascot-hop drop-shadow-[0_16px_18px_rgba(43,20,0,0.25)]"
        style={{ willChange: "transform" }}
      />
    </div>
  );
}
