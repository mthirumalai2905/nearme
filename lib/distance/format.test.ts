import assert from "node:assert/strict";
import test from "node:test";
import { calculateDistance } from "./haversine.ts";
import { formatDistance } from "./format.ts";

test("haversine measures a known short arc", () => {
  const meters = calculateDistance(0, 0, 0, 1);
  assert.ok(meters > 110_000 && meters < 112_000);
});

test("formatDistance uses meters and kilometers", () => {
  assert.equal(formatDistance(15), "Nearby");
  assert.equal(formatDistance(420), "420 m away");
  assert.equal(formatDistance(1800), "1.8 km away");
  assert.equal(formatDistance(24_000), "24 km away");
});
