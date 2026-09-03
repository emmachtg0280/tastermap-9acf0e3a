import { useEffect, useState } from "react";

declare global {
  interface Window {
    google?: typeof google;
    initGMap?: () => void;
  }
}

export function useGoogleMaps() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (window.google?.maps) {
      setReady(true);
      return;
    }
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return;
    window.initGMap = () => setReady(true);
    const existing = document.getElementById("gmaps-script") as HTMLScriptElement | null;
    if (existing) return;
    const s = document.createElement("script");
    s.id = "gmaps-script";
    s.async = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=initGMap${
      channel ? `&channel=${channel}` : ""
    }`;
    document.head.appendChild(s);
  }, []);
  return ready;
}

function useVisits(userId: string | null) {
  const [localVisits, setLocalVisits] = useState<VisitMap>({});
  const queryClient = useQueryClient();
  const serverGetVisits = useServerFn(getMyVisits);
  const serverUpsert = useServerFn(upsertVisit);
  const serverMerge = useServerFn(mergeLocalVisits);
  const mergedRef = useRef(false);

  // Load localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(VISITS_KEY);
      if (raw) setLocalVisits(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  // Anonymous -> account: push localStorage states into the user's records,
  // then (and only then) clear the local copy.
  useEffect(() => {
    if (!userId || mergedRef.current) return;
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(VISITS_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let parsed: VisitMap;
    try {
      parsed = JSON.parse(raw) as VisitMap;
    } catch {
      return;
    }
    const entries = Object.entries(parsed ?? {}).map(([place_id, v]) => ({
      place_id,
      done: !!v.done,
      favorite: !!v.favorite,
      saved: !!v.favorite && !v.done,
      personal_rating: v.personalRating ?? null,
      comment: v.comment?.trim() ? v.comment : null,
    }));
    if (!entries.length) return;

    mergedRef.current = true;
    serverMerge({ data: { entries } })
      .then(() => {
        try {
          localStorage.removeItem(VISITS_KEY);
        } catch {
          /* ignore */
        }
        setLocalVisits({});
        queryClient.invalidateQueries({ queryKey: ["my-visits"] });
      })
      .catch((e: unknown) => {
        // Keep localStorage intact so nothing is lost; retry on next sign-in.
        mergedRef.current = false;
        console.error("[useVisits] merge failed", e);
      });
  }, [userId, serverMerge, queryClient]);

  // Cloud visits
  const cloudQuery = useQuery({
    queryKey: ["my-visits"],
    queryFn: () => serverGetVisits(),
    enabled: !!userId,
    staleTime: 0,
  });

  const cloudMap = useMemo<VisitMap>(() => {
    const map: VisitMap = {};
    (cloudQuery.data ?? []).forEach((v) => {
      map[v.place_id] = {
        done: v.done,
        favorite: v.favorite,
        comment: v.comment ?? "",
        personalRating: v.personal_rating ?? undefined,
      };
    });
    return map;
  }, [cloudQuery.data]);

  // Optimistic overlay: the map reacts instantly, the server catches up after.
  const [pending, setPending] = useState<VisitMap>({});

  const visits = useMemo<VisitMap>(
    () => ({ ...(userId ? cloudMap : localVisits), ...pending }),
    [userId, cloudMap, localVisits, pending],
  );

  const update = async (id: string, patch: Partial<VisitEntry>) => {
    const current = visits[id] ?? { done: false, comment: "", favorite: false };
    const next = { ...current, ...patch };

    if (userId) {
      setPending((p) => ({ ...p, [id]: next })); // optimistic
      try {
        await serverUpsert({
          data: {
            place_id: id,
            done: next.done,
            favorite: next.favorite,
            comment: next.comment.trim() || null,
            personal_rating: next.personalRating ?? null,
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["my-visits"] });
      } catch (e) {
        console.error("[useVisits] update failed", e);
        toast.error("Impossible d'enregistrer. Réessayez.");
      } finally {
        setPending((p) => {
          const rest = { ...p };
          delete rest[id];
          return rest;
        });
      }
    } else {
      setLocalVisits((prev) => {
        const base = prev[id] ?? { done: false, comment: "", favorite: false };
        const merged = { ...prev, [id]: { ...base, ...patch } };
        const entry = merged[id];
        if (!entry.done && !entry.favorite && !entry.comment.trim() && !entry.personalRating) {
          delete merged[id];
        }
        try {
          localStorage.setItem(VISITS_KEY, JSON.stringify(merged));
        } catch {
          /* ignore */
        }
        return merged;
      });
    }
  };

  return { visits, update, isLoading: cloudQuery.isLoading };
}

