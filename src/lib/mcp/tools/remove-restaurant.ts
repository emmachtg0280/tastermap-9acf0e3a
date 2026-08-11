import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "remove_restaurant",
  title: "Remove a restaurant from my map",
  description:
    "Delete the signed-in user's saved entry (visited/favorite) for a restaurant, by its Google place id.",
  inputSchema: {
    place_id: z.string().trim().describe("Google Places place id of the restaurant."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  handler: async ({ place_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    const { error } = await supabase
      .from("user_places")
      .delete()
      .eq("user_id", ctx.getUserId())
      .eq("place_id", place_id);

    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return { content: [{ type: "text", text: `Removed ${place_id}` }] };
  },
});
