/**
 * ChefBuddy — Duolingo-style sticker mascot.
 * A vivid orange fox wearing a chef toque.
 * Reuses global keyframes: mascot-hop, mascot-blink, mascot-wing.
 */

export function ChefBuddy() {
  return (
    <svg
      width="160"
      height="170"
      viewBox="0 0 200 210"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-[0_10px_0_rgba(43,43,43,0.35)]"
    >
      {/* feet */}
      <ellipse cx="78" cy="192" rx="14" ry="6" fill="#C24A00" stroke="#2b2b2b" strokeWidth="4" />
      <ellipse cx="122" cy="192" rx="14" ry="6" fill="#C24A00" stroke="#2b2b2b" strokeWidth="4" />

      {/* tail (animated with wing keyframe) */}
      <path
        d="M170 130 q22 -6 18 24 q-2 18 -22 14 q-14 -4 -12 -18 z"
        fill="#FF7A1A"
        stroke="#2b2b2b"
        strokeWidth="5"
        strokeLinejoin="round"
        className="animate-mascot-wing"
        style={{ transformOrigin: "170px 140px" }}
      />
      <path
        d="M178 148 q10 4 4 18"
        stroke="#ffffff"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />

      {/* body */}
      <ellipse cx="100" cy="130" rx="66" ry="60" fill="#FF7A1A" stroke="#2b2b2b" strokeWidth="6" />
      {/* belly */}
      <ellipse cx="100" cy="150" rx="40" ry="30" fill="#FFF1DC" />

      {/* arms */}
      <ellipse cx="42" cy="130" rx="14" ry="18" fill="#FF7A1A" stroke="#2b2b2b" strokeWidth="5" />
      <ellipse cx="158" cy="130" rx="14" ry="18" fill="#FF7A1A" stroke="#2b2b2b" strokeWidth="5" />

      {/* head */}
      <ellipse cx="100" cy="82" rx="52" ry="46" fill="#FF7A1A" stroke="#2b2b2b" strokeWidth="6" />

      {/* ears */}
      <path
        d="M58 52 q-6 -22 10 -30 q10 12 6 30 z"
        fill="#FF7A1A"
        stroke="#2b2b2b"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M60 42 q0 -10 8 -14 q4 8 2 18 z" fill="#FFF1DC" />
      <path
        d="M142 52 q6 -22 -10 -30 q-10 12 -6 30 z"
        fill="#FF7A1A"
        stroke="#2b2b2b"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M140 42 q0 -10 -8 -14 q-4 8 -2 18 z" fill="#FFF1DC" />

      {/* muzzle */}
      <ellipse cx="100" cy="98" rx="26" ry="18" fill="#FFF1DC" stroke="#2b2b2b" strokeWidth="5" />

      {/* cheeks */}
      <circle cx="66" cy="94" r="8" fill="#FF9BB3" opacity="0.65" />
      <circle cx="134" cy="94" r="8" fill="#FF9BB3" opacity="0.65" />

      {/* eyes */}
      <g>
        <ellipse
          cx="82"
          cy="76"
          rx="8"
          ry="10"
          fill="#2b2b2b"
          className="animate-mascot-blink"
        />
        <circle cx="84.5" cy="72" r="2.6" fill="#ffffff" />
      </g>
      <g>
        <ellipse
          cx="118"
          cy="76"
          rx="8"
          ry="10"
          fill="#2b2b2b"
          className="animate-mascot-blink"
        />
        <circle cx="120.5" cy="72" r="2.6" fill="#ffffff" />
      </g>

      {/* nose */}
      <ellipse cx="100" cy="92" rx="5" ry="4" fill="#2b2b2b" />
      {/* mouth */}
      <path
        d="M92 102 q8 8 16 0"
        stroke="#2b2b2b"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* chef toque */}
      <ellipse cx="100" cy="30" rx="30" ry="22" fill="#ffffff" stroke="#2b2b2b" strokeWidth="5" />
      <circle cx="82" cy="28" r="14" fill="#ffffff" stroke="#2b2b2b" strokeWidth="5" />
      <circle cx="118" cy="28" r="14" fill="#ffffff" stroke="#2b2b2b" strokeWidth="5" />
      <circle cx="100" cy="20" r="15" fill="#ffffff" stroke="#2b2b2b" strokeWidth="5" />
      {/* toque band */}
      <rect
        x="70"
        y="46"
        width="60"
        height="12"
        rx="4"
        fill="#F5F0E6"
        stroke="#2b2b2b"
        strokeWidth="5"
      />
    </svg>
  );
}
