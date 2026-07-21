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
  personal_rating: z.number().nullable().optional(),
  comment: z.string().nullable().optional(),
});

export const getMyVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("restaurant_visits")
      .select("*");

    if (error) {
      console.error("[getMyVisits] error", error);
      throw new Error(error.message);
    }

    const parsed = visitsSchema.safeParse(data ?? []);
    if (!parsed.success) {
      console.error("[getMyVisits] parse", parsed.error);
    }

    return (data ?? []) as unknown as z.infer<typeof visitsSchema>;
  });

export const upsertVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => upsertSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("restaurant_visits")
      .upsert(
        {
          user_id: context.userId,
          place_id: data.place_id,
          done: data.done,
          favorite: data.favorite,
          personal_rating: data.personal_rating,
          comment: data.comment,
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
      .from("restaurant_visits")
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
