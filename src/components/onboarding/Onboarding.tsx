/**
 * Onboarding — 3 short screens explaining the Tastemap concept.
 *
 * Skippable, no account, no cuisine choice: the user lands on the map right
 * after. Shown once, tracked in localStorage.
 */
import { useState } from "react";
import { TastyFox } from "@/components/mascot/TastyFox";
import { haptic } from "@/lib/haptic";

export const ONBOARDING_KEY = "tastemap.onboarding.v1";

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    /* ignore */
  }
}

const SCREENS = [
  {
    title: "Ta ville. Ta carte food.",
    body: "Découvre les restaurants autour de toi et construis ta propre carte au fil de tes sorties.",
    cta: "C’est parti",
  },
  {
    title: "Enregistre les adresses qui te tentent",
    body: "Touche un restaurant sur la carte et ajoute-le à ta liste en un geste.",
    cta: "Suivant",
  },
  {
    title: "Regarde ta carte se remplir",
    body: "Plus tu découvres d’adresses, plus la ville devient la tienne.",
    cta: "Explorer ma carte",
  },
] as const;

/** Small visual: undiscovered → saved → discovered pins. */
function PinsVisual({ step }: { step: number }) {
  const dots = [
    { ring: "#ded3bf", bg: "#ffffff", label: "○" },
    { ring: "#F2789F", bg: "#FFE9F0", label: "🔖" },
    { ring: "#4CB800", bg: "#E4FBC6", label: "✓" },
  ];
  const shown = step === 1 ? dots.slice(0, 2) : dots;
  return (
    <div className="flex items-center justify-center gap-3">
      {shown.map((d, i) => (
        <span
          key={i}
          className="grid place-items-center rounded-full text-[15px] font-extrabold"
          style={{
            width: 44,
            height: 44,
            background: d.bg,
            border: `3px solid ${d.ring}`,
            opacity: step === 2 && i < 2 ? 0.9 : 1,
          }}
        >
          {d.label}
        </span>
      ))}
    </div>
  );
}

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const screen = SCREENS[step];

  const finish = () => {
    markSeen();
    onDone();
  };

  const next = () => {
    haptic();
    if (step === SCREENS.length - 1) finish();
    else setStep((s) => s + 1);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-6 bg-black/45 backdrop-blur-[2px]">
      <div className="relative w-full max-w-[360px] rounded-[28px] bg-white/97 border border-white/70 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.4)] px-6 py-6 animate-pop-in">
        <button
          onClick={() => { haptic(); finish(); }}
          className="absolute top-3 right-4 text-[13px] font-bold text-muted-foreground hover:text-foreground"
        >
          Passer
        </button>

        <div className="flex justify-center">
          {step === 0 ? <TastyFox size={150} /> : <div className="py-6"><PinsVisual step={step} /></div>}
        </div>

        <h2 className="mt-3 text-center font-display text-[22px] font-extrabold leading-tight">
          {screen.title}
        </h2>
        <p className="mt-2 text-center text-[14px] text-muted-foreground leading-snug">
          {screen.body}
        </p>

        <div className="mt-5 flex justify-center gap-1.5">
          {SCREENS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-[color:var(--duo-green)]" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="mt-4 w-full h-12 rounded-full bg-[color:var(--duo-green)] text-white text-[15px] font-extrabold btn-pop hover:brightness-105 tap-bounce transition"
        >
          {screen.cta}
        </button>
      </div>
    </div>
  );
}
