import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";

export async function GET(req:Request){
  const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
  const u=new URL(req.url),teacherId=u.searchParams.get("teacherId");
  if(teacherId){
    const slots=await query("SELECT a.id,a.slot_date::text AS slot_date,a.start_time::text AS start_time,a.end_time::text AS end_time FROM teacher_availability_slots a WHERE a.teacher_id=$1 AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.teacher_id=a.teacher_id AND l.status<>'CANCELLED' AND l.starts_at < ((a.slot_date+a.start_time) AT TIME ZONE $2) + interval '30 minutes' AND l.ends_at > ((a.slot_date+a.start_time) AT TIME ZONE $2)) ORDER BY a.slot_date,a.start_time",[teacherId,process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg"]);
    return NextResponse.json(slots.rows)
  }
  if(s.role==="TEACHER"){
    const r=await query("SELECT id,slot_date::text AS slot_date,start_time::text AS start_time,end_time::text AS end_time FROM teacher_availability_slots WHERE teacher_id=$1 ORDER BY slot_date,start_time",[s.id]);
    return NextResponse.json(r.rows)
  }
  const r=await query("SELECT u.id,u.full_name as name,COUNT(a.id)::int as availability_count FROM users u LEFT JOIN teacher_availability_slots a ON a.teacher_id=u.id AND a.slot_date BETWEEN ((now() AT TIME ZONE $1)::date) AND (((now() AT TIME ZONE $1)::date)+14) WHERE u.role='TEACHER' AND u.active=true GROUP BY u.id,u.full_name ORDER BY u.full_name",[process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg"]);
  return NextResponse.json(r.rows)
}

export async function POST(req:Request){
  try{
  const s=await requireRole(["TEACHER"]);
  const body=await req.json();
  if(body.action==="closeFuture"){
    const tz=process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg";
    const r=await query("DELETE FROM teacher_availability_slots a WHERE a.teacher_id=$1 AND ((a.slot_date+a.start_time) AT TIME ZONE $2)>now() AND NOT EXISTS (SELECT 1 FROM lessons l WHERE l.teacher_id=a.teacher_id AND l.status<>'CANCELLED' AND l.starts_at < ((a.slot_date+a.start_time) AT TIME ZONE $2)+interval '30 minutes' AND l.ends_at > ((a.slot_date+a.start_time) AT TIME ZONE $2))",[s.id,tz]);
    return NextResponse.json({ok:true,closed:r.rowCount||0});
  }
  if(body.slotDate&&body.startTime){
    const slotDate=String(body.slotDate),startTime=String(body.startTime);
    const windowCheck=await query("SELECT ((now() AT TIME ZONE $1)::date) AS today, (((now() AT TIME ZONE $1)::date)+14) AS max_date",[process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg"]);
    const today=windowCheck.rows[0].today,maxDate=windowCheck.rows[0].max_date;
    if(slotDate<today||slotDate>maxDate)return NextResponse.json({error:"You can only open slots from today through 14 days ahead."},{status:400});
    const p=startTime.split(":").map(Number),mins=p[0]*60+p[1];
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(slotDate)||!/^[0-9]{2}:[0-9]{2}$/.test(startTime)||mins%30!==0)return NextResponse.json({error:"Please provide a valid 30-minute slot."},{status:400});
    const endMins=mins+30,endTime=String(Math.floor(endMins/60)).padStart(2,"0")+":"+String(endMins%60).padStart(2,"0");
    const tz=process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg";const passed=await query("SELECT (($2::date + $3::time) <= (now() AT TIME ZONE $1)) AS passed",[tz,slotDate,startTime]);if(passed.rows[0].passed)return NextResponse.json({error:"That lesson time has already passed and can no longer be booked."},{status:400});
    const booked=await query("SELECT id FROM lessons WHERE teacher_id=$1 AND status<>'CANCELLED' AND starts_at < (($2::date + $3::time) AT TIME ZONE $4) + interval '30 minutes' AND ends_at > (($2::date + $3::time) AT TIME ZONE $4)",[s.id,slotDate,startTime,tz]);
    if(booked.rowCount)return NextResponse.json({error:"That slot is already booked."},{status:409});
    const r=await query("INSERT INTO teacher_availability_slots(teacher_id,slot_date,start_time,end_time) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id,slot_date::text AS slot_date,start_time::text AS start_time,end_time::text AS end_time",[s.id,slotDate,startTime,endTime]);
    await query("DELETE FROM teacher_availability_exceptions WHERE teacher_id=$1 AND slot_date=$2 AND start_time=$3",[s.id,slotDate,startTime]);
    return NextResponse.json(r.rows[0]||{ok:true})
  }
  return NextResponse.json({error:"Please open one 30-minute slot at a time."},{status:400})
  }catch(error){console.error("availability POST failed",error);return NextResponse.json({error:"Could not open this slot. Please try again."},{status:500})}
}

export async function DELETE(req:Request){
  const s=await requireRole(["TEACHER"]);
  const u=new URL(req.url),availabilityId=u.searchParams.get("availabilityId"),slotDate=u.searchParams.get("date"),startTime=u.searchParams.get("startTime");
  if(!slotDate||!startTime)return NextResponse.json({error:"Date and start time are required."},{status:400});
  if(!availabilityId){
    const booked=await query("SELECT id FROM lessons WHERE teacher_id=$1 AND status<>'CANCELLED' AND starts_at < (($2::date + $3::time) AT TIME ZONE $4) + interval '30 minutes' AND ends_at > (($2::date + $3::time) AT TIME ZONE $4)",[s.id,slotDate,startTime,process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg"]);
    if(booked.rowCount)return NextResponse.json({error:"This slot is booked. Please request cancellation approval instead."},{status:409});
    await query("DELETE FROM teacher_availability_slots WHERE teacher_id=$1 AND slot_date=$2 AND start_time=$3",[s.id,slotDate,startTime]);
    return NextResponse.json({ok:true});
  }
  const a=await query("SELECT * FROM teacher_availability WHERE id=$1 AND teacher_id=$2",[availabilityId,s.id]);
  if(!a.rowCount)return NextResponse.json({error:"Availability not found."},{status:404});
  const row=a.rows[0];
  if(startTime<row.start_time||startTime>=row.end_time)return NextResponse.json({error:"That slot is outside your availability."},{status:400});
  const booked=await query("SELECT id FROM lessons WHERE teacher_id=$1 AND status<>'CANCELLED' AND starts_at < (($2::date + $3::time) AT TIME ZONE $4) + interval '30 minutes' AND ends_at > (($2::date + $3::time) AT TIME ZONE $4)",[s.id,slotDate,startTime,process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg"]);
  if(booked.rowCount)return NextResponse.json({error:"This slot is booked. Please request cancellation approval instead."},{status:409});
  await query("INSERT INTO teacher_availability_exceptions(teacher_id,slot_date,start_time) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",[s.id,slotDate,startTime]);
  return NextResponse.json({ok:true});
}