import { NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const s = await requireRole(["ADMIN", "TEACHER", "STUDENT"]);
  const p = new URL(req.url).searchParams, materialId = p.get("materialId");
  if (!materialId) return NextResponse.json({ error: "Material is required." }, { status: 400 });
  const r = await query<any>("SELECT id,title,content_data,url,mime_type FROM materials WHERE id=$1", [materialId]);
  if (!r.rowCount) return NextResponse.json({ error: "Material not found." }, { status: 404 });
  const m = r.rows[0];
  if (s.role !== "ADMIN") {
    const access = await query("SELECT 1 FROM lesson_materials lm JOIN lessons l ON l.id=lm.lesson_id WHERE lm.material_id=$1 AND ($2=l.teacher_id OR $2=l.student_id) LIMIT 1", [materialId, s.id]);
    if (!access.rowCount) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  if (typeof m.content_data === "string" && m.content_data.startsWith("s3:")) {
    const endpoint = process.env.S3_ENDPOINT, bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID, secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return NextResponse.json({ error: "File storage is not configured." }, { status: 503 });
    const client = new S3Client({ region: process.env.S3_REGION || "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: m.content_data.slice(3) }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) return NextResponse.json({ error: "Workbook file is empty." }, { status: 404 });
    const ext = m.mime_type === "application/pdf" ? ".pdf" : "";
    return new NextResponse(bytes, { headers: { "Content-Type": m.mime_type || "application/octet-stream", "Content-Disposition": "inline; filename*=UTF-8''" + encodeURIComponent((m.title || "lesson-material") + ext), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }
  if (m.content_data?.startsWith("data:")) {
    const match = String(m.content_data).match(/^data:([^;]+);base64,(.*)$/s);
    if (!match) return NextResponse.json({ error: "Invalid material file." }, { status: 500 });
    const mime = match[1] || m.mime_type || "application/octet-stream";
    const ext = mime === "application/pdf" ? ".pdf" : "";
    return new NextResponse(Buffer.from(match[2], "base64"), { headers: { "Content-Type": mime, "Content-Disposition": "inline; filename*=UTF-8''" + encodeURIComponent((m.title || "lesson-material") + ext), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }
  if (m.url) return NextResponse.redirect(m.url);
  return NextResponse.json({ error: "No material file is attached." }, { status: 404 });
}