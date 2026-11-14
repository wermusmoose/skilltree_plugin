import type { Config } from "./settings";
import { Shape, shapes } from "./shapes";
export type Side = -1 | 1;
export interface TreeNode {
  id: string;
  parent: string | null;
  title: string;
  body: string;
  icon: string;
  image?: string;
  note?: string;
  tree?: string;
  color?: string;
  side?: Side;
  order: number;
  collapsed?: boolean;
  shape?: Shape;
  comment?: boolean;
  completed?: boolean;
  important?: boolean;
  task?: boolean;
  emoji?: string;
  createdAt?: string;
  updatedAt?: string;
}
export interface TreeDoc {
  version: 1;
  layout: "vertical" | "radial";
  settings?: Config;
  nodes: TreeNode[];
  camera: { x: number; y: number; zoom: number };
  panelWidth?: number;
  hideComments?: boolean;
}
export interface Point {
  x: number;
  y: number;
}
export const palette = [
  "#c084fc",
  "#38bdf8",
  "#fb923c",
  "#4ade80",
  "#f472b6",
  "#facc15",
  "#2dd4bf",
];
export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export function fresh(): TreeDoc {
  return {
    version: 1,
    layout: "vertical",
    nodes: [
      {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        id: crypto.randomUUID(),
        parent: null,
        title: "Главная тема",
        body: "",
        icon: "circle-help",
        order: 0,
      },
    ],
    camera: { x: 0, y: 0, zoom: 1 },
  };
}
export function isComment(d: TreeDoc, id: string): boolean {
  const seen = new Set<string>();
  let node = d.nodes.find((n) => n.id === id);
  while (node && !seen.has(node.id)) {
    if (typeof node.comment === "boolean") return node.comment;
    seen.add(node.id);
    node = d.nodes.find((n) => n.id === node!.parent);
  }
  return false;
}
export function children(d: TreeDoc, id: string) {
  return d.nodes
    .filter((n) => n.parent === id)
    .sort((a, b) => a.order - b.order);
}
export function subtree(d: TreeDoc, id: string): Set<string> {
  const ids = new Set([id]);
  const todo = [id];
  while (todo.length)
    for (const n of children(d, todo.pop()!))
      if (!ids.has(n.id)) {
        ids.add(n.id);
        todo.push(n.id);
      }
  return ids;
}
export function colorOf(d: TreeDoc, id: string): string {
  const map = new Map(d.nodes.map((n) => [n.id, n]));
  let n = map.get(id);
  while (n) {
    if (n.color) return n.color;
    n = n.parent ? map.get(n.parent) : undefined;
  }
  return "#a5b4fc";
}
export function addNode(
  d: TreeDoc,
  parent: string,
  colors: string[] = palette,
  icon = "circle-help",
): TreeNode {
  const p = d.nodes.find((n) => n.id === parent)!;
  p.collapsed = false;
  const cs = children(d, parent);
  const n: TreeNode = {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    id: crypto.randomUUID(),
    parent,
    title: "Новый пункт",
    body: "",
    icon,
    order: cs.length ? Math.max(...cs.map((n) => n.order)) + 1 : 0,
  };
  if (p.parent === null) {
    n.side = cs.length % 2 === 0 ? -1 : 1;
    const used = new Set(cs.map((n) => n.color));
    const pool = colors.length ? colors : palette;
    const choices = pool.filter((c) => !used.has(c));
    n.color = (choices.length ? choices : pool)[
      Math.floor(Math.random() * (choices.length || pool.length))
    ];
  }
  d.nodes.push(n);
  return n;
}
export function moveNode(
  d: TreeDoc,
  id: string,
  parent: string,
  order: number,
  side?: Side,
): boolean {
  const n = d.nodes.find((n) => n.id === id);
  if (
    !n ||
    n.parent === null ||
    !d.nodes.some((n) => n.id === parent) ||
    subtree(d, id).has(parent)
  )
    return false;
  n.parent = parent;
  n.order = order;
  if (d.nodes.find((n) => n.id === parent)!.parent === null)
    n.side = side ?? n.side ?? -1;
  else delete n.side;
  d.nodes.find((n) => n.id === parent)!.collapsed = false;
  return true;
}
export function parseDoc(raw: string): TreeDoc {
  const d = JSON.parse(raw);
  if (
    d.version !== 1 ||
    !["vertical", "radial"].includes(d.layout) ||
    !Array.isArray(d.nodes) ||
    !d.nodes.length
  )
    throw Error("Неподдерживаемый формат дерева");
  const ids = new Set<string>();
  if (
    d.panelWidth !== undefined &&
    (!Number.isFinite(d.panelWidth) || d.panelWidth < 260 || d.panelWidth > 900)
  )
    delete d.panelWidth;
  for (const n of d.nodes) {
    if (
      typeof n.id !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(n.id) ||
      ids.has(n.id) ||
      typeof n.title !== "string" ||
      typeof n.body !== "string" ||
      typeof n.icon !== "string" ||
      !Number.isFinite(n.order) ||
      (n.parent !== null && typeof n.parent !== "string")
    )
      throw Error("Повреждены данные пунктов");
    ids.add(n.id);
    if (n.shape !== undefined && !Object.hasOwn(shapes, n.shape))
      throw Error("Неизвестная форма пункта");
    for (const k of ["comment", "completed", "important", "task"] as const)
      if (n[k] !== undefined && typeof n[k] !== "boolean")
        throw Error("Некорректное состояние пункта");
    if (n.collapsed !== undefined && typeof n.collapsed !== "boolean")
      throw Error("Некорректное состояние ветки");
    for (const k of [
      "note",
      "tree",
      "image",
      "color",
      "emoji",
      "createdAt",
      "updatedAt",
    ])
      if (n[k] !== undefined && typeof n[k] !== "string")
        throw Error("Некорректное поле " + k);
    if (n.color && !/^#[\da-f]{6}$/i.test(n.color))
      throw Error("Некорректный цвет");
    if (n.side !== undefined && n.side !== 1 && n.side !== -1)
      throw Error("Некорректное направление");
  }
  const roots = d.nodes.filter((n: TreeNode) => n.parent === null);
  if (roots.length !== 1) throw Error("Должен быть один корень");
  for (const n of d.nodes)
    if (n.parent !== null && !ids.has(n.parent))
      throw Error("Не найден родитель");
  if (subtree(d, roots[0].id).size !== d.nodes.length)
    throw Error("Цикл или отсоединённая ветка");
  if (
    !d.camera ||
    ![d.camera.x, d.camera.y, d.camera.zoom].every(Number.isFinite) ||
    d.camera.zoom < 0.005 ||
    d.camera.zoom > 3
  )
    d.camera = { x: 0, y: 0, zoom: 1 };
  return d;
}
// Geometry is deliberately independent of Obsidian and of the document contents.
export type Footprint = {
  left: number;
  right: number;
  top: number;
  bottom: number;
}[];
export function layout(
  d: TreeDoc,
  spacing = { x: 144, y: 168 },
  footprints?: Map<string, Footprint>,
): Map<string, Point> {
  if (d.hideComments)
    d = {
      ...d,
      nodes: d.nodes.filter((n) => n.parent === null || !isComment(d, n.id)),
    };
  if (d.layout === "radial") return radialLayout(d, spacing, footprints);
  const root = d.nodes.find((n) => n.parent === null)!;
  const positions = new Map<string, Point>([[root.id, { x: 0, y: 0 }]]);
  const kids = new Map(d.nodes.map((n) => [n.id, children(d, n.id)]));
  const widths = new Map<string, number>();
  function measure(n: TreeNode): number {
    const cs = n.collapsed ? [] : kids.get(n.id)!;
    const w = Math.max(
      1,
      cs.reduce((a, c) => a + measure(c), 0),
    );
    widths.set(n.id, w);
    return w;
  }
  function place(n: TreeNode, left: number, depth: number, side: Side) {
    const w = widths.get(n.id)!;
    positions.set(n.id, {
      x: (left + (w - 1) / 2) * spacing.x,
      y: depth * spacing.y * side,
    });
    if (n.collapsed) return;
    let x = left;
    for (const c of kids.get(n.id)!) {
      place(c, x, depth + 1, side);
      x += widths.get(c.id)!;
    }
  }
  if (!root.collapsed)
    for (const side of [-1, 1] as Side[]) {
      const cs = kids.get(root.id)!.filter((n) => (n.side ?? -1) === side);
      const total = cs.reduce((a, n) => a + measure(n), 0);
      let left = -(total - 1) / 2;
      for (const n of cs) {
        place(n, left, 1, side);
        left += widths.get(n.id)!;
      }
    }
  // Horizontal centers can occupy half-cells (72px); levels are 168px apart.
  return positions;
}

export function edgePath(d: TreeDoc, a: Point, p: Point) {
  return d.layout === "radial"
    ? `M ${a.x} ${a.y} L ${p.x} ${p.y}`
    : `M ${a.x} ${a.y} V ${(a.y + p.y) / 2} H ${p.x} V ${p.y}`;
}
// Concentric generations. Only the crowded generation adds extra radial space.
function radialLayout(
  d: TreeDoc,
  spacing: { x: number; y: number },
  footprints?: Map<string, Footprint>,
): Map<string, Point> {
  const root = d.nodes.find((n) => n.parent === null)!,
    result = new Map<string, Point>([[root.id, { x: 0, y: 0 }]]);
  if (root.collapsed) return result;
  const kids = new Map(
    d.nodes.map((n) => [n.id, n.collapsed ? [] : children(d, n.id)]),
  );
  const angles = new Map<string, number>([[root.id, -Math.PI / 2]]);
  const boxes = (id: string): Footprint =>
    footprints?.get(id) ?? [
      {
        left: -spacing.x / 2,
        right: spacing.x / 2,
        top: -spacing.y / 2,
        bottom: spacing.y / 2,
      },
    ];
  const tau = 2 * Math.PI,
    step = spacing.y;
  let parents = [root],
    previousRadius = 0;
  while (parents.length) {
    const level = parents.flatMap((p) => kids.get(p.id)!);
    if (!level.length) break;
    const desired: number[] = [];
    const active = parents.filter((p) => kids.get(p.id)!.length);
    active.forEach((parent, index) => {
      const cs = kids.get(parent.id)!,
        angle = angles.get(parent.id)!;
      const prev =
        index === 0
          ? angles.get(active.at(-1)!.id)! - tau
          : angles.get(active[index - 1].id)!;
      const next =
        index === active.length - 1
          ? angles.get(active[0].id)! + tau
          : angles.get(active[index + 1].id)!;
      const halfSpan = Math.min(
        Math.PI / 3,
        (cs.length * spacing.x) / (2 * (previousRadius + step)),
      );
      const left = Math.max((angle + prev) / 2, angle - halfSpan),
        right = Math.min((angle + next) / 2, angle + halfSpan);
      cs.forEach((_, i) =>
        desired.push(
          cs.length === 1
            ? angle
            : left + ((i + 0.5) * (right - left)) / cs.length,
        ),
      );
    });
    if (parents[0] === root)
      level.forEach(
        (_, i) => (desired[i] = -Math.PI / 2 + (i * tau) / level.length),
      );
    let bestPoints: Point[] = [],
      bestAngles: number[] = [],
      bestRadius = Infinity;
    const clear = (points: Point[]) => {
      const occupied = [...result.entries()];
      for (let i = 0; i < points.length; i++) {
        const p = points[i],
          id = level[i].id;
        const parent = result.get(level[i].parent!)!;
        if (parent.x * (p.x - parent.x) + parent.y * (p.y - parent.y) < -1e-6)
          return false;
        for (const [other, q] of occupied)
          for (const a of boxes(id))
            for (const b of boxes(other)) {
              if (
                p.x + a.left < q.x + b.right &&
                p.x + a.right > q.x + b.left &&
                p.y + a.top < q.y + b.bottom &&
                p.y + a.bottom > q.y + b.top
              )
                return false;
            }
        occupied.push([id, p]);
      }
      return true;
    };
    const diameter = Math.max(
      ...level.map((n) => {
        const bb = boxes(n.id);
        return Math.hypot(
          Math.max(...bb.map((b) => b.right)) -
            Math.min(...bb.map((b) => b.left)),
          Math.max(...bb.map((b) => b.bottom)) -
            Math.min(...bb.map((b) => b.top)),
        );
      }),
    );
    let r = Math.max(
      previousRadius + step,
      level.length > 1 ? diameter / (2 * Math.sin(Math.PI / level.length)) : 0,
    );
    for (let attempt = 0; attempt < 2000; attempt++) {
      const gap =
        level.length > 1 ? 2 * Math.asin(Math.min(1, diameter / (2 * r))) : 0;
      const blocks: { sum: number; count: number }[] = [];
      desired.forEach((a, i) => {
        blocks.push({ sum: a - i * gap, count: 1 });
        while (blocks.length > 1) {
          const b = blocks.at(-1)!,
            a = blocks.at(-2)!;
          if (a.sum / a.count <= b.sum / b.count) break;
          blocks.pop();
          a.sum += b.sum;
          a.count += b.count;
        }
      });
      const base = blocks.flatMap((b) => Array(b.count).fill(b.sum / b.count));
      const range = Math.max(0, tau - level.length * gap),
        mid = (base[0] + base.at(-1)!) / 2;
      const aa = base.map(
        (v, i) =>
          Math.max(mid - range / 2, Math.min(mid + range / 2, v)) + i * gap,
      );
      const points = aa.map((a) => ({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
      }));
      if (clear(points)) {
        bestRadius = r;
        bestAngles = aa;
        bestPoints = points;
        break;
      }
      r += Math.max(4, Math.min(spacing.x, spacing.y) / 12);
    }
    if (!bestPoints.length) throw Error("Unable to place radial generation");
    level.forEach((n, i) => {
      result.set(n.id, bestPoints[i]);
      angles.set(n.id, bestAngles[i]);
    });
    previousRadius = bestRadius;
    parents = level;
  }
  return result;
}
