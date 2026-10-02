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
    const windowCheck=await query("SELECT ((now() AT TIME ZONE $1)::date) AS today, (((now() AT TIME ZONE $1)::date)+14) AS max_date",[tz]);
    const localDateCheck=start.toLocaleDateString("en-CA",{timeZone:tz});
    if(localDateCheck<windowCheck.rows[0].today||localDateCheck>windowCheck.rows[0].max_date)return NextResponse.json({error:"Lessons can only be booked within the rolling 14-day booking window."},{status:409});
  }
  if(s.role==="STUDENT"){
    const teacher=await query("SELECT id FROM users WHERE id=$1 AND role='TEACHER' AND active=true",[teacherId]);
    if(!teacher.rowCount)return NextResponse.json({error:"Teacher not found."},{status:404});
    const localDate=start.toLocaleDateString("en-CA",{timeZone:tz});
    const localTime=start.toLocaleTimeString("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",hour12:false});
    const one=await query("SELECT id FROM teacher_availability_slots WHERE teacher_id=$1 AND slot_date=$2 AND start_time=$3",[teacherId,localDate,localTime]);
    if(!one.rowCount)return NextResponse.json({error:"That exact 30-minute slot has not been opened by the teacher."},{status:409});
    const ex=await query("SELECT id FROM teacher_availability_exceptions WHERE teacher_id=$1 AND slot_date=(($2::timestamptz AT TIME ZONE $3)::date) AND start_time=(($2::timestamptz AT TIME ZONE $3)::time)",[teacherId,start.toISOString(),tz]);
    if(ex.rowCount)return NextResponse.json({error:"That slot is no longer available."},{status:409});
  }
  const conflict=await query("SELECT id FROM lessons WHERE (teacher_id=$1 OR student_id=$2) AND status<>'CANCELLED' AND starts_at<$3 AND ends_at>$4",[teacherId,actualStudentId,end,start]);
  if(conflict.rowCount)return NextResponse.json({error:"That 30-minute slot conflicts with another lesson."},{status:409});
  const room="gea-"+crypto.randomUUID();
  const r=await query("INSERT INTO lessons(teacher_id,student_id,starts_at,ends_at,room_code,topic) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",[teacherId,actualStudentId,start,end,room,topic||""]);
  return NextResponse.json(r.rows[0])
}