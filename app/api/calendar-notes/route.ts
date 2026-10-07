import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS calendar_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    note_date date NOT NULL,
    note text NOT NULL,
    start_time time,
    end_time time,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
}

export async function GET(req: Request) {
  await ensureTable();
  await query("ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS start_time time");
  await query("ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS end_time time");
  await requireRole(["ADMIN"]);
  const p = new URL(req.url).searchParams;
  const start = p.get("startDate");
  const end = p.get("endDate");
  let sql = "SELECT id, note_date, note, start_time, end_time, created_at, updated_at FROM calendar_notes";
  const values: any[] = [];
  if (start && end) {
    values.push(start, end);
    sql += " WHERE note_date BETWEEN $1::date AND $2::date";
  } else if (start) {
    values.push(start);
    sql += " WHERE note_date >= $1::date";
  } else if (end) {
    values.push(end);
    sql += " WHERE note_date <= $1::date";
  }
  sql += " ORDER BY note_date, created_at";
  const r = await query(sql, values);
  return NextResponse.json(r.rows);
}

export async function POST(req: Request) {
  await ensureTable();
  await query("ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS start_time time");
  await query("ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS end_time time");
  const s = await requireRole(["ADMIN"]);
  const { noteDate, note, startTime, endTime } = await req.json();
  if (!noteDate || !note || !String(note).trim()) {
    return NextResponse.json({ error: "Date and note are required." }, { status: 400 });
  }
  const st = startTime ? String(startTime).slice(0,5) : null;
  const et = endTime ? String(endTime).slice(0,5) : null;
  if (et && !st) return NextResponse.json({ error: "Start time is required when an end time is selected." }, { status: 400 });
  if (st && et && et <= st) return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  const r = await query(
    "INSERT INTO calendar_notes(note_date,note,start_time,end_time,created_by) VALUES($1::date,$2,$3::time,$4::time,$5) RETURNING id,note_date,note,start_time,end_time,created_at,updated_at",
    [noteDate, String(note).trim(), st, et, s.id]
  );
  return NextResponse.json(r.rows[0]);
}

export async function DELETE(req: Request) {
  await ensureTable();
  await query("ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS start_time time");
  await query("ALTER TABLE calendar_notes ADD COLUMN IF NOT EXISTS end_time time");
  await requireRole(["ADMIN"]);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Note id is required." }, { status: 400 });
  await query("DELETE FROM calendar_notes WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
