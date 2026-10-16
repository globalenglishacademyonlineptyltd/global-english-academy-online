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
  const existing = await query<any>("SELECT id,folder,unit_no,sequence_no,title FROM materials WHERE id=$1", [materialId]);
  if (!existing.rowCount) return NextResponse.json({ error: "Material not found. It may already have been deleted." }, { status: 404 });
  const deleted = existing.rows[0];
  await query("DELETE FROM lesson_materials WHERE material_id=$1", [materialId]);
  await query("DELETE FROM materials WHERE id=$1", [materialId]);

  // Close the numbering gap only inside the deleted lesson's exact folder and unit.
  // Preserve each lesson's descriptive title while updating its displayed Lesson N label.
  const remaining = await query<any>(
    `WITH ordered AS (
       SELECT id,
              row_number() OVER (ORDER BY sequence_no ASC NULLS LAST, created_at ASC, title ASC, id ASC)::int AS new_sequence
       FROM materials
       WHERE folder = $1 AND unit_no IS NOT DISTINCT FROM $2
     )
     UPDATE materials AS m
     SET sequence_no = ordered.new_sequence,
         title = CASE
           WHEN m.title ~* 'lesson[ _-]*[0-9]+'
             THEN regexp_replace(m.title, 'lesson[ _-]*[0-9]+', 'Lesson ' || ordered.new_sequence::text, 'i')
           ELSE 'Lesson ' || ordered.new_sequence::text || ' — ' || m.title
         END
     FROM ordered
     WHERE m.id = ordered.id
     RETURNING m.id, m.sequence_no, m.title`,
    [deleted.folder, deleted.unit_no]
  );
  return NextResponse.json({
    ok: true,
    deletedId: materialId,
    renumberedCount: remaining.rowCount || 0,
    folder: deleted.folder,
    unitNo: deleted.unit_no,
  });
}