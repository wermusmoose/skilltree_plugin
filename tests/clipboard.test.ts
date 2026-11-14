import { test } from "node:test";
import assert from "node:assert/strict";
import { fresh, addNode } from "../src/model";
import { copyBranches, pasteBranches } from "../src/node-clipboard";
test("multiple selected branches exclude duplicate descendants and preserve sources", () => {
  const d = fresh(),
    a = addNode(d, d.nodes[0].id),
    b = addNode(d, a.id),
    c = addNode(d, d.nodes[0].id);
  const saved = JSON.stringify(d);
  const copied = copyBranches(d, [a.id, b.id, c.id]);
  assert.equal(copied.length, 3);
  assert.equal(copied.filter((n) => n.parent === null).length, 2);
  assert.equal(JSON.stringify(d), saved);
  pasteBranches(d, c.id, copied);
  assert.equal(new Set(d.nodes.map((n) => n.id)).size, 7);
  assert.equal(d.nodes.filter((n) => n.parent === c.id).length, 2);
});
