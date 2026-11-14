import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, addNode, layout, parseDoc } from "../src/model";
test("custom palette and icon apply only to new nodes", () => {
  const d = fresh();
  const a = addNode(d, d.nodes[0].id, ["#123456"], "chess-knight");
  assert.equal(a.color, "#123456");
  assert.equal(a.icon, "chess-knight");
  const b = addNode(d, a.id, ["#ffffff"], "book-open");
  assert.equal(b.color, undefined);
  assert.equal(a.icon, "chess-knight");
  assert.equal(b.icon, "book-open");
});
test("custom spacing and per-node shapes roundtrip", () => {
  const d = fresh();
  const a = addNode(d, d.nodes[0].id);
  a.shape = "hexagon";
  const b = addNode(d, d.nodes[0].id);
  b.shape = "star";
  assert.deepEqual(parseDoc(JSON.stringify(d)), d);
  assert.equal(layout(d, { x: 200, y: 250 }).get(a.id)?.y, -250);
  assert.throws(() =>
    parseDoc(
      JSON.stringify({
        ...d,
        nodes: d.nodes.map((n) => ({ ...n, shape: "unknown" })),
      }),
    ),
  );
});
