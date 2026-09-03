import { describe, expect, it } from "vitest";

import { clusterIcon, markerIcon, type MarkerState } from "./map-markers";

const svg = (url: string) => decodeURIComponent(url.split(",")[1]);

describe("food marker visual contract", () => {
  it.each<MarkerState>(["new", "saved", "done"])(
    "keeps %s identity when selected, and restores the cached unselected marker",
    (state) => {
      const input = { cuisine: "japanese" as const, state, active: false, isNew: false };
      const resting = markerIcon(input);
      const selected = markerIcon({ ...input, active: true });
      expect(svg(selected.url)).toContain("stroke='#ff8642'");
      expect(svg(selected.url)).toContain("stroke='#9b3c00'");
      if (state !== "new") {
        const badgeColor = state === "saved" ? "#a8eb12" : "#ffd426";
        expect(svg(selected.url)).toContain(`fill='${badgeColor}'`);
        expect(svg(resting.url)).toContain(`fill='${badgeColor}'`);
      }
      expect(selected.size).toBeGreaterThan(resting.size);
      expect(selected.size).toBeLessThanOrEqual(46);
      expect(markerIcon(input)).toBe(resting);
    },
  );

  it("retains the existing cuisine artwork in every personal state", () => {
    for (const state of ["new", "saved", "done"] as const) {
      const visual = markerIcon({
        cuisine: "italian",
        state,
        active: false,
        isNew: true,
        dataUrl: "data:image/png;base64,Zm9vZA==",
      });
      expect(svg(visual.url)).toContain("data:image/png;base64,Zm9vZA==");
      expect(visual.height).toBe(visual.size + 4);
    }
  });

  it("preserves cluster count, bounded size and discovered-ratio distinction", () => {
    const empty = clusterIcon(220, 0);
    const half = clusterIcon(220, 0.5);
    expect(svg(half.url)).toContain(">220</text>");
    expect(half.size).toBeLessThanOrEqual(56);
    expect(half.url).not.toBe(empty.url);
    expect(clusterIcon(220, 0.5)).toBe(half);
  });
});
