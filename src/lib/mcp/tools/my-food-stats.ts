import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "my_food_stats",
  title: "My food map stats",
  description:
    "Summarize the signed-in user's food map: how many restaurants they visited, how many are favorites, and their average personal rating.",
  inputSchema: {
    _unused: z.string().optional().describe("Ignored. No input required."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("user_places")
      .select("done, favorite, personal_rating");

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    const rows = data ?? [];
    const done = rows.filter((r) => r.done).length;
    const favorite = rows.filter((r) => r.favorite).length;
    const ratings = rows
      .map((r) => r.personal_rating)
      .filter((v): v is number => typeof v === "number");
    const averageRating = ratings.length
      ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
      : null;

    const stats = { total: rows.length, done, favorite, averageRating };
    return {
      content: [{ type: "text", text: JSON.stringify(stats) }],
      structuredContent: stats,
    };
  },
});
