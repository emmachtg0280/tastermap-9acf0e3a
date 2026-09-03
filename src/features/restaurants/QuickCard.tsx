import { Check, Heart, X } from "lucide-react";

import { CuisineIcon } from "@/components/icons/CuisineIcons";
import { Button } from "@/components/ui/button";
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
    <div className="absolute left-3 right-3 bottom-3 lg:left-4 lg:right-auto lg:bottom-4 lg:w-[360px] z-40 tm-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-pop-in">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted">
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
        <Button
          variant="ghost"
          onClick={onClose}
          aria-label="Fermer"
          className="h-11 w-11 shrink-0 -mr-1 grid place-items-center rounded-full text-muted-foreground hover:text-foreground tap-bounce"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          onClick={() => {
            haptic(saved ? 12 : 24);
            onUpdate({ favorite: !saved });
          }}
          variant="outline"
          aria-pressed={saved}
          className={`flex-1 h-12 rounded-control text-sm ${
            saved
              ? "bg-saved-surface text-saved-foreground border-saved-foreground hover:bg-saved-surface hover:text-saved-foreground"
              : "bg-white text-foreground border-border hover:bg-muted"
          }`}
        >
          <Heart className={`h-5 w-5 ${saved ? "fill-saved text-saved-foreground" : ""}`} />
          {saved ? "Enregistré" : "Enregistrer"}
        </Button>
        <Button
          onClick={() => {
            haptic(done ? 12 : 24);
            onUpdate({ done: !done });
          }}
          variant="outline"
          aria-pressed={done}
          className={`flex-1 h-12 rounded-control text-sm ${
            done
              ? "bg-visited-surface text-visited-foreground border-visited-foreground hover:bg-visited-surface hover:text-visited-foreground"
              : "bg-white text-foreground border-border hover:bg-muted"
          }`}
        >
          <Check className="h-5 w-5" strokeWidth={3} />
          {done ? "Découvert" : "J'y suis allé"}
        </Button>
      </div>

      <Button
        variant="ghost"
        onClick={onDetails}
        className="mt-2 w-full h-11 rounded-xl text-[13px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
      >
        Voir les détails
      </Button>
    </div>
  );
}
