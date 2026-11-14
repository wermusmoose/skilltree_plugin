import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fresh,
  addNode,
  children,
  subtree,
  moveNode,
  layout,
  parseDoc,
  colorOf,
} from "../src/model";
test("first generation alternates and all descendants are laid out on the grid", () => {
  const d = fresh(),
    r = d.nodes[0];
  for (let i = 0; i < 8; i++) {
    const a = addNode(d, r.id);
    assert.equal(a.side, i % 2 ? 1 : -1);
    for (let j = 0; j < 3; j++) addNode(d, a.id);
  }
  const p = layout(d);
  assert.equal(p.size, d.nodes.length);
  assert.equal(
    new Set([...p.values()].map((p) => `${p.x},${p.y}`)).size,
    d.nodes.length,
  );
  for (const a of p.values()) {
    assert.equal(Math.abs(a.x % 72), 0);
    assert.equal(Math.abs(a.y % 168), 0);
  }
});
test("moving a subtree forbids cycles and moves descendants together", () => {
  const d = fresh(),
    r = d.nodes[0],
    a = addNode(d, r.id),
    b = addNode(d, a.id),
    c = addNode(d, r.id);
  assert.equal(moveNode(d, a.id, b.id, 0), false);
  assert.equal(moveNode(d, r.id, c.id, 0), false);
  assert.equal(moveNode(d, a.id, c.id, 0), true);
  assert.equal(b.parent, a.id);
  assert.equal(subtree(d, c.id).size, 3);
  assert.doesNotThrow(() => parseDoc(JSON.stringify(d)));
});
test("collapse preserves content and deletion removes precisely the subtree", () => {
  const d = fresh(),
    r = d.nodes[0],
    a = addNode(d, r.id),
    b = addNode(d, a.id),
    c = addNode(d, r.id);
  b.body = "Keep me";
  a.collapsed = true;
  assert.equal(layout(d).has(b.id), false);
  assert.equal(subtree(d, a.id).size, 2);
  a.collapsed = false;
  assert.equal(layout(d).has(b.id), true);
  const gone = subtree(d, a.id);
  d.nodes = d.nodes.filter((n) => !gone.has(n.id));
  assert.deepEqual(
    children(d, r.id).map((n) => n.id),
    [c.id],
  );
});
test("color inheritance changes on reparent, explicit overrides survive", () => {
  const d = fresh(),
    r = d.nodes[0],
    a = addNode(d, r.id),
    b = addNode(d, r.id),
    c = addNode(d, a.id),
    e = addNode(d, c.id);
  a.color = "#112233";
  b.color = "#aabbcc";
  assert.equal(colorOf(d, e.id), a.color);
  moveNode(d, c.id, b.id, 0);
  assert.equal(colorOf(d, e.id), b.color);
  c.color = "#ffffff";
  assert.equal(colorOf(d, e.id), "#ffffff");
  delete c.color;
  assert.equal(colorOf(d, e.id), b.color);
});
test("format roundtrip and malformed input are safe", () => {
  const d = fresh(),
    a = addNode(d, d.nodes[0].id);
  a.body = "Привет\n**Markdown**";
  a.note = "Папка/Заметка.md";
  assert.deepEqual(parseDoc(JSON.stringify(d)), d);
  assert.throws(() => parseDoc("{"));
  assert.throws(() => parseDoc(JSON.stringify({ ...d, version: 9 })));
  const broken = structuredClone(d);
  broken.nodes[1].parent = broken.nodes[1].id;
  assert.throws(() => parseDoc(JSON.stringify(broken)));
  const duplicate = structuredClone(d);
  duplicate.nodes.push(duplicate.nodes[0]);
  assert.throws(() => parseDoc(JSON.stringify(duplicate)));
});

test("radial layout uses evenly spaced first branches and preserves structure when switching", () => {
  for (const count of [1, 2, 3, 4, 6, 8]) {
    const d = fresh();
    d.layout = "radial";
    const root = d.nodes[0];
    const branches = Array.from({ length: count }, () => addNode(d, root.id));
    for (const b of branches) {
      const child = addNode(d, b.id);
      addNode(d, child.id);
      addNode(d, b.id);
    }
    const before = d.nodes.map((n) => [n.id, n.parent]);
    const p = layout(d, { x: 120, y: 160 });
    const radii = branches.map((n) =>
      Math.hypot(p.get(n.id)!.x, p.get(n.id)!.y),
    );
    assert.ok(radii.every((r) => Math.abs(r - radii[0]) < 1e-5));
    branches.forEach((n, i) => {
      const point = p.get(n.id)!;
      assert.ok(
        Math.abs(
          point.x -
            Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / count) * radii[i],
        ) < 1e-5,
      );
    });
    const points = [...p.values()];
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++)
        assert.ok(
          Math.abs(points[i].x - points[j].x) >= 119.99 ||
            Math.abs(points[i].y - points[j].y) >= 159.99,
        );
    assert.equal(parseDoc(JSON.stringify(d)).layout, "radial");
    d.layout = "vertical";
    layout(d);
    assert.deepEqual(
      d.nodes.map((n) => [n.id, n.parent]),
      before,
    );
    d.layout = "radial";
    branches[0].collapsed = true;
    assert.equal(layout(d).size, d.nodes.length - 3);
  }
});

test("crowded descendants never inflate the root ring or unrelated first branches", () => {
  const d = fresh();
  d.layout = "radial";
  const first = Array.from({ length: 30 }, () => addNode(d, d.nodes[0].id));
  const spacing = { x: 120, y: 184 };
  const original = layout(d, spacing);
  for (let i = 0; i < 20; i++) {
    const child = addNode(d, first[0].id);
    for (let j = 0; j < 3; j++) addNode(d, child.id);
  }
  const before = JSON.stringify(d),
    p = layout(d, spacing);
  assert.equal(JSON.stringify(d), before);
  for (const n of first) assert.deepEqual(p.get(n.id), original.get(n.id));
  const points = [...p.values()];
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      assert.ok(
        Math.abs(points[i].x - points[j].x) >= 119.999 ||
          Math.abs(points[i].y - points[j].y) >= 183.999,
      );
  assert.deepEqual(layout(d, spacing), p, "deterministic positions");
  first[0].collapsed = true;
  const collapsed = layout(d, spacing);
  for (const n of first)
    assert.deepEqual(collapsed.get(n.id), original.get(n.id));
});
test("a single chain grows near its parent rather than multiplying a global ring", () => {
  const d = fresh();
  d.layout = "radial";
  let parent = d.nodes[0];
  for (let i = 0; i < 40; i++) parent = addNode(d, parent.id);
  const positions = layout(d, { x: 120, y: 184 });
  for (const n of d.nodes) {
    const p = positions.get(n.id)!;
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    if (n.parent) {
      const a = positions.get(n.parent)!;
      assert.ok(Math.hypot(p.x - a.x, p.y - a.y) < 185);
    }
  }
});

test("crowded adjacent branches retain ordered sibling fans without crossed edges", () => {
  const d = fresh();
  d.layout = "radial";
  const roots = Array.from({ length: 13 }, () => addNode(d, d.nodes[0].id));
  const yellow = Array.from({ length: 7 }, () => addNode(d, roots[3].id));
  for (let i = 0; i < 4; i++) addNode(d, yellow[3].id);
  for (let i = 0; i < 6; i++) addNode(d, roots[5].id);
  const p = layout(d, { x: 108.5, y: 152.8 });
  for (const parent of d.nodes) {
    if (parent.parent === null) continue;
    const cs = d.nodes.filter((n) => n.parent === parent.id),
      a = p.get(parent.id)!;
    const distances = cs.map((n) => {
      const b = p.get(n.id)!;
      return Math.hypot(b.x, b.y);
    });
    assert.ok(
      distances.every((v) => Math.abs(v - distances[0]) < 1e-6),
      "siblings share distance from root",
    );
  }
  const edges = d.nodes
    .filter((n) => n.parent)
    .map((n) => ({ a: n.parent!, b: n.id }));
  const cross = (a: any, b: any, c: any) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < edges.length; i++)
    for (let j = i + 1; j < edges.length; j++) {
      const e = edges[i],
        f = edges[j];
      if ([e.a, e.b].some((id) => id === f.a || id === f.b)) continue;
      const a = p.get(e.a)!,
        b = p.get(e.b)!,
        c = p.get(f.a)!,
        z = p.get(f.b)!;
      assert.ok(
        !(
          cross(a, b, c) * cross(a, b, z) < -1e-6 &&
          cross(c, z, a) * cross(c, z, b) < -1e-6
        ),
        "branches must not cross",
      );
    }
});

test("regression: mixed 55-node tree has no crossing edges without long escapes", async () => {
  const { readFileSync } = await import("node:fs");
  const s = JSON.parse(
    readFileSync(
      new URL("./fixtures/radial-crossings.json", import.meta.url),
      "utf8",
    ),
  );
  const p = layout(s.doc, s.spacing, new Map(s.footprints));
  const edges = s.doc.nodes.filter(
    (n: any) => n.parent !== null && p.has(n.id) && p.has(n.parent),
  );
  const cross = (a: any, b: any, c: any) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i],
      a = p.get(e.id)!,
      b = p.get(e.parent)!;
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1400);
    for (let j = i + 1; j < edges.length; j++) {
      const f = edges[j];
      if ([e.id, e.parent].some((id) => id === f.id || id === f.parent))
        continue;
      const c = p.get(f.id)!,
        z = p.get(f.parent)!;
      assert.ok(
        !(
          cross(a, b, c) * cross(a, b, z) < -1e-6 &&
          cross(c, z, a) * cross(c, z, b) < -1e-6
        ),
      );
    }
  }
});

test("concentric rings share depth radii and reset to the configured step after crowding", () => {
  const d = fresh();
  d.layout = "radial";
  const root = d.nodes[0];
  const first = Array.from({ length: 20 }, () => addNode(d, root.id));
  const next = addNode(d, first[0].id);
  const last = addNode(d, next.id);
  const before = JSON.stringify(d),
    p = layout(d, { x: 10, y: 40 });
  const radius = (id: string) => Math.hypot(p.get(id)!.x, p.get(id)!.y);
  const r = radius(first[0].id);
  assert.ok(r > 40);
  first.forEach((n) => assert.ok(Math.abs(radius(n.id) - r) < 1e-6));
  assert.ok(Math.abs(radius(next.id) - r - 40) < 1e-6);
  assert.ok(Math.abs(radius(last.id) - radius(next.id) - 40) < 1e-6);
  assert.equal(JSON.stringify(d), before);
});

test("uncrowded concentric generations follow the exact radial step", () => {
  const d = fresh();
  d.layout = "radial";
  const a = addNode(d, d.nodes[0].id),
    b = addNode(d, a.id),
    c = addNode(d, b.id);
  const p = layout(d, { x: 20, y: 300 });
  [a, b, c].forEach((n, i) =>
    assert.ok(
      Math.abs(Math.hypot(p.get(n.id)!.x, p.get(n.id)!.y) - 300 * (i + 1)) <
        1e-6,
    ),
  );
});
