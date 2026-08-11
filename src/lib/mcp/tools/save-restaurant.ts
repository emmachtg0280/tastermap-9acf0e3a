import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "save_restaurant",
  title: "Save or update a restaurant",
  description:
    "Mark a restaurant (by its Google place id) as visited and/or favorite for the signed-in user, with an optional personal rating and comment.",
  inputSchema: {
    place_id: z.string().trim().describe("Google Places place id of the restaurant."),
    done: z.boolean().optional().describe("Whether the user has visited it."),
    favorite: z.boolean().optional().describe("Whether the user marks it as favorite."),
    personal_rating: z
      .number()
      .nullable()
      .optional()
      .describe("Personal rating from 0 to 5."),
    comment: z.string().nullable().optional().describe("Personal note about the place."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("restaurant_visits")
      .upsert(
        {
          user_id: ctx.getUserId(),
          place_id: input.place_id,
          done: input.done ?? false,
          favorite: input.favorite ?? false,
          personal_rating: input.personal_rating ?? null,
          comment: input.comment ?? null,
        },
        { onConflict: "user_id,place_id" },
      )
      .select();

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data?.[0] ?? {}) }],
      structuredContent: { row: data?.[0] ?? null },
    };
  },
});
