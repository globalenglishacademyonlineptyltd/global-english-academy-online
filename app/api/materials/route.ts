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
  const { title, description, url, level, folder, unit, sequenceNo, contentData, mimeType } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  if (!String(url || "").trim() && !String(contentData || "").trim()) return NextResponse.json({ error: "Add a lesson URL, upload a PDF, or provide both." }, { status: 400 });
  if (url && !/^https:\/\//i.test(String(url).trim())) return NextResponse.json({ error: "Lesson links must start with https://" }, { status: 400 });
  const f = folder || level || "Level 1", seq = Number(sequenceNo) || 1, u = String(unit || "").trim();
  const r = await query("INSERT INTO materials(title,description,url,level,folder,unit,sequence_no,content_data,mime_type,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *", [title.trim(), description || "", String(url || "").trim(), level || f, f, u, seq, contentData || "", mimeType || "", s.id]);
  return NextResponse.json(r.rows[0]);
}

export async function PATCH(req: Request) {
  await requireRole(["ADMIN"]);
  let body: { materialId?: string; title?: string; description?: string; url?: string; level?: string; folder?: string; unit?: string; sequenceNo?: string | number; contentData?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid edit request." }, { status: 400 });
  }
  const { materialId, title, description, url, level, folder, unit, sequenceNo, contentData, mimeType } = body;
  if (!materialId) return NextResponse.json({ error: "A material ID is required." }, { status: 400 });
  if (!title?.trim()) return NextResponse.json({ error: "Title required" }, { status: 400 });
  const existing = await query("SELECT id FROM materials WHERE id=$1", [materialId]);
  if (!existing.rowCount) return NextResponse.json({ error: "Material not found." }, { status: 404 });
  if (!String(url || "").trim() && !String(contentData || "").trim()) {
    const existingContent = await query<any>("SELECT content_data FROM materials WHERE id=$1", [materialId]);
    if (!String(existingContent.rows[0]?.content_data || "").trim()) return NextResponse.json({ error: "Add a lesson URL, upload a PDF, or provide both." }, { status: 400 });
  }
  if (url && !/^https:\/\//i.test(String(url).trim())) return NextResponse.json({ error: "Lesson links must start with https://" }, { status: 400 });
  const f = folder || level || "Level 1", seq = Number(sequenceNo) || 1, u = String(unit || "").trim();
  let updated;
  if (contentData) {
    updated = await query("UPDATE materials SET title=$1,description=$2,url=$3,level=$4,folder=$5,unit=$6,sequence_no=$7,content_data=$8,mime_type=$9 WHERE id=$10 RETURNING *", [title.trim(), description || "", String(url || "").trim(), level || f, f, u, seq, contentData, mimeType || "", materialId]);
  } else {
    updated = await query("UPDATE materials SET title=$1,description=$2,url=$3,level=$4,folder=$5,unit=$6,sequence_no=$7 WHERE id=$8 RETURNING *", [title.trim(), description || "", String(url || "").trim(), level || f, f, u, seq, materialId]);
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
