import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
function color(token: string): string {
  const value = css.match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1];
  if (!value) throw new Error(`Missing color token ${token}`);
  const alias = value.match(/^var\(--(.+)\)$/);
  return alias ? color(alias[1]) : value;
}
function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/../g)!
    .map((v) => {
      const channel = parseInt(v, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

describe("foundation text contrast", () => {
  it.each([
    ["foreground", "background"],
    ["primary-foreground", "primary"],
    ["muted-foreground", "background"],
    ["muted-foreground", "muted"],
    ["brand-ink", "background"],
    ["saved-foreground", "saved-surface"],
    ["visited-foreground", "visited-surface"],
    ["selected-foreground", "background"],
    ["destructive-foreground", "destructive"],
  ])("%s on %s meets WCAG AA for normal text", (foreground, background) => {
    const values = [luminance(color(foreground)), luminance(color(background))].sort(
      (a, b) => b - a,
    );
    expect((values[0] + 0.05) / (values[1] + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
