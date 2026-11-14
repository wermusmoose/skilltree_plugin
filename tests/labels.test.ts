import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, addNode } from "../src/model";
import { treeGeometry, wrapTitle, textWidth } from "../src/labels";
test("full export labels preserve every word and leave room for adjacent labels", () => {
  const d = fresh();
  const titles = [
    "Очень длинный текст ".repeat(8).trim(),
    "Самое легкое вайбкодерское",
    "Сверхдлинноенепрерывноесловобезпробелов",
  ];
  for (const title of titles) addNode(d, d.nodes[0].id).title = title;
  const c = { size: 80, gapX: 0, gapY: 56, rootScale: 1.2 } as any;
  for (const mode of ["vertical", "radial"] as const) {
    d.layout = mode;
    const g = treeGeometry(d, c, true);
    const rectangles = d.nodes.map((n) => {
      const p = g.positions.get(n.id)!;
      const lines = g.labels.get(n.id)!;
      assert.equal(
        lines.join("").replace(/[-\s]/g, ""),
        n.title.replace(/\s/g, ""),
      );
      assert.ok(lines.every((l) => textWidth(l) <= g.labelWidth - 16 + 0.01));
      return {
        left: p.x - g.labelWidth / 2,
        right: p.x + g.labelWidth / 2,
        top: p.y - 48,
        bottom: p.y + 48 + 8 + lines.length * 16 + 8,
      };
    });
    for (let i = 0; i < rectangles.length; i++)
      for (let j = i + 1; j < rectangles.length; j++) {
        const a = rectangles[i],
          b = rectangles[j];
        assert.ok(
          a.right <= b.left ||
            b.right <= a.left ||
            a.bottom <= b.top ||
            b.bottom <= a.top,
        );
      }
  }
  assert.ok(
    wrapTitle("Сверхдлинноенепрерывноесловобезпробелов", 90).some((l) =>
      l.endsWith("-"),
    ),
  );
});

test("fourteen first branches use compact radial clearances instead of rectangular level gaps", () => {
  const d = fresh();
  d.layout = "radial";
  for (let i = 0; i < 14; i++) addNode(d, d.nodes[0].id);
  const c = { size: 80, gapX: 18, gapY: 88, rootScale: 1.2 } as any;
  const g = treeGeometry(d, c);
  const first = d.nodes[1],
    p = g.positions.get(first.id)!;
  assert.ok(
    Math.hypot(p.x, p.y) < 400,
    "first circle should not inherit 184px row clearance",
  );
  assertFootprintsClear(g);
});

function assertFootprintsClear(g: ReturnType<typeof treeGeometry>) {
  const ids = [...g.positions.keys()];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const p = g.positions.get(ids[i])!,
        q = g.positions.get(ids[j])!;
      for (const a of g.footprints.get(ids[i])!)
        for (const b of g.footprints.get(ids[j])!)
          assert.ok(
            p.x + a.right <= q.x + b.left ||
              q.x + b.right <= p.x + a.left ||
              p.y + a.bottom <= q.y + b.top ||
              q.y + b.bottom <= p.y + a.top,
            "icons and labels must not overlap",
          );
    }
}

test("adding branches from 9 to 48 avoids odd/even ring jumps and keeps captions clear", () => {
  const d = fresh();
  d.layout = "radial";
  const c = { size: 80, gapX: 18, gapY: 88, rootScale: 1.2 } as any;
  let last = 0;
  for (let count = 1; count <= 48; count++) {
    addNode(d, d.nodes[0].id);
    const g = treeGeometry(d, c),
      p = g.positions.get(d.nodes[1].id)!;
    const radius = Math.hypot(p.x, p.y);
    if (count >= 9)
      assert.ok(
        radius >= last && radius - last < 40,
        `radius jump at ${count}: ${radius - last}`,
      );
    assertFootprintsClear(g);
    last = radius;
  }
});

test("individual footprints handle mixed captions, root sizes, descendants and export", () => {
  for (const expanded of [false, true])
    for (const rootScale of [1, 1.2, 2]) {
      const d = fresh();
      d.layout = "radial";
      for (let i = 0; i < 17; i++) {
        const n = addNode(d, d.nodes[0].id);
        if (i % 3 === 0) n.title = "Очень длинный заголовок ".repeat(3);
        if (i % 4 === 0) addNode(d, n.id);
      }
      assertFootprintsClear(
        treeGeometry(
          d,
          { size: 80, gapX: 18, gapY: 88, rootScale } as any,
          expanded,
        ),
      );
    }
});

test("dense multilevel trees keep local edges compact without footprint collisions", async () => {
  const { readFileSync } = await import("node:fs");
  const samples = JSON.parse(
    readFileSync(
      new URL("./fixtures/dense-radial.json", import.meta.url),
      "utf8",
    ),
  );
  for (const s of samples) {
    const before = JSON.stringify(s.doc),
      g = treeGeometry(s.doc, s.config);
    assertFootprintsClear(g);
    for (const n of s.doc.nodes) {
      if (!n.parent || !g.positions.has(n.id) || !g.positions.has(n.parent))
        continue;
      const p = g.positions.get(n.id)!,
        q = g.positions.get(n.parent)!;
      assert.ok(
        Math.hypot(p.x - q.x, p.y - q.y) < 1800,
        "descendant must not escape into a narrow inherited sector",
      );
    }
    assert.equal(JSON.stringify(s.doc), before);
  }
});
