/**
 * ChefBuddy — chibi fox mascot inspired by soft sticker illustrations.
 * Thick dark outlines, big round expressive eyes with living pupils that
 * track the pointer, pink blush cheeks, cream muzzle & belly, and a small
 * animated mouth so she feels like she's really talking.
 */

import { useEffect, useRef, useState } from "react";

const EYE_LEFT = { cx: 82, cy: 96 };
const EYE_RIGHT = { cx: 128, cy: 96 };
const PUPIL_RADIUS = 3.5;

const STROKE = "#2a1508";
const STROKE_W = 3.2;

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
      const cy = rect.top + rect.height * 0.42;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = Math.min(1, dist / 260);
      targetX = (dx / dist) * pull;
      targetY = (dy / dist) * pull;
    };

    const onMove = (e: PointerEvent) => compute(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) compute(t.clientX, t.clientY);
    };

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
      width="168"
      height="180"
      viewBox="0 0 210 220"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_14px_18px_rgba(43,20,0,0.25)]"
    >
      <defs>
        <clipPath id="mouthClip2">
          <path d="M92 122 q13 12 26 0 q-3 11 -13 11 q-10 0 -13 -11 z" />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx="105" cy="208" rx="52" ry="6" fill="rgba(0,0,0,0.16)" />

      {/* ---- BODY ---- */}
      {/* back paws */}
      <g>
        <ellipse cx="78" cy="196" rx="16" ry="10"
          fill="#6B3A1E" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
        <ellipse cx="132" cy="196" rx="16" ry="10"
          fill="#6B3A1E" stroke={STROKE} strokeWidth={STROKE_W} strokeLinejoin="round" />
      </g>

      {/* torso — chibi sitting shape */}
      <path
        d="M60 148
           q-4 -30 20 -42
           q25 -8 50 0
           q24 12 20 42
           q-2 32 -20 40
           q-25 6 -50 0
           q-18 -8 -20 -40 z"
        fill="#F58A2E"
        stroke={STROKE}
        strokeWidth={STROKE_W}
        strokeLinejoin="round"
      />

      {/* cream belly */}
      <path
        d="M78 152
           q-2 -22 12 -30
           q15 -6 30 0
           q14 8 12 30
           q-4 22 -14 26
           q-13 4 -26 0
           q-10 -4 -14 -26 z"
        fill="#FFF2DC"
        stroke={STROKE}
        strokeWidth={STROKE_W}
        strokeLinejoin="round"
        opacity="0.98"
      />
      {/* belly fur hint */}
      <path d="M100 168 v14" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" opacity="0.4" />
      <path d="M94 172 v8" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" opacity="0.35" />
      <path d="M106 172 v8" stroke={STROKE} strokeWidth="1.6" strokeLinecap="round" opacity="0.35" />

      {/* ---- HEAD ---- */}
      {/* ears — outer orange, inner cream + dark tips */}
      <g>
        {/* left ear */}
        <path
          d="M52 78 q-14 -46 24 -52 q10 24 8 46 z"
          fill="#F58A2E"
          stroke={STROKE}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
        <path
          d="M60 66 q-6 -26 16 -32 q6 16 6 30 z"
          fill="#FFE2C0"
        />
        {/* dark ear tip */}
        <path d="M56 46 q6 -18 20 -20 q-4 12 -12 22 z" fill="#5A3B1D" />
        {/* right ear */}
        <path
          d="M158 78 q14 -46 -24 -52 q-10 24 -8 46 z"
          fill="#F58A2E"
          stroke={STROKE}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
        <path
          d="M150 66 q6 -26 -16 -32 q-6 16 -6 30 z"
          fill="#FFE2C0"
        />
        <path d="M154 46 q-6 -18 -20 -20 q4 12 12 22 z" fill="#5A3B1D" />
      </g>

      {/* head shape — round chibi with side cheek fluff */}
      <path
        d="M105 50
           q-46 0 -58 40
           q-6 26 6 46
           q22 22 52 22
           q30 0 52 -22
           q12 -20 6 -46
           q-12 -40 -58 -40 z"
        fill="#F58A2E"
        stroke={STROKE}
        strokeWidth={STROKE_W}
        strokeLinejoin="round"
      />

      {/* cream muzzle / cheeks — big soft mask */}
      <path
        d="M60 110
           q6 -14 22 -14
           q10 -4 23 -4
           q13 0 23 4
           q16 0 22 14
           q4 20 -14 34
           q-14 10 -31 10
           q-17 0 -31 -10
           q-18 -14 -14 -34 z"
        fill="#FFF2DC"
        stroke={STROKE}
        strokeWidth={STROKE_W}
        strokeLinejoin="round"
      />

      {/* pink blush cheeks */}
      <ellipse cx="68" cy="118" rx="9" ry="6" fill="#FFA6B5" opacity="0.85" />
      <ellipse cx="142" cy="118" rx="9" ry="6" fill="#FFA6B5" opacity="0.85" />

      {/* eyes — big round black with white highlights, tracking */}
      <g>
        <g className="animate-mascot-blink" style={{ transformOrigin: `${EYE_LEFT.cx}px ${EYE_LEFT.cy}px`, transformBox: "fill-box" as const }}>
          <circle cx={EYE_LEFT.cx} cy={EYE_LEFT.cy} r="8.5" fill="#1a0d05" />
          <g transform={`translate(${px} ${py})`}>
            <circle cx={EYE_LEFT.cx + 2.2} cy={EYE_LEFT.cy - 2.6} r="2.6" fill="#ffffff" />
            <circle cx={EYE_LEFT.cx - 2.6} cy={EYE_LEFT.cy + 3} r="1.2" fill="#ffffff" />
          </g>
        </g>
        <g className="animate-mascot-blink" style={{ transformOrigin: `${EYE_RIGHT.cx}px ${EYE_RIGHT.cy}px`, transformBox: "fill-box" as const }}>
          <circle cx={EYE_RIGHT.cx} cy={EYE_RIGHT.cy} r="8.5" fill="#1a0d05" />
          <g transform={`translate(${px} ${py})`}>
            <circle cx={EYE_RIGHT.cx + 2.2} cy={EYE_RIGHT.cy - 2.6} r="2.6" fill="#ffffff" />
            <circle cx={EYE_RIGHT.cx - 2.6} cy={EYE_RIGHT.cy + 3} r="1.2" fill="#ffffff" />
          </g>
        </g>
      </g>

      {/* tiny eyebrows — subtle arches */}
      <path d="M72 82 q10 -3 20 1" stroke={STROKE} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.75" />
      <path d="M118 83 q10 -4 20 -1" stroke={STROKE} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.75" />

      {/* nose — small heart button */}
      <path
        d="M105 112
           q-6 0 -6 4.5
           q0 5 6 8
           q6 -3 6 -8
           q0 -4.5 -6 -4.5 z"
        fill="#1a0d05"
      />
      <ellipse cx="103" cy="114" rx="1.6" ry="1" fill="#ffffff" opacity="0.85" />
      {/* philtrum */}
      <path d="M105 122 v6" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />

      {/* MOUTH — cute chibi smile, animated so she "speaks" */}
      <g>
        {/* the smile: two soft curves */}
        <path d="M105 128 q-8 8 -13 4" stroke={STROKE} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        <path d="M105 128 q8 8 13 4" stroke={STROKE} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        {/* small mouth opening that pulses when talking */}
        <g clipPath="url(#mouthClip2)">
          <path d="M92 122 q13 12 26 0 q-3 11 -13 11 q-10 0 -13 -11 z" fill="#3a1409" />
          <g
            className="animate-mascot-mouth"
            style={{ transformOrigin: "105px 130px", transformBox: "fill-box" as const }}
          >
            <ellipse cx="105" cy="132" rx="9" ry="5" fill="#FF7A98" />
          </g>
        </g>
      </g>
    </svg>
  );
}
