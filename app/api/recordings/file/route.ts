import{NextResponse}from"next/server";
import{GetObjectCommand,S3Client}from"@aws-sdk/client-s3";
import{query}from"@/lib/db";
import{requireRole}from"@/lib/auth";

export async function GET(req:Request){
 const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
 const recordingId=new URL(req.url).searchParams.get("recordingId");
 if(!recordingId)return NextResponse.json({error:"Recording is required."},{status:400});
 const result=await query<any>("SELECT r.id,r.storage_url,r.lesson_id,l.teacher_id,l.student_id FROM recordings r JOIN lessons l ON l.id=r.lesson_id WHERE r.id=$1",[recordingId]);
 if(!result.rowCount)return NextResponse.json({error:"Recording not found."},{status:404});
 const r=result.rows[0];
 if(s.role!=="ADMIN"&&s.id!==r.teacher_id&&s.id!==r.student_id)return NextResponse.json({error:"Not authorized."},{status:403});
 const value=String(r.storage_url||"");
 if(value.startsWith("s3:")){
  const endpoint=process.env.S3_ENDPOINT,bucket=process.env.S3_BUCKET,accessKeyId=process.env.S3_ACCESS_KEY_ID,secretAccessKey=process.env.S3_SECRET_ACCESS_KEY;
  if(!endpoint||!bucket||!accessKeyId||!secretAccessKey)return NextResponse.json({error:"Secure file storage is not configured."},{status:503});
  try{
   const client=new S3Client({region:process.env.S3_REGION||"auto",endpoint,forcePathStyle:false,credentials:{accessKeyId,secretAccessKey}});
   const object=await client.send(new GetObjectCommand({Bucket:bucket,Key:value.slice(3)}));
   const bytes=await object.Body?.transformToByteArray();
   if(!bytes)return NextResponse.json({error:"Recording file is empty."},{status:404});
   return new NextResponse(Buffer.from(bytes),{headers:{"Content-Type":object.ContentType||"video/webm","Content-Disposition":'inline; filename="classroom-recording.webm"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }catch(e){console.error("Recording playback failed",e);return NextResponse.json({error:"Recording could not be opened."},{status:502});}
 }
 if(value.startsWith("data:")){
  const match=value.match(/^data:([^;]+);base64,(.*)$/s);
  if(!match)return NextResponse.json({error:"Invalid stored recording."},{status:500});
  return new NextResponse(Buffer.from(match[2],"base64"),{headers:{"Content-Type":match[1]||"video/webm","Content-Disposition":'inline; filename="classroom-recording.webm"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }
 if(/^https:\/\//i.test(value))return NextResponse.redirect(value);
 return NextResponse.json({error:"Recording storage location is invalid."},{status:500});
}
