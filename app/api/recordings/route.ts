import{NextResponse}from"next/server";
import{query}from"@/lib/db";
import{requireRole}from"@/lib/auth";

export async function POST(req:Request){
 const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
 const{lessonId,roomCode,durationSeconds,mimeType,data}=await req.json();
 if(!lessonId||!data)return NextResponse.json({error:"lessonId and recording data are required."},{status:400});
 if(typeof data!=="string"||!data.startsWith("data:"))return NextResponse.json({error:"Invalid recording data."},{status:400});
 if(data.length>18_000_000)return NextResponse.json({error:"Recording is too large. Please keep lessons under the supported recording size."},{status:413});
 const lesson=await query<any>("SELECT id,teacher_id,student_id,room_code FROM lessons WHERE id=$1",[lessonId]);
 if(!lesson.rowCount)return NextResponse.json({error:"Lesson not found."},{status:404});
 const l=lesson.rows[0];
 if(s.role!=="ADMIN"&&s.id!==l.teacher_id&&s.id!==l.student_id)return NextResponse.json({error:"Not allowed."},{status:403});
 if(roomCode&&roomCode!==l.room_code)return NextResponse.json({error:"Room does not match lesson."},{status:400});
 const r=await query("INSERT INTO recordings(lesson_id,storage_url,duration_seconds) VALUES($1,$2,$3) ON CONFLICT(lesson_id) DO UPDATE SET storage_url=EXCLUDED.storage_url,duration_seconds=EXCLUDED.duration_seconds,created_at=now() RETURNING id,lesson_id,duration_seconds,created_at",[lessonId,data,Number(durationSeconds)||0]);
 return NextResponse.json(r.rows[0]);
}

export async function GET(req:Request){
 const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
 const lessonId=new URL(req.url).searchParams.get("lessonId");
 let sql="SELECT r.id,r.lesson_id,r.storage_url,r.duration_seconds,r.created_at,l.teacher_id,l.student_id,l.room_code,l.starts_at,t.full_name teacher_name,st.full_name student_name FROM recordings r JOIN lessons l ON l.id=r.lesson_id JOIN users t ON t.id=l.teacher_id JOIN users st ON st.id=l.student_id";
 const values:any[]=[];
 if(lessonId){sql+=" WHERE r.lesson_id=$1";values.push(lessonId);}
 else if(s.role==="TEACHER"){sql+=" WHERE l.teacher_id=$1";values.push(s.id);}
 else if(s.role==="STUDENT"){sql+=" WHERE l.student_id=$1";values.push(s.id);}
 sql+=" ORDER BY r.created_at DESC LIMIT 100";
 const r=await query(sql,values);
 return NextResponse.json(r.rows);
}