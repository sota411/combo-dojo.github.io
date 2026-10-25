const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const context = {};
vm.runInNewContext(html.slice(html.indexOf("var PathGeo ="), html.indexOf("// ===== SCREENSHOT VISION")), context);
const G = context.PathGeo;
const trace = (start, from, to) => Array.from(G.dragPath(start, 5, 6, from, to));

test("straight swipes visit every crossed cell in both directions", () => {
  assert.deepEqual(trace(0, [0.5, 0.5], [5.5, 0.5]), [1, 2, 3, 4, 5]);
  assert.deepEqual(trace(5, [5.5, 0.5], [0.5, 0.5]), [4, 3, 2, 1, 0]);
  assert.deepEqual(trace(0, [0.5, 0.5], [0.5, 4.5]), [6, 12, 18, 24]);
});

test("a shallow swipe follows its actual route instead of taking a diagonal shortcut", () => {
  assert.deepEqual(trace(0, [0.5, 0.5], [2.5, 1.5]), [1, 7, 8]);
});

test("diagonal moves require passing through the narrow gap at a corner", () => {
  assert.deepEqual(trace(0, [0.5, 0.5], [1.5, 1.5]), [7]);
  assert.deepEqual(trace(14, [2.5, 2.5], [0.5, 0.5]), [7, 0]);
  assert.deepEqual(trace(0, [0.5, 0.5], [1.5, 1.2]), [1, 7]);
  assert.deepEqual(trace(0, [0.5, 0.5], [1.5, 1.49]), [7]);
});

test("the same straight gesture gives the same swaps at different event rates", () => {
  const start = [0.5, 0.5];
  for (const end of [[5.5, 0.5], [2.5, 1.5], [1.5, 1.2], [4.5, 4.5]]) {
    const expected = trace(0, start, end);
    for (const samples of [2, 5, 20, 100]) {
      let held = 0, previous = start;
      const actual = [];
      for (let i = 1; i <= samples; i++) {
        const next = start.map((v, axis) => v + (end[axis] - v) * i / samples);
        const swaps = trace(held, previous, next);
        if (swaps.length) held = swaps[swaps.length - 1];
        actual.push(...swaps); previous = next;
      }
      assert.deepEqual(actual, expected, JSON.stringify({end,samples}));
    }
  }
});

test("passing a corner between events does not force an early orthogonal swap", () => {
  assert.deepEqual(trace(0, [0.5, 0.5], [1.01, 0.99]), []);
  assert.deepEqual(trace(0, [1.01, 0.99], [1.5, 1.5]), [7]);
});

test("no movement and distant blocked drags do not create swaps", () => {
  assert.deepEqual(trace(0, [0.5, 0.5], [0.5, 0.5]), []);
  assert.deepEqual(trace(0, [4.5, 0.5], [5.5, 0.5]), []);
});

test("input outside the board is clamped without producing invalid cells", () => {
  assert.deepEqual(trace(0, [0.5, 0.5], [-4, 0.5]), []);
  assert.deepEqual(trace(0, [0.5, 0.5], [20, 0.5]), [1, 2, 3, 4, 5]);
});
