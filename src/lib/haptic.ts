export function haptic(pattern: number | number[] = 15): boolean {
  if (typeof navigator === "undefined") return false;
  if (!("vibrate" in navigator) || typeof navigator.vibrate !== "function") {
    return false;
  }
  try {
    return navigator.vibrate(pattern) ?? true;
  } catch {
    return false;
  }
}
