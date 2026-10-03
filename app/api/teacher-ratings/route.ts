import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";

async function ensureTable(){
  await query(`CREATE TABLE IF NOT EXISTS teacher_ratings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id uuid NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating integer NOT NULL CHECK (rating BETWEEN 1 AND 10),
    opinion text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  await query("CREATE INDEX IF NOT EXISTS teacher_ratings_teacher_idx ON teacher_ratings(teacher_id,created_at)");
}
export async function GET(req:Request){
  const s=await requireRole(["ADMIN","TEACHER","STUDENT"]); await ensureTable();
  const u=new URL(req.url),start=u.searchParams.get("start"),end=u.searchParams.get("end"),teacher=u.searchParams.get("teacher");
  if(s.role==="ADMIN"){
    const vals:any[]=[]; let where="r.rating IS NOT NULL AND l.status<>'CANCELLED' AND l.ends_at<=now()";
    if(start){vals.push(start+" 00:00:00");where+=" AND l.starts_at >= $"+vals.length}
    if(end){vals.push(end+" 23:59:59.999");where+=" AND l.starts_at <= $"+vals.length}
    if(teacher){vals.push(teacher);where+=" AND l.teacher_id=$"+vals.length}
    const rows=await query(`SELECT r.id,r.lesson_id,l.class_id,l.starts_at,l.ends_at,
      st.full_name student_name,t.full_name teacher_name,r.rating,r.opinion,r.created_at,
      rec.storage_url recording_url
      FROM teacher_ratings r JOIN lessons l ON l.id=r.lesson_id
      JOIN users t ON t.id=l.teacher_id JOIN users st ON st.id=l.student_id
      LEFT JOIN recordings rec ON rec.lesson_id=l.id
      WHERE ${where} ORDER BY l.starts_at DESC LIMIT 500`,vals);
    const teachers=await query("SELECT id,full_name FROM users WHERE role='TEACHER' ORDER BY full_name",[]);
    return NextResponse.json({rows:rows.rows,teachers:teachers.rows});
  }
  if(s.role==="TEACHER"){
    const vals:any[]=[s.id]; let where="l.teacher_id=$1 AND l.status<>'CANCELLED' AND l.ends_at<=now()";
    if(start){vals.push(start+" 00:00:00");where+=" AND l.starts_at >= $"+vals.length}
    if(end){vals.push(end+" 23:59:59.999");where+=" AND l.starts_at <= $"+vals.length}
    const stats=await query(`SELECT r.rating,COUNT(*)::int count FROM teacher_ratings r
      JOIN lessons l ON l.id=r.lesson_id WHERE ${where} AND r.rating IS NOT NULL GROUP BY r.rating ORDER BY r.rating`,vals);
    const rows=await query(`SELECT l.id lesson_id,l.class_id,l.starts_at,l.ends_at,st.full_name student_name,
      r.id rating_id,COALESCE(r.rating,0)::int rating,r.opinion
      FROM lessons l JOIN users st ON st.id=l.student_id
      LEFT JOIN teacher_ratings r ON r.lesson_id=l.id
      WHERE ${where} ORDER BY l.starts_at DESC LIMIT 500`,vals);
    const trend=await query(`SELECT
      COALESCE(AVG(r.rating) FILTER(WHERE r.created_at>=date_trunc('week',now())-interval '1 week' AND r.created_at<date_trunc('week',now())),0) prev_week,
      COALESCE(AVG(r.rating) FILTER(WHERE r.created_at>=date_trunc('week',now())),0) week,
      COALESCE(AVG(r.rating) FILTER(WHERE r.created_at>=date_trunc('month',now())-interval '1 month' AND r.created_at<date_trunc('month',now())),0) prev_month,
      COALESCE(AVG(r.rating) FILTER(WHERE r.created_at>=date_trunc('month',now())),0) month
      FROM teacher_ratings r WHERE r.teacher_id=$1`,[s.id]);
    return NextResponse.json({stats:stats.rows,rows:rows.rows,trend:trend.rows[0]});
  }
  const vals:any[]=[s.id]; let where="l.student_id=$1 AND l.status<>'CANCELLED' AND l.ends_at<=now()";
  if(start){vals.push(start+" 00:00:00");where+=" AND l.starts_at >= $"+vals.length}
  if(end){vals.push(end+" 23:59:59.999");where+=" AND l.starts_at <= $"+vals.length}
  if(teacher){vals.push(teacher);where+=" AND l.teacher_id=$"+vals.length}
  const rows=await query(`SELECT l.id lesson_id,l.class_id,l.starts_at,l.ends_at,t.id teacher_id,t.full_name teacher_name,r.rating,r.opinion
    FROM lessons l JOIN users t ON t.id=l.teacher_id LEFT JOIN teacher_ratings r ON r.lesson_id=l.id
    WHERE ${where} ORDER BY l.starts_at DESC LIMIT 500`,vals);
  const teachers=await query("SELECT DISTINCT t.id,t.full_name FROM lessons l JOIN users t ON t.id=l.teacher_id WHERE l.student_id=$1 ORDER BY t.full_name",[s.id]);
  return NextResponse.json({rows:rows.rows,teachers:teachers.rows});
}
export async function POST(req:Request){
  const s=await requireRole(["STUDENT"]); await ensureTable(); const b=await req.json(); const rating=Number(b.rating);
  if(!b.lessonId||!Number.isInteger(rating)||rating<1||rating>10)return NextResponse.json({error:"Please select a rating from 1 to 10."},{status:400});
  const l=await query<any>("SELECT * FROM lessons WHERE id=$1",[b.lessonId]);
  if(!l.rowCount)return NextResponse.json({error:"Lesson not found."},{status:404});
  const lesson=l.rows[0];
  if(lesson.student_id!==s.id)return NextResponse.json({error:"You can only rate your own lessons."},{status:403});
  if(lesson.status==="CANCELLED"||new Date(lesson.ends_at).getTime()>Date.now())return NextResponse.json({error:"This lesson cannot be rated yet."},{status:409});
  const r=await query("INSERT INTO teacher_ratings(lesson_id,student_id,teacher_id,rating,opinion) VALUES($1,$2,$3,$4,$5) ON CONFLICT(lesson_id) DO UPDATE SET rating=EXCLUDED.rating,opinion=EXCLUDED.opinion,updated_at=now() RETURNING *",[lesson.id,s.id,lesson.teacher_id,rating,String(b.opinion||"")]);
  return NextResponse.json(r.rows[0]);
}