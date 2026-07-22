/**
 * ChefBuddy — Duolingo-inspired sticker mascot.
 * A warm, expressive orange fox chef with living eyes that track the
 * pointer, a soft hop, gentle blink, a wagging tail, and an always-visible
 * open-mouth smile with a subtly animated tongue (so the mouth never
 * disappears while she "talks").
 */

import { useEffect, useRef, useState } from "react";

const EYE_LEFT = { cx: 78, cy: 90 };
const EYE_RIGHT = { cx: 122, cy: 90 };
const PUPIL_RADIUS = 4;

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
      width="164"
      height="180"
      viewBox="0 0 200 220"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_14px_18px_rgba(43,20,0,0.28)]"
    >
      <defs>
        {/* Clip the tongue so it stays inside the open-mouth shape */}
        <clipPath id="mouthClip">
          <path d="M84 116 q16 16 32 0 q-4 12 -16 12 q-12 0 -16 -12 z" />
        </clipPath>
        {/* Warm gradient for the head to give volume */}
        <radialGradient id="headGrad" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FFB067" />
          <stop offset="55%" stopColor="#FF7A1A" />
          <stop offset="100%" stopColor="#E8620A" />
        </radialGradient>
        <radialGradient id="bodyGrad" cx="40%" cy="30%" r="85%">
          <stop offset="0%" stopColor="#FFA254" />
          <stop offset="70%" stopColor="#FF7A1A" />
          <stop offset="100%" stopColor="#D45500" />
        </radialGradient>
      </defs>

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
      <ellipse cx="100" cy="140" rx="66" ry="58" fill="url(#bodyGrad)" />
      {/* belly */}
      <ellipse cx="100" cy="158" rx="40" ry="28" fill="#FFF1DC" />

      {/* arms */}
      <ellipse cx="40" cy="138" rx="15" ry="20" fill="#FF7A1A" />
      <ellipse cx="35" cy="146" rx="7" ry="9" fill="#E8620A" opacity="0.6" />
      <ellipse cx="160" cy="138" rx="15" ry="20" fill="#FF7A1A" />
      <ellipse cx="165" cy="146" rx="7" ry="9" fill="#E8620A" opacity="0.6" />

      {/* ears */}
      <path d="M56 62 q-10 -28 14 -36 q10 16 6 36 z" fill="#FF7A1A" />
      <path d="M62 52 q0 -14 10 -18 q4 12 2 22 z" fill="#FFC8A0" />
      <path d="M144 62 q10 -28 -14 -36 q-10 16 -6 36 z" fill="#FF7A1A" />
      <path d="M138 52 q0 -14 -10 -18 q-4 12 -2 22 z" fill="#FFC8A0" />

      {/* head — rounder & more human proportion */}
      <ellipse cx="100" cy="94" rx="56" ry="50" fill="url(#headGrad)" />

      {/* forehead fur tuft */}
      <path
        d="M92 48 q4 -8 8 -2 q4 -6 8 2 q-6 6 -16 0 z"
        fill="#FFB067"
        opacity="0.85"
      />

      {/* soft cheek fluff (jowls) — humanizes the face */}
      <ellipse cx="58" cy="112" rx="14" ry="12" fill="#FFB067" opacity="0.85" />
      <ellipse cx="142" cy="112" rx="14" ry="12" fill="#FFB067" opacity="0.85" />

      {/* face highlight (top light) */}
      <ellipse cx="80" cy="76" rx="26" ry="18" fill="#FFD1A0" opacity="0.55" />

      {/* muzzle / lower face — larger, rounder for warmth */}
      <ellipse cx="100" cy="112" rx="32" ry="24" fill="#FFF6E4" />
      {/* muzzle shadow to give a soft chin */}
      <ellipse cx="100" cy="122" rx="24" ry="10" fill="#F4E4C4" opacity="0.6" />

      {/* pink blush cheeks */}
      <ellipse cx="62" cy="108" rx="9" ry="6" fill="#FF9BB3" opacity="0.75" />
      <ellipse cx="138" cy="108" rx="9" ry="6" fill="#FF9BB3" opacity="0.75" />

      {/* eyes — larger, glossier, more expressive */}
      <g>
        {/* subtle eye shadow to seat them into the face */}
        <ellipse cx={EYE_LEFT.cx} cy={EYE_LEFT.cy + 2} rx="13" ry="14" fill="#E8620A" opacity="0.25" />
        <ellipse cx={EYE_RIGHT.cx} cy={EYE_RIGHT.cy + 2} rx="13" ry="14" fill="#E8620A" opacity="0.25" />

        <ellipse cx={EYE_LEFT.cx} cy={EYE_LEFT.cy} rx="12" ry="14" fill="#ffffff" />
        <ellipse cx={EYE_RIGHT.cx} cy={EYE_RIGHT.cy} rx="12" ry="14" fill="#ffffff" />

        {/* pupils translate with gaze; blink scales vertically */}
        <g className="animate-mascot-blink" style={{ transformOrigin: `${EYE_LEFT.cx}px ${EYE_LEFT.cy}px`, transformBox: "fill-box" as const }}>
          <g transform={`translate(${px} ${py})`}>
            <ellipse cx={EYE_LEFT.cx} cy={EYE_LEFT.cy + 1} rx="7" ry="9" fill="#2b1810" />
            <circle cx={EYE_LEFT.cx + 2.5} cy={EYE_LEFT.cy - 3} r="2.8" fill="#ffffff" />
            <circle cx={EYE_LEFT.cx - 2.8} cy={EYE_LEFT.cy + 4} r="1.4" fill="#ffffff" />
          </g>
        </g>
        <g className="animate-mascot-blink" style={{ transformOrigin: `${EYE_RIGHT.cx}px ${EYE_RIGHT.cy}px`, transformBox: "fill-box" as const }}>
          <g transform={`translate(${px} ${py})`}>
            <ellipse cx={EYE_RIGHT.cx} cy={EYE_RIGHT.cy + 1} rx="7" ry="9" fill="#2b1810" />
            <circle cx={EYE_RIGHT.cx + 2.5} cy={EYE_RIGHT.cy - 3} r="2.8" fill="#ffffff" />
            <circle cx={EYE_RIGHT.cx - 2.8} cy={EYE_RIGHT.cy + 4} r="1.4" fill="#ffffff" />
          </g>
        </g>

        {/* upper eyelid line adds warmth */}
        <path d="M67 82 q11 -5 22 0" stroke="#5a2a08" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.55" />
        <path d="M111 82 q11 -5 22 0" stroke="#5a2a08" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.55" />
      </g>

      {/* eyebrows — slight arch, kind expression */}
      <path d="M64 68 q12 -8 24 -2" stroke="#3a1a06" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M112 66 q12 -6 24 2" stroke="#3a1a06" strokeWidth="3.5" fill="none" strokeLinecap="round" />

      {/* nose — heart-shaped tip */}
      <path
        d="M100 98
           q-8 0 -8 6
           q0 6 8 10
           q8 -4 8 -10
           q0 -6 -8 -6 z"
        fill="#2b1810"
      />
      <ellipse cx="97" cy="100" rx="2.2" ry="1.4" fill="#ffffff" opacity="0.8" />
      {/* nose-to-mouth crease */}
      <path d="M100 110 v6" stroke="#5a2a08" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />

      {/* MOUTH — always visible, open smile with tongue that talks */}
      <g>
        {/* Dark open-mouth shape (always drawn) */}
        <path
          d="M84 116 q16 16 32 0 q-4 14 -16 14 q-12 0 -16 -14 z"
          fill="#3a1409"
        />
        {/* Animated tongue — scales inside the clipped mouth */}
        <g clipPath="url(#mouthClip)">
          <g
            className="animate-mascot-mouth"
            style={{ transformOrigin: "100px 122px", transformBox: "fill-box" as const }}
          >
            <ellipse cx="100" cy="126" rx="12" ry="7" fill="#FF6F91" />
            <ellipse cx="100" cy="124" rx="9" ry="3" fill="#FF95AC" opacity="0.9" />
          </g>
          {/* Little tooth */}
          <rect x="96" y="115" width="8" height="4" rx="1.2" fill="#ffffff" />
        </g>
        {/* Smile corners so the mouth reads even at small sizes */}
        <path d="M82 114 q2 4 6 6" stroke="#3a1409" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M118 114 q-2 4 -6 6" stroke="#3a1409" strokeWidth="2.4" fill="none" strokeLinecap="round" />
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
