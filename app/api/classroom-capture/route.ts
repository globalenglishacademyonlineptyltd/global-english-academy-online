import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workerBase = () => (process.env.CLASSROOM_CAPTURE_URL || "").replace(/\/$/, "");
const workerHeaders = () => ({ authorization: `Bearer ${process.env.CLASSROOM_CAPTURE_TOKEN || ""}` });
const roomSafe = (room: string) => /^[A-Za-z0-9_-]{3,100}$/.test(room);

async function authorizeRoom(room: string) {
  const user = await requireRole(["ADMIN", "TEACHER", "STUDENT"]);
  const result = await query<any>(
    "SELECT id,room_code,teacher_id,student_id FROM lessons WHERE room_code=$1 LIMIT 1",
    [room]
  );
  if (!result.rowCount) return { response: NextResponse.json({ error: "Lesson not found." }, { status: 404 }) };
  const lesson = result.rows[0];
  if (user.role === "TEACHER" && user.id !== lesson.teacher_id) return { response: NextResponse.json({ error: "Not authorized." }, { status: 403 }) };
  if (user.role === "STUDENT" && user.id !== lesson.student_id) return { response: NextResponse.json({ error: "Not authorized." }, { status: 403 }) };
  return { user, lesson };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const room = String(body.roomCode || "");
    const action = String(body.action || "");
    if (!roomSafe(room) || !["start", "input", "stop"].includes(action)) return NextResponse.json({ error: "Invalid capture request." }, { status: 400 });
    const access = await authorizeRoom(room);
    if ("response" in access) return access.response;
    if (!workerBase() || !process.env.CLASSROOM_CAPTURE_TOKEN) return NextResponse.json({ error: "The automatic classroom capture service is not configured yet." }, { status: 503 });
    const endpoint = action === "start" ? "start" : action === "input" ? "input" : "stop";
    if (action === "start") {
      if (access.user.role !== "TEACHER" && access.user.role !== "ADMIN") return NextResponse.json({ error: "Only the teacher can start classroom capture." }, { status: 403 });
      const assigned = await query<any>(
        "SELECT m.url,m.title FROM lesson_materials lm JOIN materials m ON m.id=lm.material_id WHERE lm.lesson_id=$1 ORDER BY m.level,m.created_at LIMIT 1",
        [access.lesson.id]
      );
      if (!assigned.rowCount || !assigned.rows[0].url) return NextResponse.json({ error: "This booking has no web-based interactive lesson assigned." }, { status: 409 });
      const upstream = await fetch(`${workerBase()}/sessions/${encodeURIComponent(room)}/start`, {
        method: "POST", headers: { ...workerHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ materialUrl: assigned.rows[0].url }), cache: "no-store"
      });
      const payload = await upstream.json().catch(() => ({}));
      return NextResponse.json(payload, { status: upstream.status });
    }
    if (action === "stop" && access.user.role !== "TEACHER" && access.user.role !== "ADMIN") return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    const upstream = await fetch(`${workerBase()}/sessions/${encodeURIComponent(room)}/${endpoint}`, {
      method: "POST", headers: { ...workerHeaders(), "content-type": "application/json" },
      body: JSON.stringify(action === "input" ? body.input || {} : {}), cache: "no-store"
    });
    const payload = await upstream.json().catch(() => ({}));
    return NextResponse.json(payload, { status: upstream.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Classroom capture failed." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const room = url.searchParams.get("roomCode") || "";
    if (!roomSafe(room)) return NextResponse.json({ error: "Invalid classroom." }, { status: 400 });
    const access = await authorizeRoom(room);
    if ("response" in access) return access.response;
    if (!workerBase() || !process.env.CLASSROOM_CAPTURE_TOKEN) return NextResponse.json({ error: "Capture service is unavailable." }, { status: 503 });
    const upstream = await fetch(`${workerBase()}/sessions/${encodeURIComponent(room)}/frame`, { headers: workerHeaders(), cache: "no-store" });
    if (!upstream.ok) return NextResponse.json({ error: "Lesson capture is not ready." }, { status: upstream.status });
    return new Response(upstream.body, { status: 200, headers: { "content-type": "image/jpeg", "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not retrieve lesson frame." }, { status: 500 });
  }
}
