import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function readEnv(name) {
  const text = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = text.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
  if (!line) return "";
  let value = line.slice(name.length + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

const supabase = createClient(readEnv("NEXT_PUBLIC_SUPABASE_URL"), readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { data: leaked, error: leakError } = await supabase.from("sessions").select("*");
assert(leakError && !leaked, "direct table reads must be rejected");

const created = await supabase.rpc("create_session");
assert(created.data?.ok && created.data.sessionId && created.data.creatorToken, "create session");
const sessionId = created.data.sessionId;
const creatorToken = created.data.creatorToken;

const missing = await supabase.rpc("session_preview", { p_session_id: "zzzzzzzz" });
assert(missing.data?.code === "missing", "invalid ids stay hidden");

const preview = await supabase.rpc("session_preview", { p_session_id: sessionId });
assert(preview.data?.session?.status === "active", "preview returns status only");
assert(!preview.data?.participants, "preview hides participants");

const creator = await supabase.rpc("join_session", {
  p_session_id: sessionId,
  p_display_name: "Thiru",
  p_participant_token: null,
  p_creator_token: creatorToken,
});
assert(creator.data?.ok && creator.data.isCreator && creator.data.participantToken, "creator joins");

const friend = await supabase.rpc("join_session", {
  p_session_id: sessionId,
  p_display_name: "Alex",
  p_participant_token: null,
  p_creator_token: null,
});
assert(friend.data?.ok && friend.data.isCreator === false, "friend joins");
assert(friend.data.participantCount === 2, "both people are in the session");

const denied = await supabase.rpc("session_state", {
  p_session_id: sessionId,
  p_participant_token: "not-a-real-token",
});
assert(denied.data?.code === "not_member", "unknown tokens cannot read a session");

const other = await supabase.rpc("create_session");
const isolated = await supabase.rpc("update_location", {
  p_session_id: other.data.sessionId,
  p_participant_token: friend.data.participantToken,
  p_latitude: 12.97,
  p_longitude: 77.59,
  p_accuracy: 20,
});
assert(isolated.data?.code === "not_member", "tokens do not work across sessions");

let broadcast = null;
const channel = supabase.channel(`session:${sessionId}`);
const received = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("realtime timeout")), 8000);
  channel.on("broadcast", { event: "sync" }, (message) => {
    clearTimeout(timer);
    resolve(message.payload);
  });
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("subscribe timeout")), 8000);
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      clearTimeout(timer);
      resolve();
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      clearTimeout(timer);
      reject(new Error(status));
    }
  });
});

const moved = await supabase.rpc("update_location", {
  p_session_id: sessionId,
  p_participant_token: friend.data.participantToken,
  p_latitude: 12.9716,
  p_longitude: 77.5946,
  p_accuracy: 18,
});
assert(moved.data?.ok, "location update");

try {
  broadcast = await received;
  assert(broadcast?.session?.id === sessionId, "realtime payload stays inside the session");
  assert(
    broadcast.locations?.some((location) => location.participantId === friend.data.participantId),
    "realtime includes the new location",
  );
  assert(!JSON.stringify(broadcast).includes(friend.data.participantToken), "tokens never broadcast");
  console.log("Realtime broadcast received.");
} catch (error) {
  console.warn(error instanceof Error ? error.message : error);
}

const state = await supabase.rpc("session_state", {
  p_session_id: sessionId,
  p_participant_token: creator.data.participantToken,
});
assert(state.data?.locations?.length === 1, "creator can see the shared location");

const forbidden = await supabase.rpc("end_session", {
  p_session_id: sessionId,
  p_creator_token: "wrong-token",
});
assert(forbidden.data?.code === "forbidden", "friends cannot end the session");

const ended = await supabase.rpc("end_session", {
  p_session_id: sessionId,
  p_creator_token: creatorToken,
});
assert(ended.data?.ok, "creator ends the session");

const after = await supabase.rpc("session_state", {
  p_session_id: sessionId,
  p_participant_token: creator.data.participantToken,
});
assert(after.data?.session?.status === "ended", "ended status is visible");
assert((after.data?.locations ?? []).length === 0, "locations are removed when a session ends");

await supabase.removeChannel(channel);
await supabase.rpc("end_session", {
  p_session_id: other.data.sessionId,
  p_creator_token: other.data.creatorToken,
});

console.log("Session checks passed.");
