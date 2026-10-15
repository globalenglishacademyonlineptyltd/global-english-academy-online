import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const DEFAULT_FOLDER = "Level 0 - Starter";
const LEVEL_FOLDERS = [
  "Level 0 - Starter",
  "Level 1 - Beginner",
  "Level 2 - Elementary",
  "Level 3 - Lower Intermediate",
  "Level 4 - Intermediate",
  "Level 5 - Upper Intermediate",
  "Level 6 - Advanced"
];
const UNIT_COUNT = 12;

export async function GET() {
  await requireRole(["ADMIN"]);
  const r = await query("SELECT m.*,u.full_name creator_name FROM materials m LEFT JOIN users u ON u.id=m.created_by ORDER BY m.folder,COALESCE(m.unit_no,999),m.sequence_no,m.title");
  return NextResponse.json(r.rows);
}

export async function POST(req: Request) {
  const s = await requireRole(["ADMIN"]);
  const { title, description, url, level, folder, unitNo, sequenceNo, contentData, mimeType } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const f = folder || level || DEFAULT_FOLDER;
  const unit = unitNo === "" || unitNo === null || typeof unitNo === "undefined" ? null : Number(unitNo);
  if (LEVEL_FOLDERS.includes(f) && unit !== null && (!Number.isInteger(unit) || unit < 1 || unit > UNIT_COUNT)) {
    return NextResponse.json({ error: "Please choose a valid Unit 1–12." }, { status: 400 });
  }
  const seq = Number(sequenceNo) || 1;
  const r = await query("INSERT INTO materials(title,description,url,level,folder,unit_no,sequence_no,content_data,mime_type,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *", [title.trim(), description || "", url || "", level || f, f, unit, seq, contentData || "", mimeType || "", s.id]);
  return NextResponse.json(r.rows[0]);
}

export async function PATCH(req: Request) {
  await requireRole(["ADMIN"]);
  let body: { materialId?: string; title?: string; description?: string; url?: string; level?: string; folder?: string; unitNo?: string | number | null; sequenceNo?: string | number; contentData?: string; mimeType?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid edit request." }, { status: 400 }); }
  const { materialId, title, description, url, level, folder, unitNo, sequenceNo, contentData, mimeType } = body;
  if (!materialId) return NextResponse.json({ error: "A material ID is required." }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const existing = await query("SELECT id FROM materials WHERE id=$1", [materialId]);
  if (!existing.rowCount) return NextResponse.json({ error: "Material not found." }, { status: 404 });
  const f = folder || level || DEFAULT_FOLDER;
  const unit = unitNo === "" || unitNo === null || typeof unitNo === "undefined" ? null : Number(unitNo);
  if (LEVEL_FOLDERS.includes(f) && unit !== null && (!Number.isInteger(unit) || unit < 1 || unit > UNIT_COUNT)) {
    return NextResponse.json({ error: "Please choose a valid Unit 1–12." }, { status: 400 });
  }
  const seq = Number(sequenceNo) || 1;
  let updated;
  if (contentData) {
    updated = await query("UPDATE materials SET title=$1,description=$2,url=$3,level=$4,folder=$5,unit_no=$6,sequence_no=$7,content_data=$8,mime_type=$9 WHERE id=$10 RETURNING *", [title.trim(), description || "", url || "", level || f, f, unit, seq, contentData, mimeType || "", materialId]);
  } else {
    updated = await query("UPDATE materials SET title=$1,description=$2,url=$3,level=$4,folder=$5,unit_no=$6,sequence_no=$7 WHERE id=$8 RETURNING *", [title.trim(), description || "", url || "", level || f, f, unit, seq, materialId]);
  }
  return NextResponse.json(updated.rows[0]);
}

export async function DELETE(req: Request) {
  await requireRole(["ADMIN"]);
  let body: { materialId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "A material ID is required." }, { status: 400 }); }
  const materialId = body.materialId;
  if (!materialId) return NextResponse.json({ error: "A material ID is required." }, { status: 400 });
  const existing = await query("SELECT id FROM materials WHERE id=$1", [materialId]);
  if (!existing.rowCount) return NextResponse.json({ error: "Material not found. It may already have been deleted." }, { status: 404 });
  await query("DELETE FROM lesson_materials WHERE material_id=$1", [materialId]);
  await query("DELETE FROM materials WHERE id=$1", [materialId]);
  return NextResponse.json({ ok: true, deletedId: materialId });
}