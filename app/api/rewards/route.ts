import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";

async function setup(){await query(`CREATE TABLE IF NOT EXISTS lesson_rewards(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 reward_type text NOT NULL CHECK(reward_type IN ('donut','star','lollipop')),
 created_at timestamptz NOT NULL DEFAULT now()
)`);}

export async function GET(req:Request){
 try{
  const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
  await setup();
  const id=new URL(req.url).searchParams.get("lessonId");
  if(!id)return NextResponse.json({error:"Lesson ID is required."},{status:400});
  const lesson=await query("SELECT id,student_id,teacher_id FROM lessons WHERE id=$1",[id]);
  if(!lesson.rowCount)return NextResponse.json({error:"Lesson not found."},{status:404});
  const l=lesson.rows[0];
  if(s.role==="TEACHER"&&l.teacher_id!==s.id)return NextResponse.json({error:"Not authorized."},{status:403});
  if(s.role==="STUDENT"&&l.student_id!==s.id)return NextResponse.json({error:"Not authorized."},{status:403});
  const r=await query("SELECT id,reward_type,created_at FROM lesson_rewards WHERE lesson_id=$1 ORDER BY created_at",[id]);
  return NextResponse.json(r.rows)
 }catch{return NextResponse.json({error:"Could not load rewards."},{status:500})}
}

export async function POST(req:Request){
 try{
  const s=await requireRole(["TEACHER"]);
  await setup();
  const b=await req.json(),lessonId=String(b.lessonId||""),rewardType=String(b.rewardType||"");
  if(!lessonId||!["donut","star","lollipop"].includes(rewardType))return NextResponse.json({error:"Choose a valid reward."},{status:400});
  const lesson=await query("SELECT id,student_id,teacher_id FROM lessons WHERE id=$1 AND status<>'CANCELLED'",[lessonId]);
  if(!lesson.rowCount||lesson.rows[0].teacher_id!==s.id)return NextResponse.json({error:"Lesson not found or not assigned to you."},{status:403});
  const count=await query("SELECT COUNT(*)::int AS count FROM lesson_rewards WHERE lesson_id=$1",[lessonId]);
  if(Number(count.rows[0].count)>=15)return NextResponse.json({error:"Maximum 15 rewards per lesson reached."},{status:400});
  const r=await query("INSERT INTO lesson_rewards(lesson_id,student_id,teacher_id,reward_type) VALUES($1,$2,$3,$4) RETURNING id,reward_type,created_at",[lessonId,lesson.rows[0].student_id,s.id,rewardType]);
  return NextResponse.json(r.rows[0])
 }catch(error){console.error("reward POST failed",error);return NextResponse.json({error:"Could not give reward."},{status:500})}
}