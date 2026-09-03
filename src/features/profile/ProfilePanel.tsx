import { User, X } from "lucide-react";

import { CuisineIcon, CUISINE_META } from "@/components/icons/CuisineIcons";
import { haptic } from "@/lib/haptic";
import { pickCuisine } from "@/lib/cuisine";
import type { Cuisine, Restaurant } from "@/lib/places.shared";
import type { VisitMap } from "@/features/visits/use-visits";

export function ProfilePanel({
  restaurants,
  visits,
  cityLabel,
  email,
  onClose,
  onOpenMap,
}: {
  restaurants: Restaurant[];
  visits: VisitMap;
  cityLabel: string;
  email: string | null;
  onClose: () => void;
  onOpenMap: () => void;
}) {
  const done = restaurants.filter((r) => visits[r.id]?.done);
  const saved = restaurants.filter((r) => visits[r.id]?.favorite && !visits[r.id]?.done);

  const cuisineCount = new Map<Cuisine, number>();
  done.forEach((r) => {
    const c = pickCuisine(r.cuisines);
    cuisineCount.set(c, (cuisineCount.get(c) ?? 0) + 1);
  });
  const topCuisines = Array.from(cuisineCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const cityProgress = restaurants.length
    ? Math.round((done.length / restaurants.length) * 100)
    : 0;

  const Stat = ({ value, label }: { value: string; label: string }) => (
    <div className="rounded-2xl bg-muted/50 px-3 py-3 text-center">
      <div className="font-display font-extrabold text-xl leading-none">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );

  return (
    <>
      <div className="absolute inset-0 z-30 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute z-40 left-2 right-2 bottom-2 top-20 sm:left-4 sm:right-auto sm:top-4 sm:bottom-4 sm:w-[360px] rounded-2xl bg-card border border-border/70 shadow-2xl overflow-hidden flex flex-col animate-pop-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <h2 className="font-display font-bold text-sm">Mon profil</h2>
          <button
            onClick={() => {
              haptic();
              onClose();
            }}
            className="p-1 -m-1 text-muted-foreground hover:text-foreground tap-bounce"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-5">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-full bg-[color:var(--duo-green)]/15 grid place-items-center">
              <User className="h-6 w-6 text-[color:var(--duo-green-dark)]" />
            </span>
            <div className="min-w-0">
              <div className="font-display font-extrabold text-[15px] leading-tight truncate">
                {email ?? "Explorateur food"}
              </div>
              <div className="text-xs text-muted-foreground">
                {cityLabel ? `Explore ${cityLabel}` : "Choisis une ville pour explorer"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat value={String(done.length)} label="Restaurants découverts" />
            <Stat value={String(saved.length)} label="Enregistrés" />
            <Stat value={String(cuisineCount.size)} label="Cuisines goûtées" />
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {cityLabel || "Ville"} explorée
              </h3>
              <span className="text-sm font-bold">{cityProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-[color:var(--duo-green)] transition-[width] duration-700 ease-out"
                style={{ width: `${cityProgress}%` }}
              />
            </div>
          </div>

          {topCuisines.length > 0 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
                Mes cuisines préférées
              </h3>
              <div className="flex flex-wrap gap-2">
                {topCuisines.map(([c, n]) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 pl-1 pr-3 py-1 text-sm"
                  >
                    <CuisineIcon cuisines={[c]} size={26} />
                    {CUISINE_META[c].label}
                    <span className="text-muted-foreground">· {n}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => {
              haptic(20);
              onOpenMap();
            }}
            className="w-full h-11 rounded-full bg-[color:var(--duo-green)] text-white text-sm font-extrabold btn-pop hover:brightness-105 tap-bounce transition"
          >
            Voir ma carte food
          </button>
        </div>
      </div>
    </>
  );
}
