/**
 * ChefBuddy — illustrated chibi fox mascot with live pupils and mouth.
 * The base is a hand-drawn PNG. Two SVG overlays sit on top, aligned to
 * the illustration's eyes and mouth, so we get real pupil-tracking and a
 * mouth that opens while she talks — without losing the hand-drawn look.
 */

import { useEffect, useRef, useState } from "react";
import foxUrl from "@/assets/mascot-fox.png";

// Coordinates are in the original 1024×1024 PNG space.
const EYE_L = { cx: 383, cy: 484, rx: 60, ry: 58 };
const EYE_R = { cx: 620, cy: 484, rx: 60, ry: 58 };
const MOUTH = { cx: 502, cy: 572 };
const PUPIL_TRAVEL = 14; // px in image space

export function ChefBuddy() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let raf = 0;
    let tx = 0, ty = 0, cx = 0, cy = 0;

    const compute = (clientX: number, clientY: number) => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height * 0.45;
      const dx = clientX - ex;
      const dy = clientY - ey;
      const d = Math.hypot(dx, dy) || 1;
      const pull = Math.min(1, d / 240);
      tx = (dx / d) * pull;
      ty = (dy / d) * pull;
    };
    const onMove = (e: PointerEvent) => compute(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) compute(t.clientX, t.clientY);
    };

    let idle = 0;
    const tick = () => {
      idle += 0.016;
      const ix = Math.sin(idle * 0.7) * 0.35;
      const iy = Math.sin(idle * 0.5 + 1.1) * 0.25;
      const gx = tx || ix;
      const gy = ty || iy;
      cx += (gx - cx) * 0.15;
      cy += (gy - cy) * 0.15;
      setGaze({ x: cx, y: cy });
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchmove", onTouch);
      cancelAnimationFrame(raf);
    };
  }, []);

  const px = gaze.x * PUPIL_TRAVEL;
  const py = gaze.y * PUPIL_TRAVEL;

  return (
    <div
      ref={wrapRef}
      className="relative select-none animate-mascot-hop drop-shadow-[0_16px_18px_rgba(43,20,0,0.25)]"
      style={{ width: 188, height: 188, willChange: "transform" }}
    >
      <img
        src={foxUrl}
        alt="Renard mascotte"
        width={188}
        height={188}
        draggable={false}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      <svg
        viewBox="0 0 1024 1024"
        className="absolute inset-0 w-full h-full pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Repaint each eye as a fresh black pupil so we can move its
            highlights convincingly (the illusion of a rolling pupil). */}
        {[EYE_L, EYE_R].map((e, i) => (
          <g
            key={i}
            className="animate-mascot-blink"
            style={{ transformOrigin: `${e.cx}px ${e.cy}px`, transformBox: "fill-box" as const }}
          >
            <ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="#1A0D05" />
            <g transform={`translate(${px} ${py})`}>
              {/* big top highlight */}
              <circle cx={e.cx + 14} cy={e.cy - 20} r={17} fill="#ffffff" />
              {/* small bottom highlight */}
              <circle cx={e.cx - 18} cy={e.cy + 22} r={9} fill="#ffffff" />
            </g>
          </g>
        ))}

        {/* Mouth: a small dark opening that pulses to look like talking.
            Sits just under the tip of the muzzle so it merges with the
            existing smile line. */}
        <g
          className="animate-mascot-mouth"
          style={{ transformOrigin: `${MOUTH.cx}px ${MOUTH.cy}px`, transformBox: "fill-box" as const }}
        >
          <ellipse cx={MOUTH.cx} cy={MOUTH.cy} rx={22} ry={11} fill="#3a1409" />
          <ellipse cx={MOUTH.cx} cy={MOUTH.cy + 2} rx={15} ry={6} fill="#FF7A98" />
          <rect x={MOUTH.cx - 5} y={MOUTH.cy - 9} width={10} height={5} rx={1.5} fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
}
