import{NextResponse}from"next/server";
import{query}from"@/lib/db";
import{requireRole}from"@/lib/auth";

export const runtime="nodejs";
async function ensureChunkTable(){
 await query(`CREATE TABLE IF NOT EXISTS recording_upload_chunks(
 lesson_id text NOT NULL,
 chunk_index integer NOT NULL,
 mime_type text NOT NULL,
 chunk_data bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(lesson_id,chunk_index)
 )`);
}
async function authorizedLesson(lessonId:string,roomCode:string|undefined,s:any){
 const lesson=await query<any>("SELECT id,teacher_id,student_id,room_code FROM lessons WHERE id=$1",[lessonId]);
 if(!lesson.rowCount)return{error:NextResponse.json({error:"Lesson not found."},{status:404})};
 const l=lesson.rows[0];
 if(s.role!=="ADMIN"&&s.id!==l.teacher_id&&s.id!==l.student_id)return{error:NextResponse.json({error:"Not allowed."},{status:403})};
 if(roomCode&&roomCode!==l.room_code)return{error:NextResponse.json({error:"Room does not match lesson."},{status:400})};
 return{lesson:l};
}
function parseData(data:any){
 if(typeof data!=="string")return null;
 const match=data.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,([A-Za-z0-9+/=\r\n]+)$/);
 if(!match)return null;
 return{mime:match[1]||"video/webm",bytes:Buffer.from(match[2].replace(/\s/g,""),"base64")};
}
export async function POST(req:Request){
 const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
 const body=await req.json();
 const{lessonId,roomCode,durationSeconds,mimeType,data,action,chunkIndex,chunkCount}=body;
 if(!lessonId)return NextResponse.json({error:"lessonId is required."},{status:400});
 const auth=await authorizedLesson(lessonId,roomCode,s);if(auth.error)return auth.error;
 if(action==="chunk"){
  await ensureChunkTable();
  const parsed=parseData(data);
  if(!parsed||!parsed.bytes.length)return NextResponse.json({error:"Invalid recording chunk."},{status:400});
  if(parsed.bytes.length>1_500_000)return NextResponse.json({error:"Recording chunk is too large."},{status:413});
  const index=Number(chunkIndex);
  if(!Number.isInteger(index)||index<0)return NextResponse.json({error:"Invalid chunk index."},{status:400});
  if(index===0)await query("DELETE FROM recording_upload_chunks WHERE lesson_id=$1",[lessonId]);
  await query("INSERT INTO recording_upload_chunks(lesson_id,chunk_index,mime_type,chunk_data) VALUES($1,$2,$3,$4) ON CONFLICT(lesson_id,chunk_index) DO UPDATE SET mime_type=EXCLUDED.mime_type,chunk_data=EXCLUDED.chunk_data,created_at=now()",[lessonId,index,mimeType||parsed.mime,parsed.bytes]);
  return NextResponse.json({ok:true,chunkIndex:index});
 }
 if(action==="finalize"){
  await ensureChunkTable();
  const parts=await query<any>("SELECT chunk_index,mime_type,chunk_data FROM recording_upload_chunks WHERE lesson_id=$1 ORDER BY chunk_index ASC",[lessonId]);
  const expected=Number(chunkCount);
  if(!Number.isInteger(expected)||expected<1||parts.rowCount!==expected)return NextResponse.json({error:"Recording upload is incomplete; the existing recording has been kept unchanged."},{status:409});
  for(let i=0;i<expected;i++){if(Number(parts.rows[i].chunk_index)!==i)return NextResponse.json({error:"A recording segment is missing; the existing recording has been kept unchanged."},{status:409});}
  const mime=String(mimeType||parts.rows[0].mime_type||"video/webm").split(";")[0];
  const bytes=Buffer.concat(parts.rows.map((p:any)=>Buffer.isBuffer(p.chunk_data)?p.chunk_data:Buffer.from(p.chunk_data)));
  if(bytes.length<1024)return NextResponse.json({error:"Recording is too small to be a valid video; the existing recording has been kept unchanged."},{status:422});
  const header=bytes.subarray(0,4).toString("hex");
  if(header!=="1a45dfa3")return NextResponse.json({error:"The video file failed validation; the existing recording has been kept unchanged."},{status:422});
  const dataUrl="data:"+mime+";base64,"+bytes.toString("base64");
  const r=await query("INSERT INTO recordings(lesson_id,storage_url,duration_seconds) VALUES($1,$2,$3) ON CONFLICT(lesson_id) DO UPDATE SET storage_url=EXCLUDED.storage_url,duration_seconds=EXCLUDED.duration_seconds,created_at=now() RETURNING id,lesson_id,duration_seconds,created_at",[lessonId,dataUrl,Number(durationSeconds)||0]);
  await query("DELETE FROM recording_upload_chunks WHERE lesson_id=$1",[lessonId]);
  return NextResponse.json({...r.rows[0],saved:true,bytes:bytes.length});
 }
 if(!data)return NextResponse.json({error:"Recording data is required."},{status:400});
 const parsed=parseData(data);
 if(!parsed||parsed.bytes.length<1024)return NextResponse.json({error:"Recording file failed validation; no recording was replaced."},{status:422});
 if(parsed.bytes.subarray(0,4).toString("hex")!=="1a45dfa3")return NextResponse.json({error:"Recording is not a valid WebM video; no recording was replaced."},{status:422});
 const r=await query("INSERT INTO recordings(lesson_id,storage_url,duration_seconds) VALUES($1,$2,$3) ON CONFLICT(lesson_id) DO UPDATE SET storage_url=EXCLUDED.storage_url,duration_seconds=EXCLUDED.duration_seconds,created_at=now() RETURNING id,lesson_id,duration_seconds,created_at",[lessonId,data,Number(durationSeconds)||0]);
 return NextResponse.json(r.rows[0]);
}

export async function GET(req:Request){
 const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
 const lessonId=new URL(req.url).searchParams.get("lessonId");
 let sql="SELECT r.id,r.lesson_id,r.storage_url,r.duration_seconds,r.created_at,l.teacher_id,l.student_id,l.room_code,l.starts_at,t.full_name teacher_name,st.full_name student_name FROM recordings r JOIN lessons l ON l.id=r.lesson_id JOIN users t ON t.id=l.teacher_id JOIN users st ON st.id=l.student_id";
 const values:any[]=[];
 if(lessonId){sql+=" WHERE r.lesson_id=$1 AND t.deleted_at IS NULL AND st.deleted_at IS NULL";values.push(lessonId);}
 else if(s.role==="TEACHER"){sql+=" WHERE l.teacher_id=$1 AND t.deleted_at IS NULL AND st.deleted_at IS NULL";values.push(s.id);}
 else if(s.role==="STUDENT"){sql+=" WHERE l.student_id=$1 AND t.deleted_at IS NULL AND st.deleted_at IS NULL";values.push(s.id);}
 else{sql+=" WHERE t.deleted_at IS NULL AND st.deleted_at IS NULL";}
 sql+=" ORDER BY r.created_at DESC LIMIT 100";
 const r=await query(sql,values);
 return NextResponse.json(r.rows);
}
