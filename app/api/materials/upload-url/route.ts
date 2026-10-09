import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireRole } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await requireRole(["ADMIN"]);
  const { fileName, mimeType } = await req.json();
  if (!fileName || !mimeType) return NextResponse.json({ error: "File name and type are required." }, { status: 400 });
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return NextResponse.json({ error: "File storage is not configured yet." }, { status: 503 });
  const client = new S3Client({ region: process.env.S3_REGION || "auto", endpoint, forcePathStyle: false, credentials: { accessKeyId, secretAccessKey } });
  await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules: [{ AllowedOrigins: ["https://school.globalenglishacademyonline.co.za", "https://globalenglishacademyonline.co.za"], AllowedMethods: ["PUT", "GET", "HEAD"], AllowedHeaders: ["*"], ExposeHeaders: ["ETag"], MaxAgeSeconds: 3600 }] } }));
  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const key = `materials/${randomUUID()}-${safeName}`;
  const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType }), { expiresIn: 900 });
  return NextResponse.json({ uploadUrl, storageKey: `s3:${key}` });
}
