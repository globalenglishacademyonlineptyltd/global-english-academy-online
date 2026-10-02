import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";

export async function GET(){
  const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
  let q="SELECT l.*,t.full_name teacher_name,st.full_name student_name FROM lessons l JOIN users t ON t.id=l.teacher_id JOIN users st ON st.id=l.student_id",v:any[]=[];
  if(s.role==="TEACHER"){q+=" WHERE l.teacher_id=$1";v=[s.id]}
  if(s.role==="STUDENT"){q+=" WHERE l.student_id=$1";v=[s.id]}
  q+=" ORDER BY l.starts_at DESC LIMIT 100";
  const r=await query(q,v);return NextResponse.json(r.rows)
}

export async function POST(req:Request){
  const s=await requireRole(["ADMIN","STUDENT"]);
  const{teacherId,studentId,startsAt,topic}=await req.json();
  const actualStudentId=s.role==="STUDENT"?s.id:studentId;
  if(!teacherId||!actualStudentId||!startsAt)return NextResponse.json({error:"Teacher and start time are required."},{status:400});
  const start=new Date(startsAt);
  if(Number.isNaN(start.getTime())||start.getTime()<=Date.now())return NextResponse.json({error:"Please choose a future lesson time."},{status:400});
  const localMinute=start.getMinutes();if(localMinute%30!==0)return NextResponse.json({error:"Lessons must start on the half-hour."},{status:400});const end=new Date(start.getTime()+1800000);
  const tz=process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg";
  if(s.role==="STUDENT"){
    const teacher=await query("SELECT id FROM users WHERE id=$1 AND role='TEACHER' AND active=true",[teacherId]);
    if(!teacher.rowCount)return NextResponse.json({error:"Teacher not found."},{status:404});
    const localDate=start.toLocaleDateString("en-CA",{timeZone:tz});
    const localTime=start.toLocaleTimeString("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",hour12:false});
    const one=await query("SELECT id FROM teacher_availability_slots WHERE teacher_id=$1 AND slot_date=$2 AND start_time=$3",[teacherId,localDate,localTime]);
    const av=await query("SELECT id FROM teacher_availability WHERE teacher_id=$1 AND day_of_week=EXTRACT(DOW FROM ($2::timestamptz AT TIME ZONE $3))::int AND ($2::timestamptz AT TIME ZONE $3)::time >= start_time AND ($2::timestamptz AT TIME ZONE $3)::time < end_time",[teacherId,start.toISOString(),tz]);
    if(!one.rowCount&&!av.rowCount)return NextResponse.json({error:"That teacher is not available at the selected time."},{status:409});
    const ex=await query("SELECT id FROM teacher_availability_exceptions WHERE teacher_id=$1 AND slot_date=(($2::timestamptz AT TIME ZONE $3)::date) AND start_time=(($2::timestamptz AT TIME ZONE $3)::time)",[teacherId,start.toISOString(),tz]);
    if(ex.rowCount)return NextResponse.json({error:"That slot is no longer available."},{status:409});
  }
  const conflict=await query("SELECT id FROM lessons WHERE (teacher_id=$1 OR student_id=$2) AND status<>'CANCELLED' AND starts_at<$3 AND ends_at>$4",[teacherId,actualStudentId,end,start]);
  if(conflict.rowCount)return NextResponse.json({error:"That 30-minute slot conflicts with another lesson."},{status:409});
  const room="gea-"+crypto.randomUUID();
  const r=await query("INSERT INTO lessons(teacher_id,student_id,starts_at,ends_at,room_code,topic) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[teacherId,actualStudentId,start,end,room,topic||""]);
  return NextResponse.json(r.rows[0])
}