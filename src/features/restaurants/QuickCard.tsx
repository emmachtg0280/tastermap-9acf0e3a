import { Check, Heart, X } from "lucide-react";

import { CuisineIcon } from "@/components/icons/CuisineIcons";
import { haptic } from "@/lib/haptic";
import type { Cuisine, Restaurant } from "@/lib/places.shared";
import type { VisitEntry } from "@/features/visits/use-visits";

export function QuickCard({
  restaurant: r,
  preferredCuisine,
  visit,
  onUpdate,
  onDetails,
  onClose,
}: {
  restaurant: Restaurant;
  preferredCuisine?: Cuisine;
  visit: VisitEntry;
  onUpdate: (patch: Partial<VisitEntry>) => void;
  onDetails: () => void;
  onClose: () => void;
}) {
  const saved = visit.favorite;
  const done = visit.done;

  return (
    <div className="absolute left-3 right-3 bottom-3 lg:left-4 lg:right-auto lg:bottom-4 lg:w-[360px] z-40 rounded-3xl bg-card/95 backdrop-blur border border-border/60 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-pop-in">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/70 border border-white/60">
          <CuisineIcon cuisines={r.cuisines} preferred={preferredCuisine} size={34} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-extrabold text-[15px] leading-tight truncate">
            {r.name}
          </h3>
          <p className="text-[13px] text-muted-foreground truncate">
            {done
              ? "Sur ta carte · Découvert"
              : saved
                ? "Sur ta carte · À tester"
                : (r.primaryType ?? "Restaurant")}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="h-9 w-9 -mr-1 grid place-items-center rounded-full text-muted-foreground hover:text-foreground tap-bounce"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => {
            haptic(saved ? 12 : 24);
            onUpdate({ favorite: !saved });
          }}
          className={`flex-1 h-12 rounded-2xl inline-flex items-center justify-center gap-2 text-[15px] font-extrabold tap-bounce transition ${
            saved
              ? "bg-rose-50 text-rose-600 border-2 border-rose-300"
              : "bg-white text-foreground border-2 border-border/70 hover:bg-muted/60"
          }`}
        >
          <Heart className={`h-5 w-5 ${saved ? "fill-rose-500 text-rose-500" : ""}`} />
          {saved ? "Enregistré" : "Enregistrer"}
        </button>
        <button
          onClick={() => {
            haptic(done ? 12 : 24);
            onUpdate({ done: !done });
          }}
          className={`flex-1 h-12 rounded-2xl inline-flex items-center justify-center gap-2 text-[15px] font-extrabold tap-bounce transition ${
            done
              ? "bg-[color:var(--duo-green)] text-white btn-pop"
              : "bg-white text-foreground border-2 border-border/70 hover:bg-muted/60"
          }`}
        >
          <Check className="h-5 w-5" strokeWidth={3} />
          {done ? "Découvert" : "J'y suis allé"}
        </button>
      </div>

      <button
        onClick={onDetails}
        className="mt-2 w-full h-9 rounded-xl text-[13px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
      >
        Voir les détails
      </button>
    </div>
  );
}
