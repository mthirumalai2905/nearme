import assert from "node:assert/strict";
import test from "node:test";
import { assignAvatars, AVATARS } from "./avatars.ts";

test("gives everyone in a session a different portrait", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
  const faces = [...assignAvatars(ids).values()];
  assert.equal(new Set(faces).size, faces.length);
  assert.ok(faces.every((face) => AVATARS.includes(face as (typeof AVATARS)[number])));
});

test("keeps earlier portraits when someone new joins", () => {
  const first = assignAvatars(["ada", "bo", "cy"]);
  const next = assignAvatars(["ada", "bo", "cy", "dee"]);
  assert.equal(next.get("ada"), first.get("ada"));
  assert.equal(next.get("bo"), first.get("bo"));
  assert.equal(next.get("cy"), first.get("cy"));
  assert.notEqual(next.get("dee"), next.get("ada"));
});
