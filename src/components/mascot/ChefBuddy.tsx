/**
 * ChefBuddy — Duolingo-inspired sticker mascot.
 * An orange fox chef with living eyes that track the pointer,
 * a soft hop, gentle blink, and a wagging tail.
 */

import { useEffect, useRef, useState } from "react";

const EYE_LEFT = { cx: 78, cy: 88 };
const EYE_RIGHT = { cx: 122, cy: 88 };
const PUPIL_RADIUS = 4; // how far the pupil can travel from center

export function ChefBuddy() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const compute = (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.42; // roughly eye height
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      // Ease the pull so far-away pointers still just barely tilt the pupils.
      const pull = Math.min(1, dist / 260);
      targetX = (dx / dist) * pull;
      targetY = (dy / dist) * pull;
    };

    const onMove = (e: PointerEvent) => compute(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) compute(t.clientX, t.clientY);
    };

    // Idle wander — if no pointer, gently look around.
    let idleT = 0;
    const tick = () => {
      idleT += 0.016;
      const idleX = Math.sin(idleT * 0.7) * 0.35;
      const idleY = Math.sin(idleT * 0.5 + 1.2) * 0.25;
      const tx = targetX || idleX;
      const ty = targetY || idleY;
      currentX += (tx - currentX) * 0.15;
      currentY += (ty - currentY) * 0.15;
      setGaze({ x: currentX, y: currentY });
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

  const px = gaze.x * PUPIL_RADIUS;
  const py = gaze.y * PUPIL_RADIUS;

  return (
    <svg
      ref={svgRef}
      width="200"
      height="210"
      viewBox="0 0 200 220"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_14px_18px_rgba(43,20,0,0.28)]"
    >
      {/* soft ground shadow */}
      <ellipse cx="100" cy="206" rx="52" ry="6" fill="rgba(0,0,0,0.18)" />

      {/* feet */}
      <ellipse cx="80" cy="198" rx="15" ry="7" fill="#B84200" />
      <ellipse cx="120" cy="198" rx="15" ry="7" fill="#B84200" />

      {/* tail */}
      <g
        className="animate-mascot-wing"
        style={{ transformOrigin: "168px 148px" }}
      >
        <path
          d="M162 132 q30 -4 26 28 q-2 20 -26 16 q-16 -4 -14 -22 z"
          fill="#FF7A1A"
        />
        <path
          d="M178 152 q10 6 4 22"
          stroke="#FFF1DC"
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* body */}
      <ellipse cx="100" cy="140" rx="66" ry="58" fill="#FF7A1A" />
      {/* body shading */}
      <ellipse cx="128" cy="150" rx="30" ry="42" fill="#E8620A" opacity="0.55" />
      {/* belly */}
      <ellipse cx="100" cy="158" rx="40" ry="28" fill="#FFF1DC" />

      {/* arms */}
      <ellipse cx="40" cy="138" rx="15" ry="20" fill="#FF7A1A" />
      <ellipse cx="35" cy="146" rx="7" ry="9" fill="#E8620A" opacity="0.6" />
      <ellipse cx="160" cy="138" rx="15" ry="20" fill="#FF7A1A" />
      <ellipse cx="165" cy="146" rx="7" ry="9" fill="#E8620A" opacity="0.6" />

      {/* head */}
      <ellipse cx="100" cy="92" rx="54" ry="48" fill="#FF7A1A" />
      <ellipse cx="126" cy="100" rx="22" ry="34" fill="#E8620A" opacity="0.45" />

      {/* ears */}
      <path
        d="M58 60 q-8 -26 12 -34 q10 14 6 34 z"
        fill="#FF7A1A"
      />
      <path d="M62 50 q0 -12 10 -16 q4 10 2 20 z" fill="#FFC8A0" />
      <path
        d="M142 60 q8 -26 -12 -34 q-10 14 -6 34 z"
        fill="#FF7A1A"
      />
      <path d="M138 50 q0 -12 -10 -16 q-4 10 -2 20 z" fill="#FFC8A0" />

      {/* face highlight */}
      <ellipse cx="82" cy="82" rx="22" ry="18" fill="#FFA65A" opacity="0.55" />

      {/* muzzle */}
      <ellipse cx="100" cy="110" rx="28" ry="20" fill="#FFF1DC" />

      {/* cheeks */}
      <ellipse cx="64" cy="106" rx="10" ry="7" fill="#FF9BB3" opacity="0.75" />
      <ellipse cx="136" cy="106" rx="10" ry="7" fill="#FF9BB3" opacity="0.75" />

      {/* eyes — white sockets + tracking pupils */}
      <g>
        <ellipse cx={EYE_LEFT.cx} cy={EYE_LEFT.cy} rx="11" ry="13" fill="#ffffff" />
        <ellipse cx={EYE_RIGHT.cx} cy={EYE_RIGHT.cy} rx="11" ry="13" fill="#ffffff" />

        {/* pupil groups translate with gaze; blink scales them vertically */}
        <g className="animate-mascot-blink" style={{ transformOrigin: `${EYE_LEFT.cx}px ${EYE_LEFT.cy}px`, transformBox: "fill-box" as const }}>
          <g transform={`translate(${px} ${py})`}>
            <ellipse cx={EYE_LEFT.cx} cy={EYE_LEFT.cy} rx="6.5" ry="8.5" fill="#2b2b2b" />
            <circle cx={EYE_LEFT.cx + 2} cy={EYE_LEFT.cy - 3} r="2.4" fill="#ffffff" />
            <circle cx={EYE_LEFT.cx - 2.5} cy={EYE_LEFT.cy + 3} r="1.2" fill="#ffffff" />
          </g>
        </g>
        <g className="animate-mascot-blink" style={{ transformOrigin: `${EYE_RIGHT.cx}px ${EYE_RIGHT.cy}px`, transformBox: "fill-box" as const }}>
          <g transform={`translate(${px} ${py})`}>
            <ellipse cx={EYE_RIGHT.cx} cy={EYE_RIGHT.cy} rx="6.5" ry="8.5" fill="#2b2b2b" />
            <circle cx={EYE_RIGHT.cx + 2} cy={EYE_RIGHT.cy - 3} r="2.4" fill="#ffffff" />
            <circle cx={EYE_RIGHT.cx - 2.5} cy={EYE_RIGHT.cy + 3} r="1.2" fill="#ffffff" />
          </g>
        </g>
      </g>

      {/* eyebrows for expression */}
      <path d="M68 66 q10 -6 20 0" stroke="#2b2b2b" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M112 66 q10 -6 20 0" stroke="#2b2b2b" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* nose */}
      <ellipse cx="100" cy="104" rx="6" ry="4.5" fill="#2b2b2b" />
      <ellipse cx="98" cy="102.5" rx="2" ry="1.2" fill="#ffffff" opacity="0.7" />

      {/* permanent smile line — so the mouth never disappears */}
      <path
        d="M88 116 q12 10 24 0"
        stroke="#2b2b2b"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* animated open mouth on top — scales vertically as if talking */}
      <g
        className="animate-mascot-mouth"
        style={{ transformOrigin: "100px 118px", transformBox: "fill-box" as const }}
      >
        <ellipse cx="100" cy="119" rx="11" ry="7" fill="#2b2b2b" />
        <ellipse cx="100" cy="122" rx="7" ry="4" fill="#FF6F91" />
        <rect x="96" y="114" width="8" height="2.5" rx="1" fill="#ffffff" />
      </g>

      {/* chef toque */}
      <ellipse cx="100" cy="38" rx="34" ry="20" fill="#ffffff" />
      <circle cx="78" cy="30" r="16" fill="#ffffff" />
      <circle cx="122" cy="30" r="16" fill="#ffffff" />
      <circle cx="100" cy="20" r="17" fill="#ffffff" />
      <ellipse cx="90" cy="18" rx="6" ry="4" fill="#f5f0e6" opacity="0.7" />
      {/* toque band */}
      <rect x="68" y="52" width="64" height="12" rx="5" fill="#F0E9D8" />
      <rect x="68" y="52" width="64" height="4" rx="2" fill="#ffffff" opacity="0.7" />
    </svg>
  );
}
