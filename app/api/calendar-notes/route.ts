import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

async function ensureTable() {
  await query(`CREATE TABLE IF NOT EXISTS calendar_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    note_date date NOT NULL,
    note text NOT NULL,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
}

export async function GET(req: Request) {
  await ensureTable();
  await requireRole(["ADMIN"]);
  const p = new URL(req.url).searchParams;
  const start = p.get("startDate");
  const end = p.get("endDate");
  let sql = "SELECT id, note_date, note, created_at, updated_at FROM calendar_notes";
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
  const s = await requireRole(["ADMIN"]);
  const { noteDate, note } = await req.json();
  if (!noteDate || !note || !String(note).trim()) {
    return NextResponse.json({ error: "Date and note are required." }, { status: 400 });
  }
  const r = await query(
    "INSERT INTO calendar_notes(note_date,note,created_by) VALUES($1::date,$2,$3) RETURNING id,note_date,note,created_at,updated_at",
    [noteDate, String(note).trim(), s.id]
  );
  return NextResponse.json(r.rows[0]);
}

export async function DELETE(req: Request) {
  await ensureTable();
  await requireRole(["ADMIN"]);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Note id is required." }, { status: 400 });
  await query("DELETE FROM calendar_notes WHERE id=$1", [id]);
  return NextResponse.json({ ok: true });
}
