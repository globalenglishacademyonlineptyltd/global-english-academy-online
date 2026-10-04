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
  await query("UPDATE lessons SET status='COMPLETED' WHERE id=$1 AND status<>'CANCELLED'",[lessonId]);
  return NextResponse.json({ok:true});
}
