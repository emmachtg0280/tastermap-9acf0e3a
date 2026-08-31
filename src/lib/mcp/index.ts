import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyRestaurants from "./tools/list-my-restaurants";
import saveRestaurant from "./tools/save-restaurant";
import removeRestaurant from "./tools/remove-restaurant";
import myFoodStats from "./tools/my-food-stats";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "remix-of-french-food-finder",
  title: "Remix of French Food Finder",
  version: "0.1.0",
  instructions:
    "Tools for the user's personal food map. Use `list_my_restaurants` to read visited/favorite places, `save_restaurant` to mark a place visited or favorite (Google place id required), `remove_restaurant` to delete an entry, and `my_food_stats` for a summary.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMyRestaurants, saveRestaurant, removeRestaurant, myFoodStats],
});
