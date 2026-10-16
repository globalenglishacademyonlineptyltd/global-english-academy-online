import {NextResponse} from "next/server";
import {query} from "@/lib/db";
import {requireRole} from "@/lib/auth";

async function ensureExitColumns(){
 await query("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS teacher_exited_at timestamptz");
 await query("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS student_exited_at timestamptz");
}
export async function GET(req:Request){
 await ensureExitColumns(); const s=await requireRole(["TEACHER","STUDENT"]); const lessonId=new URL(req.url).searchParams.get("lessonId");
 if(!lessonId)return NextResponse.json({error:"lessonId is required."},{status:400});
 const r=await query<any>("SELECT id,teacher_id,student_id,teacher_exited_at,student_exited_at,status FROM lessons WHERE id=$1",[lessonId]);
 if(!r.rowCount)return NextResponse.json({error:"Lesson not found."},{status:404}); const l=r.rows[0];
 if(s.id!==l.teacher_id&&s.id!==l.student_id)return NextResponse.json({error:"Not allowed."},{status:403});
 return NextResponse.json({teacherExited:Boolean(l.teacher_exited_at),studentExited:Boolean(l.student_exited_at),bothExited:Boolean(l.teacher_exited_at&&l.student_exited_at),status:l.status});
}
export async function POST(req:Request){
 await ensureExitColumns(); const s=await requireRole(["TEACHER","STUDENT"]); const {lessonId}=await req.json();
 if(!lessonId)return NextResponse.json({error:"lessonId is required."},{status:400});
 const r=await query<any>("SELECT id,teacher_id,student_id,status FROM lessons WHERE id=$1",[lessonId]);
 if(!r.rowCount)return NextResponse.json({error:"Lesson not found."},{status:404}); const l=r.rows[0];
 if(s.id!==l.teacher_id&&s.id!==l.student_id)return NextResponse.json({error:"Not allowed."},{status:403});
 if(l.status==="CANCELLED")return NextResponse.json({error:"This lesson was cancelled."},{status:409});
 if(s.role==="TEACHER")await query("UPDATE lessons SET teacher_exited_at=COALESCE(teacher_exited_at,now()) WHERE id=$1",[lessonId]);
 else await query("UPDATE lessons SET student_exited_at=COALESCE(student_exited_at,now()) WHERE id=$1",[lessonId]);
 const state=await query<any>("SELECT teacher_exited_at,student_exited_at,status FROM lessons WHERE id=$1",[lessonId]); const x=state.rows[0];
 return NextResponse.json({ok:true,teacherExited:Boolean(x.teacher_exited_at),studentExited:Boolean(x.student_exited_at),bothExited:Boolean(x.teacher_exited_at&&x.student_exited_at),status:x.status});
}
