/**
 * ChefBuddy — chibi fox mascot, faithful to the reference sticker style.
 * Thick dark outlines, big shiny round eyes with double highlights that
 * follow the pointer, blush cheeks, cream muzzle & belly, tall pointy ears
 * with dark-tipped cream insides, brown toe-pad paws, and a fluffy curled
 * tail with a cream tip. Animated: breathing body, blinking + gaze
 * tracking, mouth talking, tail sway, occasional ear twitch.
 */

import { useEffect, useRef, useState } from "react";

const EYE_LEFT = { cx: 84, cy: 108 };
const EYE_RIGHT = { cx: 136, cy: 108 };
const PUPIL_TRAVEL = 3.2;

const OUTLINE = "#2A150A";
const OW = 3.4; // outline width
const ORANGE = "#F58A2E";
const ORANGE_DARK = "#E76D1F";
const CREAM = "#FFF2DC";
const CREAM_SHADE = "#F6E1BE";
const BLUSH = "#FFAAB8";
const PAW = "#7A3E1E";
const PAW_DARK = "#3E1E0A";
const BLACK = "#1A0D05";

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
      const pull = Math.min(1, dist / 240);
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
      const idleX = Math.sin(idleT * 0.7) * 0.3;
      const idleY = Math.sin(idleT * 0.5 + 1.2) * 0.22;
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

  const px = gaze.x * PUPIL_TRAVEL;
  const py = gaze.y * PUPIL_TRAVEL;

  return (
    <svg
      ref={svgRef}
      width="188"
      height="200"
      viewBox="0 0 220 230"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_16px_20px_rgba(43,20,0,0.25)]"
    >
      <defs>
        <clipPath id="mouth-hole">
          <path d="M96 138 q14 12 28 0 q-3 12 -14 12 q-11 0 -14 -12 z" />
        </clipPath>
        {/* subtle body shading */}
        <radialGradient id="bodyShade" cx="70%" cy="70%" r="70%">
          <stop offset="60%" stopColor={ORANGE} stopOpacity="0" />
          <stop offset="100%" stopColor={ORANGE_DARK} stopOpacity="0.55" />
        </radialGradient>
        <radialGradient id="headShade" cx="72%" cy="72%" r="70%">
          <stop offset="55%" stopColor={ORANGE} stopOpacity="0" />
          <stop offset="100%" stopColor={ORANGE_DARK} stopOpacity="0.5" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="112" cy="216" rx="60" ry="6" fill="rgba(0,0,0,0.18)" />

      {/* ==== TAIL (behind body) — cream-tipped, sways gently ==== */}
      <g
        className="animate-mascot-tail"
        style={{ transformOrigin: "48px 168px" }}
      >
        <path
          d="M60 168
             q-30 -6 -36 20
             q-2 22 20 30
             q16 4 26 -6
             q-4 -18 -10 -44 z"
          fill={ORANGE}
          stroke={OUTLINE}
          strokeWidth={OW}
          strokeLinejoin="round"
        />
        {/* cream tip */}
        <path
          d="M28 190
             q-6 12 4 24
             q10 6 20 2
             q-2 -12 -8 -22
             q-8 -6 -16 -4 z"
          fill={CREAM}
          stroke={OUTLINE}
          strokeWidth={OW}
          strokeLinejoin="round"
        />
      </g>

      {/* ==== BREATHING GROUP (body + head) ==== */}
      <g className="animate-mascot-breathe">
        {/* back paws */}
        <g>
          <ellipse cx="80" cy="202" rx="18" ry="10" fill={PAW}
            stroke={OUTLINE} strokeWidth={OW} strokeLinejoin="round" />
          <ellipse cx="76" cy="205" rx="4" ry="2.5" fill={PAW_DARK} />
          <ellipse cx="84" cy="205" rx="4" ry="2.5" fill={PAW_DARK} />
          <ellipse cx="80" cy="200" rx="3" ry="2" fill={PAW_DARK} />
        </g>
        <g>
          <ellipse cx="140" cy="202" rx="18" ry="10" fill={PAW}
            stroke={OUTLINE} strokeWidth={OW} strokeLinejoin="round" />
          <ellipse cx="136" cy="205" rx="4" ry="2.5" fill={PAW_DARK} />
          <ellipse cx="144" cy="205" rx="4" ry="2.5" fill={PAW_DARK} />
          <ellipse cx="140" cy="200" rx="3" ry="2" fill={PAW_DARK} />
        </g>

        {/* torso — chubby chibi sitting shape */}
        <path
          d="M62 158
             q-6 -34 24 -46
             q24 -8 48 0
             q30 12 24 46
             q-4 32 -22 40
             q-26 6 -52 0
             q-18 -8 -22 -40 z"
          fill={ORANGE}
          stroke={OUTLINE}
          strokeWidth={OW}
          strokeLinejoin="round"
        />
        <path
          d="M62 158
             q-6 -34 24 -46
             q24 -8 48 0
             q30 12 24 46
             q-4 32 -22 40
             q-26 6 -52 0
             q-18 -8 -22 -40 z"
          fill="url(#bodyShade)"
        />

        {/* cream belly */}
        <path
          d="M82 162
             q-4 -22 14 -30
             q14 -6 28 0
             q18 8 14 30
             q-4 20 -14 24
             q-14 4 -28 0
             q-10 -4 -14 -24 z"
          fill={CREAM}
          stroke={OUTLINE}
          strokeWidth={OW}
          strokeLinejoin="round"
        />
        {/* belly fluff hint */}
        <path d="M110 176 v14" stroke={OUTLINE} strokeWidth="1.6" strokeLinecap="round" opacity="0.35" />
        <path d="M104 182 v8" stroke={OUTLINE} strokeWidth="1.4" strokeLinecap="round" opacity="0.3" />
        <path d="M116 182 v8" stroke={OUTLINE} strokeWidth="1.4" strokeLinecap="round" opacity="0.3" />

        {/* ==== EARS ==== */}
        <g className="animate-mascot-ear" style={{ transformOrigin: "78px 60px" }}>
          <path
            d="M50 78 q-12 -50 30 -58 q10 26 8 50 z"
            fill={ORANGE}
            stroke={OUTLINE}
            strokeWidth={OW}
            strokeLinejoin="round"
          />
          {/* inner cream */}
          <path
            d="M60 66 q-6 -30 18 -38 q6 20 6 36 z"
            fill={CREAM}
          />
          {/* dark inner shadow at tip */}
          <path
            d="M58 46 q-4 -18 16 -26 q2 10 -2 22 z"
            fill={PAW_DARK}
            opacity="0.85"
          />
        </g>
        <g className="animate-mascot-ear" style={{ transformOrigin: "142px 60px", animationDelay: "1.3s" }}>
          <path
            d="M170 78 q12 -50 -30 -58 q-10 26 -8 50 z"
            fill={ORANGE}
            stroke={OUTLINE}
            strokeWidth={OW}
            strokeLinejoin="round"
          />
          <path
            d="M160 66 q6 -30 -18 -38 q-6 20 -6 36 z"
            fill={CREAM}
          />
          <path
            d="M162 46 q4 -18 -16 -26 q-2 10 2 22 z"
            fill={PAW_DARK}
            opacity="0.85"
          />
        </g>

        {/* ==== HEAD ==== */}
        <path
          d="M110 56
             q-52 0 -62 44
             q-6 28 8 50
             q22 24 54 24
             q32 0 54 -24
             q14 -22 8 -50
             q-10 -44 -62 -44 z"
          fill={ORANGE}
          stroke={OUTLINE}
          strokeWidth={OW}
          strokeLinejoin="round"
        />
        <path
          d="M110 56
             q-52 0 -62 44
             q-6 28 8 50
             q22 24 54 24
             q32 0 54 -24
             q14 -22 8 -50
             q-10 -44 -62 -44 z"
          fill="url(#headShade)"
        />

        {/* cream muzzle/cheek mask */}
        <path
          d="M60 122
             q6 -18 24 -18
             q12 -6 26 -6
             q14 0 26 6
             q18 0 24 18
             q6 22 -14 40
             q-16 12 -36 12
             q-20 0 -36 -12
             q-20 -18 -14 -40 z"
          fill={CREAM}
          stroke={OUTLINE}
          strokeWidth={OW}
          strokeLinejoin="round"
        />
        {/* soft chin shadow */}
        <ellipse cx="110" cy="150" rx="26" ry="8" fill={CREAM_SHADE} opacity="0.6" />

        {/* pink blush cheeks */}
        <ellipse cx="66" cy="128" rx="10" ry="6" fill={BLUSH} opacity="0.85" />
        <ellipse cx="154" cy="128" rx="10" ry="6" fill={BLUSH} opacity="0.85" />

        {/* forehead marking hint — subtle darker fur peak */}
        <path
          d="M96 62 q6 -8 14 -8 q8 0 14 8 q-4 6 -14 6 q-10 0 -14 -6 z"
          fill={ORANGE_DARK}
          opacity="0.35"
        />

        {/* ==== EYES ==== */}
        <g>
          {/* left */}
          <g className="animate-mascot-blink"
             style={{ transformOrigin: `${EYE_LEFT.cx}px ${EYE_LEFT.cy}px`, transformBox: "fill-box" as const }}>
            <ellipse cx={EYE_LEFT.cx} cy={EYE_LEFT.cy} rx="9" ry="10.5" fill={BLACK} />
            <g transform={`translate(${px} ${py})`}>
              <circle cx={EYE_LEFT.cx + 2.4} cy={EYE_LEFT.cy - 3.4} r="3" fill="#ffffff" />
              <circle cx={EYE_LEFT.cx - 3} cy={EYE_LEFT.cy + 3.4} r="1.4" fill="#ffffff" />
            </g>
          </g>
          {/* right */}
          <g className="animate-mascot-blink"
             style={{ transformOrigin: `${EYE_RIGHT.cx}px ${EYE_RIGHT.cy}px`, transformBox: "fill-box" as const }}>
            <ellipse cx={EYE_RIGHT.cx} cy={EYE_RIGHT.cy} rx="9" ry="10.5" fill={BLACK} />
            <g transform={`translate(${px} ${py})`}>
              <circle cx={EYE_RIGHT.cx + 2.4} cy={EYE_RIGHT.cy - 3.4} r="3" fill="#ffffff" />
              <circle cx={EYE_RIGHT.cx - 3} cy={EYE_RIGHT.cy + 3.4} r="1.4" fill="#ffffff" />
            </g>
          </g>
        </g>

        {/* small soft eyebrows */}
        <path d="M74 92 q10 -3 20 0" stroke={OUTLINE} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.55" />
        <path d="M126 92 q10 -3 20 0" stroke={OUTLINE} strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.55" />

        {/* ==== NOSE ==== */}
        <path
          d="M110 126
             q-7 0 -7 5
             q0 6 7 9
             q7 -3 7 -9
             q0 -5 -7 -5 z"
          fill={BLACK}
        />
        <ellipse cx="107" cy="128" rx="1.8" ry="1.1" fill="#ffffff" opacity="0.85" />
        {/* philtrum */}
        <path d="M110 138 v6" stroke={OUTLINE} strokeWidth="2.2" strokeLinecap="round" />

        {/* ==== MOUTH — chibi smile with talking pulse ==== */}
        <g>
          <path d="M110 144 q-9 9 -14 4" stroke={OUTLINE} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M110 144 q9 9 14 4" stroke={OUTLINE} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <g clipPath="url(#mouth-hole)">
            <path d="M96 138 q14 12 28 0 q-3 12 -14 12 q-11 0 -14 -12 z" fill="#3a1409" />
            <g className="animate-mascot-mouth"
               style={{ transformOrigin: "110px 146px", transformBox: "fill-box" as const }}>
              <ellipse cx="110" cy="148" rx="10" ry="5" fill="#FF7A98" />
              <ellipse cx="110" cy="146" rx="7" ry="2" fill="#FFB4C4" opacity="0.9" />
            </g>
            {/* tiny tooth */}
            <rect x="106" y="136" width="7" height="4" rx="1.2" fill="#ffffff" />
          </g>
        </g>

        {/* small paw arms tucked at front */}
        <ellipse cx="90" cy="188" rx="10" ry="6" fill={ORANGE_DARK} opacity="0.55" />
        <ellipse cx="130" cy="188" rx="10" ry="6" fill={ORANGE_DARK} opacity="0.55" />
      </g>
    </svg>
  );
}
