import { createServerFn } from "@tanstack/react-start";

export type HypeStats = Record<string, { done: number; favorite: number; score: number }>;

export const getHypeStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("restaurant_visits")
    .select("place_id, done, favorite, updated_at")
    .gte("updated_at", since);
  if (error) {
    console.error("[getHypeStats] error", error);
    return {} as HypeStats;
  }
  const stats: HypeStats = {};
  for (const row of data ?? []) {
    const s = stats[row.place_id] ?? { done: 0, favorite: 0, score: 0 };
    if (row.done) s.done += 1;
    if (row.favorite) s.favorite += 1;
    s.score = s.done + s.favorite * 2;
    stats[row.place_id] = s;
  }
  return stats;
});
