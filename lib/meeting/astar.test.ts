import assert from "node:assert/strict";
import test from "node:test";
import { shortestPath, type GraphNode } from "./astar.ts";

test("A* prefers the shorter walk around a block", () => {
  const nodes = new Map<string, GraphNode>([
    ["a", { id: "a", latitude: 0, longitude: 0 }],
    ["b", { id: "b", latitude: 0, longitude: 0.01 }],
    ["c", { id: "c", latitude: 0.01, longitude: 0.01 }],
    ["d", { id: "d", latitude: 0.01, longitude: 0 }],
  ]);
  const neighbors = new Map([
    ["a", [{ id: "b", meters: 100 }, { id: "d", meters: 400 }]],
    ["b", [{ id: "a", meters: 100 }, { id: "c", meters: 100 }]],
    ["c", [{ id: "b", meters: 100 }, { id: "d", meters: 100 }]],
    ["d", [{ id: "a", meters: 400 }, { id: "c", meters: 100 }]],
  ]);
  assert.deepEqual(shortestPath(nodes, neighbors, "a", "c"), ["a", "b", "c"]);
});
