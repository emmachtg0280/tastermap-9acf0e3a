import { useEffect, useState } from "react";
import { CalendarClock, Check, ChevronDown, Clock, Heart, MapPin, Navigation, Phone, Star, X } from "lucide-react";

import { CuisineIcon } from "@/components/icons/CuisineIcons";
import { Textarea } from "@/components/ui/textarea";
import newTabAsset from "@/assets/tabs/new.png.asset.json";
import { haptic } from "@/lib/haptic";
import { isNewRestaurant } from "@/features/restaurants/restaurant-filters";
import type { Cuisine, Restaurant } from "@/lib/places.shared";
import type { VisitEntry } from "@/features/visits/use-visits";

const NewStickerIcon = ({ size = 20 }: { size?: number }) => (
  <img
    src={newTabAsset.url}
    alt=""
    width={size}
    height={size}
    loading="lazy"
    draggable={false}
    className="object-contain select-none pointer-events-none"
    style={{
      width: size,
      height: size,
      filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.15))",
    }}
  />
);

function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export type SheetSnap = "collapsed" | "half" | "expanded";

export function DetailCard({
  restaurant: r,
  preferredCuisine,
  visit,
  distanceKm,
  fromUser,
  snap,
  onSnapChange,
  onUpdate,
  onClose,
}: {
  restaurant: Restaurant;
  preferredCuisine?: Cuisine;
  visit: VisitEntry;
  distanceKm?: number | null;
  fromUser?: boolean;
  snap: SheetSnap;
  onSnapChange: (s: SheetSnap) => void;
  onUpdate: (patch: Partial<VisitEntry>) => void;
  onClose: () => void;
}) {
  const [comment, setComment] = useState(visit.comment);
  const [showHours, setShowHours] = useState(false);
  useEffect(() => setComment(visit.comment), [visit.comment, r.id]);

  const heightClass =
    snap === "collapsed" ? "h-[118px]" : snap === "expanded" ? "h-[86vh]" : "h-[52vh]";

  const cycle = () => {
    haptic(12);
    onSnapChange(snap === "collapsed" ? "half" : snap === "half" ? "expanded" : "collapsed");
  };

  return (
    <div
      className={`absolute left-3 right-3 bottom-3 lg:left-4 lg:right-auto lg:bottom-4 lg:w-[360px] rounded-2xl bg-card/95 backdrop-blur border border-border/60 shadow-[0_8px_30px_-10px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col transition-[height] duration-300 ease-out lg:h-auto lg:max-h-[70vh] ${heightClass}`}
    >
      <button
        type="button"
        onClick={cycle}
        aria-label={snap === "expanded" ? "Réduire la fiche" : "Agrandir la fiche"}
        className="lg:hidden shrink-0 h-6 w-full grid place-items-center touch-manipulation"
      >
        <span className="h-1.5 w-10 rounded-full bg-foreground/20" />
      </button>
      {r.photoUrls.length > 0 && snap !== "collapsed" && (
        <div
          className="flex overflow-x-auto snap-x snap-mandatory flex-shrink-0"
          style={{ overscrollBehaviorX: "contain", touchAction: "pan-x" }}
        >
          {r.photoUrls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`${r.name} — plat ${i + 1}`}
              loading="lazy"
              className="h-32 lg:h-44 w-full flex-shrink-0 object-cover snap-start"
            />
          ))}
        </div>
      )}
      <div className={`px-4 pb-4 ${snap === "collapsed" ? "pt-0" : "pt-4"} overflow-y-auto`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/60 backdrop-blur border border-white/50">
            <CuisineIcon cuisines={r.cuisines} preferred={preferredCuisine} size={32} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-base leading-tight">{r.name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {r.primaryType ?? "Restaurant"}
            </p>
          </div>
          <button
            onClick={() => {
              haptic();
              onClose();
            }}
            className="text-muted-foreground hover:text-foreground p-1 -m-1 tap-bounce flex-shrink-0"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Personal actions stay the primary content of the sheet */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => {
              haptic(visit.favorite ? 12 : 24);
              onUpdate({ favorite: !visit.favorite });
            }}
            className={`flex-1 h-11 rounded-2xl inline-flex items-center justify-center gap-2 text-sm font-extrabold tap-bounce transition ${
              visit.favorite
                ? "bg-rose-50 text-rose-600 border-2 border-rose-300"
                : "bg-white text-foreground border-2 border-border/70 hover:bg-muted/60"
            }`}
          >
            <Heart
              className={`h-4.5 w-4.5 ${visit.favorite ? "fill-rose-500 text-rose-500" : ""}`}
            />
            {visit.favorite ? "Enregistré" : "Enregistrer"}
          </button>
          <button
            onClick={() => {
              haptic(visit.done ? 12 : 24);
              onUpdate({ done: !visit.done });
            }}
            className={`flex-1 h-11 rounded-2xl inline-flex items-center justify-center gap-2 text-sm font-extrabold tap-bounce transition ${
              visit.done
                ? "bg-[color:var(--duo-green)] text-white btn-pop"
                : "bg-white text-foreground border-2 border-border/70 hover:bg-muted/60"
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            {visit.done ? "Découvert" : "J'y suis allé"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {r.rating != null && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 font-medium">
              <Star className="h-4 w-4 fill-amber-400 stroke-amber-400" />
              {r.rating.toFixed(1)}
              {r.userRatingCount != null && (
                <span className="text-amber-600/70 font-normal">({r.userRatingCount})</span>
              )}
            </span>
          )}
          {r.priceLevel && (
            <span className="text-muted-foreground font-medium">{priceLabel(r.priceLevel)}</span>
          )}
          {distanceKm != null && (
            <span className="text-muted-foreground font-medium inline-flex items-center gap-1">
              <Navigation className="h-3.5 w-3.5" />
              {formatDistance(distanceKm)}
              {fromUser ? "" : " du centre"}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-medium ${
              visit.done
                ? "bg-[color:var(--duo-green)]/10 text-[color:var(--duo-green-dark)]"
                : visit.favorite
                  ? "bg-rose-50 text-rose-600"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {visit.done ? "Découvert" : visit.favorite ? "À découvrir" : "Pas encore exploré"}
          </span>
          {isNewRestaurant(r) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 font-medium">
              <NewStickerIcon size={16} /> Nouveau
            </span>
          )}
          {r.openNow === true && (
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" /> Ouvert
            </span>
          )}
          {r.openNow === false && (
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" /> Fermé
            </span>
          )}
        </div>

        {r.summary && (
          <p className="mt-3 text-sm text-foreground/80 leading-relaxed line-clamp-2">
            {r.summary}
          </p>
        )}

        <p className="mt-3 text-sm text-muted-foreground flex items-start gap-1.5">
          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span className="line-clamp-2">{r.address}</span>
        </p>

        {r.weekdayDescriptions.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => {
                haptic();
                setShowHours((v) => !v);
              }}
              className="inline-flex items-center gap-1 text-xs text-foreground/70 hover:text-foreground bg-muted/60 px-2.5 py-1.5 rounded-full tap-bounce transition"
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Horaires
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showHours ? "rotate-180" : ""}`}
              />
            </button>
            {showHours && (
              <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground leading-tight bg-muted/30 rounded-lg p-2.5">
                {r.weekdayDescriptions.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {r.googleMapsUri && (
            <a
              href={r.googleMapsUri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-[color:var(--duo-green)] text-white font-semibold btn-pop hover:brightness-105 tap-bounce transition"
            >
              <MapPin className="h-3.5 w-3.5" /> Google Maps
            </a>
          )}
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-semibold tap-bounce transition"
          >
            <Navigation className="h-3.5 w-3.5" /> Itinéraire
          </a>
          {r.phone && (
            <a
              href={`tel:${r.phone.replace(/\s/g, "")}`}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-semibold tap-bounce transition"
            >
              <Phone className="h-3.5 w-3.5" /> {r.phone}
            </a>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-border/50">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={() => onUpdate({ comment })}
            placeholder="Un petit mot sur ce resto ?"
            rows={2}
            className="resize-none text-sm border-border/40 bg-muted/30 focus:bg-card"
          />
        </div>
      </div>
    </div>
  );
}

function priceLabel(level: string) {
  const map: Record<string, string> = {
    PRICE_LEVEL_FREE: "Gratuit",
    PRICE_LEVEL_INEXPENSIVE: "€",
    PRICE_LEVEL_MODERATE: "€€",
    PRICE_LEVEL_EXPENSIVE: "€€€",
    PRICE_LEVEL_VERY_EXPENSIVE: "€€€€",
  };
  return map[level] ?? "";
}
