import type { Config } from "./settings";
import { TreeDoc, layout, type Footprint } from "./model";
export function textWidth(text: string): number {
  // Arial 12 fallback also keeps non-browser geometry deterministic.
  return Array.from(text).reduce(
    (w, c) =>
      w +
      (/[MWЖЩШЮФ]/.test(c)
        ? 10
        : /[ilI.,!| :;]/.test(c)
          ? 3.5
          : /[A-ZА-Я]/.test(c)
            ? 8
            : 6.7),
    0,
  );
}
export function labelWidthFor(d: TreeDoc, c: Config) {
  const base = Math.min(132, c.size + c.gapX - 8);
  const longest = Math.max(
    0,
    ...d.nodes.flatMap((n) => n.title.split(/\s+/).map(textWidth)),
  );
  return Math.max(base, Math.min(base + 32, 168, longest + 16));
}
export function wrapTitle(
  text: string,
  width: number,
  measure = textWidth,
): string[] {
  const lines: string[] = [];
  let line = "";
  const max = width - 16;
  for (const word of text
    .replace(/\u00ad/g, "")
    .split(/\s+/)
    .filter(Boolean)) {
    if (line && measure(line + " " + word) <= max) {
      line += " " + word;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    let rest = word;
    while (measure(rest) > max) {
      let count = 1;
      while (
        count < rest.length &&
        measure(rest.slice(0, count + 1) + "-") <= max
      )
        count++;
      lines.push(rest.slice(0, count) + "-");
      rest = rest.slice(count);
    }
    line = rest;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
export function displayTitle(text: string, width: number) {
  return text
    .split(/(\s+)/)
    .map((word) => {
      if (textWidth(word) <= width - 16) return word;
      return wrapTitle(word, width)
        .join("\u00ad")
        .replace(/-\u00ad/g, "\u00ad");
    })
    .join("");
}
export function treeGeometry(
  d: TreeDoc,
  c: Config,
  expanded = false,
  measure = textWidth,
) {
  const labelWidth = labelWidthFor(d, c);
  const labels = new Map(
    d.nodes.map((n) => [n.id, wrapTitle(n.title, labelWidth, measure)]),
  );
  const visible = layout(d, { x: 1, y: 1 });
  const labelHeight = expanded
    ? Math.max(
        ...d.nodes
          .filter((n) => visible.has(n.id))
          .map((n) => labels.get(n.id)!.length * 16 + 8),
      )
    : Math.max(
        ...d.nodes
          .filter((n) => visible.has(n.id))
          .map((n) => Math.min(2, labels.get(n.id)!.length) * 16 + 8),
      );
  const x =
    d.layout === "radial"
      ? Math.max(c.size * c.rootScale, labelWidth) +
        8 +
        Math.min(12, c.gapX / 4)
      : Math.max(c.size + c.gapX, labelWidth + 8);
  const y =
    d.layout === "radial"
      ? c.gapY > 0
        ? c.gapY
        : 1
      : Math.max(
          c.size * c.rootScale + c.gapY,
          c.size * c.rootScale + labelHeight + 24,
        );
  const footprints = new Map<string, Footprint>(
    d.nodes.map((n) => {
      const half = (c.size * (n.parent === null ? c.rootScale : 1)) / 2;
      const height =
        (expanded
          ? labels.get(n.id)!.length
          : Math.min(2, labels.get(n.id)!.length)) *
          16 +
        8;
      const padX = 4 + Math.min(6, c.gapX / 8),
        padY = 4 + Math.min(6, c.gapY / 20);
      return [
        n.id,
        [
          {
            left: -half - padX,
            right: half + padX,
            top: -half - padY,
            bottom: half + padY,
          },
          {
            left: -labelWidth / 2 - padX,
            right: labelWidth / 2 + padX,
            top: half + 8 - padY,
            bottom: half + 8 + height + padY,
          },
        ],
      ];
    }),
  );
  return {
    positions: layout(d, { x, y }, footprints),
    labelWidth,
    labelHeight,
    labels,
    footprints,
  };
}
