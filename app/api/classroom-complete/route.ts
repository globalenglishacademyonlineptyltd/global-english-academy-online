import {NextResponse} from "next/server";
import {query} from "@/lib/db";
import {requireRole} from "@/lib/auth";

export async function POST(req:Request){
  const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
  const {lessonId}=await req.json();
  if(!lessonId)return NextResponse.json({error:"lessonId is required."},{status:400});
  const lesson=await query<any>("SELECT id,teacher_id,student_id,status FROM lessons WHERE id=$1",[lessonId]);
  if(!lesson.rowCount)return NextResponse.json({error:"Lesson not found."},{status:404});
  const l=lesson.rows[0];
  if(s.role!=="ADMIN"&&s.id!==l.teacher_id&&s.id!==l.student_id)return NextResponse.json({error:"Not allowed."},{status:403});
  const full=await query<any>("SELECT starts_at,ends_at,room_code FROM lessons WHERE id=$1",[lessonId]);
  const l2=full.rows[0];let status="COMPLETED";
  if(l2&&new Date(l2.ends_at).getTime()<=Date.now()){
    const p=await query<any>("SELECT sender_id,MIN(created_at) first_seen,MAX(created_at) last_seen FROM classroom_signals WHERE room_code=$1 GROUP BY sender_id",[l2.room_code]);
    const teacherPresence=p.rows.find((x:any)=>x.sender_id===l.teacher_id);
    const studentPresence=p.rows.find((x:any)=>x.sender_id===l.student_id);
    const start=new Date(l2.starts_at).getTime(),end=new Date(l2.ends_at).getTime();
    const teacherFull=!!teacherPresence&&new Date(teacherPresence.first_seen).getTime()<=start+60000&&new Date(teacherPresence.last_seen).getTime()>=end-60000;
    if(teacherFull&&!studentPresence)status="NO_SHOW";
  }
  await query("UPDATE lessons SET status=$2 WHERE id=$1 AND status<>'CANCELLED'",[lessonId,status]);
  return NextResponse.json({ok:true});
}
