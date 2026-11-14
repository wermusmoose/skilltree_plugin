import { test } from "node:test";
import assert from "node:assert/strict";
import { revealOffset, easeOut } from "../src/motion";
test("camera shifts only far enough to reveal edge nodes", () => {
  assert.equal(revealOffset(400, 800, 100), 0);
  assert.equal(revealOffset(750, 800, 100), -50);
  assert.equal(revealOffset(20, 800, 100), 80);
  assert.equal(revealOffset(0, 0, 100), 0);
  assert.equal(revealOffset(40, 120, 100), 0);
});
test("motion easing starts at source, ends at target, progresses monotonically", () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  let previous = 0;
  for (let i = 1; i <= 20; i++) {
    const t = easeOut(i / 20);
    assert.ok(t >= previous && t <= 1);
    previous = t;
  }
});
