import{NextResponse}from"next/server";
import{PutObjectCommand,S3Client}from"@aws-sdk/client-s3";
import{randomUUID}from"node:crypto";
import{query}from"@/lib/db";
import{requireRole}from"@/lib/auth";

export async function POST(req:Request){
 const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
 const{lessonId,roomCode,durationSeconds,mimeType,data}=await req.json();
 if(!lessonId||!data)return NextResponse.json({error:"lessonId and recording data are required."},{status:400});
 if(typeof data!=="string"||!data.startsWith("data:"))return NextResponse.json({error:"Invalid recording data."},{status:400});
 if(data.length>300_000_000)return NextResponse.json({error:"Recording exceeds the 200 MB upload limit."},{status:413});
 const lesson=await query<any>("SELECT id,teacher_id,student_id,room_code FROM lessons WHERE id=$1",[lessonId]);
 if(!lesson.rowCount)return NextResponse.json({error:"Lesson not found."},{status:404});
 const l=lesson.rows[0];
 if(s.role!=="ADMIN"&&s.id!==l.teacher_id&&s.id!==l.student_id)return NextResponse.json({error:"Not allowed."},{status:403});
 if(roomCode&&roomCode!==l.room_code)return NextResponse.json({error:"Room does not match lesson."},{status:400});
 let storageUrl=data;
 const endpoint=process.env.S3_ENDPOINT,bucket=process.env.S3_BUCKET,accessKeyId=process.env.S3_ACCESS_KEY_ID,secretAccessKey=process.env.S3_SECRET_ACCESS_KEY;
 if(endpoint&&bucket&&accessKeyId&&secretAccessKey){
  const match=data.match(/^data:([^;]+);base64,(.*)$/s);
  if(!match)return NextResponse.json({error:"Invalid recording data encoding."},{status:400});
  const bytes=Buffer.from(match[2],"base64");
  const key="recordings/"+lessonId+"/"+Date.now()+"-"+randomUUID()+".webm";
  try{const client=new S3Client({region:process.env.S3_REGION||"auto",endpoint,forcePathStyle:false,credentials:{accessKeyId,secretAccessKey}});await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:bytes,ContentType:mimeType||match[1]||"video/webm"}));storageUrl="s3:"+key;}
  catch(e){console.error("Recording object upload failed",e);return NextResponse.json({error:"The recording could not be uploaded to secure storage. Please retry before leaving the classroom."},{status:502});}
 }else if(data.length>120_000_000){
  return NextResponse.json({error:"Secure object storage is not configured, and this recording exceeds the fallback storage limit."},{status:413});
 }
 const r=await query("INSERT INTO recordings(lesson_id,storage_url,duration_seconds) VALUES($1,$2,$3) ON CONFLICT(lesson_id) DO UPDATE SET storage_url=EXCLUDED.storage_url,duration_seconds=EXCLUDED.duration_seconds,created_at=now() RETURNING id,lesson_id,duration_seconds,created_at",[lessonId,storageUrl,Number(durationSeconds)||0]);
 return NextResponse.json(r.rows[0]);
}
export async function GET(req:Request){
 const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
 const lessonId=new URL(req.url).searchParams.get("lessonId");
 let sql="SELECT r.id,r.lesson_id,('/api/recordings/file?recordingId='||r.id::text) storage_url,r.duration_seconds,r.created_at,l.teacher_id,l.student_id,l.room_code,l.starts_at,t.full_name teacher_name,st.full_name student_name FROM recordings r JOIN lessons l ON l.id=r.lesson_id JOIN users t ON t.id=l.teacher_id JOIN users st ON st.id=l.student_id";
 const values:any[]=[];
 if(lessonId){sql+=" WHERE r.lesson_id=$1 AND t.deleted_at IS NULL AND st.deleted_at IS NULL";values.push(lessonId);}
 else if(s.role==="TEACHER"){sql+=" WHERE l.teacher_id=$1 AND t.deleted_at IS NULL AND st.deleted_at IS NULL";values.push(s.id);}
 else if(s.role==="STUDENT"){sql+=" WHERE l.student_id=$1 AND t.deleted_at IS NULL AND st.deleted_at IS NULL";values.push(s.id);}
 else {sql+=" WHERE t.deleted_at IS NULL AND st.deleted_at IS NULL";}
 sql+=" ORDER BY r.created_at DESC LIMIT 100";
 const r=await query(sql,values);
 return NextResponse.json(r.rows);
}