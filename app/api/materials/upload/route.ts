import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await requireRole(["ADMIN"]);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please choose a workbook file." }, { status: 400 });
    }
    if (file.size <= 0) return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    if (file.type && !allowedTypes.includes(file.type)) return NextResponse.json({ error: "Please upload a PDF, PNG, JPG, or WEBP file." }, { status: 415 });
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "The workbook is larger than 50 MB. Please upload a smaller PDF." }, { status: 413 });
    }
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      return NextResponse.json({ error: "Secure file storage is not configured." }, { status: 503 });
    }
    const client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint,
      forcePathStyle: false,
      credentials: { accessKeyId, secretAccessKey }
    });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "workbook";
    const key = `materials/${randomUUID()}-${safeName}`;
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || "application/octet-stream"
    }));
    return NextResponse.json({ storageKey: `s3:${key}` });
  } catch (error) {
    console.error("Workbook server upload failed:", error instanceof Error ? error.message : "Unknown upload error");
    return NextResponse.json({ error: "The platform could not store the workbook. Please try again." }, { status: 500 });
  }
}
