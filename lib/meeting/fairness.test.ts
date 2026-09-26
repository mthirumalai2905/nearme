import assert from "node:assert/strict";
import test from "node:test";
import { rankPlaces } from "./fairness.ts";

test("ranks the fairer place ahead of a one-sided shortcut", () => {
  const people = [
    { name: "Alex", latitude: 12.97, longitude: 77.59 },
    { name: "Sarah", latitude: 12.99, longitude: 77.64 },
  ];
  const fair = {
    id: "fair",
    name: "Middle Cafe",
    latitude: 12.98,
    longitude: 77.615,
    category: "Cafe",
    address: null,
    hours: null,
  };
  const biased = {
    id: "biased",
    name: "Far Cafe",
    latitude: 12.97,
    longitude: 77.59,
    category: "Cafe",
    address: null,
    hours: null,
  };
  const ranked = rankPlaces(people, [biased, fair], "Cafe");
  assert.equal(ranked.places[0]?.id, "fair");
  assert.match(ranked.places[0]?.why ?? "", /close to everyone|farthest/);
});
