import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  await requireRole(["ADMIN"]);
  const r = await query("SELECT m.*,u.full_name creator_name FROM materials m LEFT JOIN users u ON u.id=m.created_by ORDER BY NULLIF(regexp_replace(m.folder,'[^0-9]','','g'),'')::int NULLS LAST,m.sequence_no,m.title");
  return NextResponse.json(r.rows);
}

export async function POST(req: Request) {
  const s = await requireRole(["ADMIN"]);
  const { title, description, url, level, folder, sequenceNo, contentData, mimeType } = await req.json();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const f = folder || level || "Level 1", seq = Number(sequenceNo) || 1;
  const r = await query("INSERT INTO materials(title,description,url,level,folder,sequence_no,content_data,mime_type,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *", [title, description || "", url || "", level || f, f, seq, contentData || "", mimeType || "", s.id]);
  return NextResponse.json(r.rows[0]);
}

export async function PATCH(req: Request) {
  await requireRole(["ADMIN"]);
  let body: { materialId?: string; title?: string; description?: string; url?: string; level?: string; folder?: string; sequenceNo?: string | number; contentData?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid edit request." }, { status: 400 });
  }
  const { materialId, title, description, url, level, folder, sequenceNo, contentData, mimeType } = body;
  if (!materialId) return NextResponse.json({ error: "A material ID is required." }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const existing = await query("SELECT id FROM materials WHERE id=$1", [materialId]);
  if (!existing.rowCount) return NextResponse.json({ error: "Material not found." }, { status: 404 });
  const f = folder || level || "Level 1", seq = Number(sequenceNo) || 1;
  let updated;
  if (contentData) {
    updated = await query("UPDATE materials SET title=$1,description=$2,url=$3,level=$4,folder=$5,sequence_no=$6,content_data=$7,mime_type=$8 WHERE id=$9 RETURNING *", [title.trim(), description || "", url || "", level || f, f, seq, contentData, mimeType || "", materialId]);
  } else {
    updated = await query("UPDATE materials SET title=$1,description=$2,url=$3,level=$4,folder=$5,sequence_no=$6 WHERE id=$7 RETURNING *", [title.trim(), description || "", url || "", level || f, f, seq, materialId]);
  }
  return NextResponse.json(updated.rows[0]);
}

export async function DELETE(req: Request) {
  await requireRole(["ADMIN"]);
  let body: { materialId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "A material ID is required." }, { status: 400 });
  }
  const materialId = body.materialId;
  if (!materialId) return NextResponse.json({ error: "A material ID is required." }, { status: 400 });
  const existing = await query("SELECT id FROM materials WHERE id=$1", [materialId]);
  if (!existing.rowCount) return NextResponse.json({ error: "Material not found. It may already have been deleted." }, { status: 404 });
  // Remove lesson assignments first, then permanently delete the material and its stored file data.
  await query("DELETE FROM lesson_materials WHERE material_id=$1", [materialId]);
  await query("DELETE FROM materials WHERE id=$1", [materialId]);
  return NextResponse.json({ ok: true, deletedId: materialId });
}
