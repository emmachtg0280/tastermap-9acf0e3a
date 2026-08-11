import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_restaurants",
  title: "List my restaurants",
  description:
    "List the restaurants the signed-in user has marked as visited (done) and/or favorite on their food map.",
  inputSchema: {
    filter: z
      .enum(["all", "done", "favorite"])
      .optional()
      .describe("Which entries to return. Defaults to all."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ filter }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };

    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("user_places")
      .select("place_id, done, favorite, personal_rating, comment, updated_at")
      .order("updated_at", { ascending: false });

    if (filter === "done") query = query.eq("done", true);
    if (filter === "favorite") query = query.eq("favorite", true);

    const { data, error } = await query;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { rows: data ?? [] },
    };
  },
});
