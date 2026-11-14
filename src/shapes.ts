export const shapes = {
  circle: "Круг",
  pentagon: "Пятиугольник",
  hexagon: "Шестиугольник",
  square: "Скруглённый квадрат",
  star: "Мягкая звезда",
  seal: "Волнистая печать",
  star6: "Шестилучевая звезда",
  cushion: "Подушка",
  spark: "Четырёхлучевая звезда",
};
export type Shape = keyof typeof shapes;
export function shapeSVG(kind: Shape): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("bt-shape");
  const tag =
    kind === "circle"
      ? "circle"
      : kind === "square"
        ? "rect"
        : kind === "seal" || kind === "cushion"
          ? "path"
          : "polygon";
  const outline = document.createElementNS(ns, tag);
  let attrs: Record<string, string>;
  if (kind === "circle") attrs = { cx: "50", cy: "50", r: "46" };
  else if (kind === "square")
    attrs = { x: "7", y: "7", width: "86", height: "86", rx: "12" };
  else if (kind === "cushion")
    attrs = {
      d: "M 9 9 Q 30 16 50 21 Q 70 16 91 9 Q 84 30 79 50 Q 84 70 91 91 Q 70 84 50 79 Q 30 84 9 91 Q 16 70 21 50 Q 16 30 9 9 Z",
    };
  else if (kind === "seal") {
    const pts = Array.from({ length: 120 }, (_, i) => {
      const a = (i * Math.PI) / 60,
        r = 43 + 3 * Math.cos(a * 10);
      return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`;
    });
    attrs = { d: "M " + pts.join(" L ") + " Z" };
  } else {
    const count =
      kind === "pentagon"
        ? 5
        : kind === "hexagon"
          ? 6
          : kind === "star6"
            ? 12
            : kind === "spark"
              ? 8
              : 16;
    const alternating = !["pentagon", "hexagon"].includes(kind);
    attrs = {
      points: Array.from({ length: count }, (_, i) => {
        const a = (i * 2 * Math.PI) / count - Math.PI / 2;
        const r =
          alternating && i % 2
            ? kind === "spark"
              ? 25
              : kind === "star6"
                ? 34
                : 37
            : 46;
        return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r}`;
      }).join(" "),
    };
  }
  for (const [key, value] of Object.entries(attrs))
    outline.setAttribute(key, value);
  svg.appendChild(outline);
  return svg;
}
export function shapeChoices(
  parent: HTMLElement,
  selected: Shape,
  pick: (s: Shape) => void,
) {
  const grid = parent.createDiv({ cls: "bt-shape-grid" });
  for (const [value, label] of Object.entries(shapes)) {
    const b = grid.createEl("button", {
      attr: { "aria-label": label, "aria-pressed": String(selected === value) },
    });
    b.appendChild(shapeSVG(value as Shape));
    b.createSpan({ text: label });
    b.onclick = () => pick(value as Shape);
  }
  return grid;
}
