export function revealOffset(
  position: number,
  viewport: number,
  margin: number,
): number {
  if (viewport <= 0) return 0;
  const edge = Math.min(margin, viewport / 3);
  return position < edge
    ? edge - position
    : position > viewport - edge
      ? viewport - edge - position
      : 0;
}
export const easeOut = (t: number) =>
  1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
