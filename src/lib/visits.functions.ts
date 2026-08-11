import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const visitsSchema = z.array(
  z.object({
    id: z.string(),
    user_id: z.string(),
    place_id: z.string(),
    done: z.boolean(),
    favorite: z.boolean(),
    saved: z.boolean().optional(),
    visited_at: z.string().nullable().optional(),
    personal_rating: z.number().nullable().optional(),
    comment: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

const upsertSchema = z.object({
  place_id: z.string(),
  done: z.boolean().optional(),
  favorite: z.boolean().optional(),
  saved: z.boolean().optional(),
  personal_rating: z.number().nullable().optional(),
  comment: z.string().nullable().optional(),
});

export const getMyVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_places")
      .select(
        "id, user_id, place_id, visited, favorite, saved, visited_at, personal_rating, comment, created_at, updated_at",
      );

    if (error) {
      console.error("[getMyVisits] error", error);
      throw new Error(error.message);
    }

    // The UI keeps the historical `done` naming; the column is `visited`.
    const rows = (data ?? []).map(({ visited, ...rest }) => ({
      ...rest,
      done: visited,
    }));

    const parsed = visitsSchema.safeParse(rows);
    if (!parsed.success) {
      console.error("[getMyVisits] parse", parsed.error);
    }

    return rows as unknown as z.infer<typeof visitsSchema>;
  });

export const upsertVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => upsertSchema.parse(data))
  .handler(async ({ context, data }) => {
    // Merge with the existing row: `visited`, `saved` and `favorite` are
    // independent states, so an update to one must not reset the others.
    const { data: existing } = await context.supabase
      .from("user_places")
      .select("visited, saved, favorite, visited_at, personal_rating, comment")
      .eq("user_id", context.userId)
      .eq("place_id", data.place_id)
      .maybeSingle();

    const visited = data.done ?? existing?.visited ?? false;
    const visitedAt = visited
      ? (existing?.visited_at ?? new Date().toISOString())
      : null;

    const { error } = await context.supabase.from("user_places").upsert(
      {
        user_id: context.userId,
        place_id: data.place_id,
        visited,
        visited_at: visitedAt,
        favorite: data.favorite ?? existing?.favorite ?? false,
        saved: data.saved ?? existing?.saved ?? false,
        personal_rating:
          data.personal_rating !== undefined
            ? data.personal_rating
            : (existing?.personal_rating ?? null),
        comment:
          data.comment !== undefined ? data.comment : (existing?.comment ?? null),
      },
      { onConflict: "user_id,place_id" },
    );

    if (error) {
      console.error("[upsertVisit] error", error);
      throw new Error(error.message);
    }

    return { ok: true };
  });


export const deleteVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ place_id: z.string() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("user_places")
      .delete()
      .eq("user_id", context.userId)
      .eq("place_id", data.place_id);

    if (error) {
      console.error("[deleteVisit] error", error);
      throw new Error(error.message);
    }

    return { ok: true };
  });

export type Visit = z.infer<typeof visitsSchema>[number];
