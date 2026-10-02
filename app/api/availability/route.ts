import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";

export async function GET(req:Request){
  const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
  const u=new URL(req.url),teacherId=u.searchParams.get("teacherId");
  if(s.role==="TEACHER"&&!teacherId){
    const r=await query("SELECT * FROM teacher_availability WHERE teacher_id=$1 ORDER BY day_of_week,start_time",[s.id]);return NextResponse.json(r.rows)
  }
  if(teacherId){
    const r=await query("SELECT a.*,u.full_name teacher_name FROM teacher_availability a JOIN users u ON u.id=a.teacher_id WHERE a.teacher_id=$1 ORDER BY a.day_of_week,a.start_time",[teacherId]);return NextResponse.json(r.rows)
  }
  const r=await query("SELECT u.id,u.full_name as name,COUNT(a.id)::int as availability_count FROM users u LEFT JOIN teacher_availability a ON a.teacher_id=u.id WHERE u.role='TEACHER' AND u.active=true GROUP BY u.id,u.full_name ORDER BY u.full_name");return NextResponse.json(r.rows)
}

export async function POST(req:Request){
  const s=await requireRole(["TEACHER"]);
  const{dayOfWeek,startTime,endTime}=await req.json();
  if(!Number.isInteger(dayOfWeek)||dayOfWeek<0||dayOfWeek>6||!startTime||!endTime||startTime>=endTime)return NextResponse.json({error:"Please provide a valid day and time range."},{status:400});
  const r=await query("INSERT INTO teacher_availability(teacher_id,day_of_week,start_time,end_time) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *",[s.id,dayOfWeek,startTime,endTime]);
  return NextResponse.json(r.rows[0]||{ok:true})
}