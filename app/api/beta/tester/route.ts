import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { isSessionId } from "@/lib/session/ids";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

type RpcBody = {
  ok?: boolean;
  message?: string;
  participantToken?: string;
};

const failures = new Map<string, { count: number; resetAt: number }>();

function passwordOk(input: string) {
  const expected = process.env.BETA_TEST_PASSWORD ?? "";
  if (!expected || !input) return false;
  const given = Buffer.from(input);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length) return false;
  return timingSafeEqual(given, wanted);
}

function limited(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = failures.get(ip);
  if (!current || current.resetAt < now) return false;
  return current.count >= 8;
}

function noteFailure(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = failures.get(ip);
  if (!current || current.resetAt < now) {
    failures.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return;
  }
  current.count += 1;
}

async function call(fn: string, args: Record<string, unknown>) {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw new Error("beta_rpc");
  const body = (typeof data === "string" ? JSON.parse(data) : data) as RpcBody;
  if (!body?.ok) throw new Error(body?.message || "beta_rpc");
  return body;
}

export async function POST(request: Request) {
  if (!process.env.BETA_TEST_PASSWORD || !isSupabaseConfigured()) {
    return NextResponse.json({ message: "Beta testing isn't turned on." }, { status: 404 });
  }
  if (limited(request)) {
    return NextResponse.json({ message: "Too many tries. Wait a few minutes." }, { status: 429 });
  }

  let payload: {
    password?: unknown;
    action?: unknown;
    sessionId?: unknown;
    name?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    testerToken?: unknown;
  };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ message: "That didn't work. Try again." }, { status: 400 });
  }

  if (!passwordOk(typeof payload.password === "string" ? payload.password : "")) {
    noteFailure(request);
    return NextResponse.json({ message: "That password isn't right." }, { status: 401 });
  }

  if (payload.action === "unlock") {
    return NextResponse.json({ ok: true });
  }

  const sessionId = typeof payload.sessionId === "string" ? payload.sessionId : "";
  if (!isSessionId(sessionId)) {
    return NextResponse.json({ message: "That didn't work. Try again." }, { status: 400 });
  }

  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  const hasPoint = Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  let testerToken = typeof payload.testerToken === "string" ? payload.testerToken : "";
  const name = typeof payload.name === "string" ? payload.name.trim().slice(0, 32) : "";

  try {
    if (payload.action === "remove") {
      if (!testerToken) return NextResponse.json({ message: "That didn't work. Try again." }, { status: 400 });
      await call("leave_session", { p_session_id: sessionId, p_participant_token: testerToken });
      return NextResponse.json({ ok: true });
    }

    if (!hasPoint) return NextResponse.json({ message: "Choose a spot on the map." }, { status: 400 });

    if (!testerToken) {
      if (!name) return NextResponse.json({ message: "Give the test person a name." }, { status: 400 });
      const joined = await call("join_session", {
        p_session_id: sessionId,
        p_display_name: name,
        p_participant_token: null,
        p_creator_token: null,
      });
      testerToken = joined.participantToken ?? "";
    }
    if (!testerToken) return NextResponse.json({ message: "That didn't work. Try again." }, { status: 502 });

    await call("update_location", {
      p_session_id: sessionId,
      p_participant_token: testerToken,
      p_latitude: latitude,
      p_longitude: longitude,
      p_accuracy: 25,
    });
    return NextResponse.json({ ok: true, testerToken });
  } catch {
    return NextResponse.json({ message: "That didn't work. Try again." }, { status: 502 });
  }
}
