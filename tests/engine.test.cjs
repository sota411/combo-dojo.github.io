const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const context = {};
vm.runInNewContext(html.slice(html.indexOf("var Engine ="), html.indexOf("// ===== ROUTE GEOMETRY")), context);
const E = context.Engine;

test("fresh random boards have no matches for the supported sizes and match lengths", () => {
  for (const [rows, cols] of [[4, 5], [5, 6], [6, 7], [10, 6]]) {
    for (const match of [2, 3, 4, 5]) {
      for (let seed = 1; seed <= 20; seed++) {
        for (const colors of [[0, 1], [0, 1, 2, 3, 4, 5]]) {
          const board = E.randomBoard(rows, cols, match, E.rng(seed), null, colors);
          assert.ok(board);
          assert.equal(board.length, rows * cols);
          assert.equal(E.findGroups(board, rows, cols, match, true).length, 0);
        }
      }
    }
  }
});

test("endless refill preserves surviving orbs and fills only holes without matches", () => {
  const remaining = [
    1, -1, 1, 0, 1, 3,
    0, -1, 3, 4, 4, 2,
    4, -1, 3, 4, 2, 2,
    4, 2, 2, 1, 4, 3,
    2, 2, 0, 2, 3, 4
  ];
  remaining[0] |= E.THORN | E.NOCLR | E.SDARK | E.WEAK;
  remaining[5] = E.STONE;
  const original = remaining.slice();
  for (let seed = 1; seed <= 100; seed++) {
    const board = E.randomBoard(5, 6, 3, E.rng(seed), null, [0, 1, 2, 3, 4, 5], remaining);
    assert.ok(board);
    assert.equal(E.findGroups(board, 5, 6, 3, true).length, 0);
    remaining.forEach((orb, i) => {
      if (orb >= 0) assert.equal(board[i], orb);
      else assert.ok(board[i] >= 0 && board[i] <= 5);
    });
  }
  assert.deepEqual(remaining, original);
});

test("single-colour random generation fails instead of returning ready-made matches", () => {
  assert.equal(E.randomBoard(5, 6, 3, E.rng(1), null, [0]), null);
  assert.equal(E.randomBoard(5, 6, 3, E.rng(1), [1, 0], [0, 1]), null);
});

test("weighted generation uses only colours with a positive weight", () => {
  const board = E.randomBoard(5, 6, 3, E.rng(1), [0, 0.25, 0.75], [0, 1, 2]);
  assert.ok(board);
  assert.ok(board.every(orb => orb === 1 || orb === 2));
  assert.equal(E.findGroups(board, 5, 6, 3, true).length, 0);
});

test("an impossible refill fails without changing any surviving orbs", () => {
  const remaining = [0, 0, -1, 1, 1, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0];
  const original = remaining.slice();
  assert.equal(E.findGroups(remaining, 3, 5, 3, true).length, 0);
  assert.equal(E.randomBoard(3, 5, 3, E.rng(1), null, [0, 1], remaining), null);
  assert.deepEqual(remaining, original);
});

test("fixed matches are not silently removed by refill", () => {
  const remaining = [0, 0, 0, -1, -1, -1, -1, -1, -1];
  assert.equal(E.randomBoard(3, 3, 3, E.rng(1), null, [0, 1, 2, 3, 4, 5], remaining), null);
});

test("non-matching stones and a full board do not require extra colours", () => {
  const stones = E.randomBoard(5, 6, 3, E.rng(1), null, [E.STONE]);
  assert.ok(stones.every(orb => orb === E.STONE));
  assert.deepEqual(Array.from(E.randomBoard(5, 6, 3, E.rng(1), null, [0], stones)), Array.from(stones));
});
