import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";

export async function GET(req:Request){
  const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
  const u=new URL(req.url),teacherId=u.searchParams.get("teacherId");
  if(s.role==="TEACHER"&&!teacherId){
    const r=await query("SELECT id,teacher_id,day_of_week,start_time,end_time FROM teacher_availability WHERE teacher_id=$1 ORDER BY day_of_week,start_time",[s.id]);return NextResponse.json(r.rows)
  }
  if(teacherId){
    const slots=await query("SELECT id,slot_date,start_time,end_time FROM teacher_availability_slots WHERE teacher_id=$1 ORDER BY slot_date,start_time",[teacherId]);
    return NextResponse.json(slots.rows)
  }
  const r=await query("SELECT u.id,u.full_name as name,COUNT(a.id)::int as availability_count FROM users u LEFT JOIN teacher_availability a ON a.teacher_id=u.id WHERE u.role='TEACHER' AND u.active=true GROUP BY u.id,u.full_name ORDER BY u.full_name");return NextResponse.json(r.rows)
}

export async function POST(req:Request){
  const s=await requireRole(["TEACHER"]);
  const body=await req.json();
  if(body.slotDate&&body.startTime){
    const slotDate=String(body.slotDate),startTime=String(body.startTime);
    const p=startTime.split(":").map(Number),mins=p[0]*60+p[1];
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(slotDate)||!/^[0-9]{2}:[0-9]{2}$/.test(startTime)||mins%30!==0)return NextResponse.json({error:"Please provide a valid 30-minute slot."},{status:400});
    const endMins=mins+30,endTime=String(Math.floor(endMins/60)).padStart(2,"0")+":"+String(endMins%60).padStart(2,"0");
    const tz=process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg";
    const booked=await query("SELECT id FROM lessons WHERE teacher_id=$1 AND status<>'CANCELLED' AND starts_at < (($2::date + $3::time) AT TIME ZONE $4) + interval '30 minutes' AND ends_at > (($2::date + $3::time) AT TIME ZONE $4)",[s.id,slotDate,startTime,tz]);
    if(booked.rowCount)return NextResponse.json({error:"That slot is already booked."},{status:409});
    const r=await query("INSERT INTO teacher_availability_slots(teacher_id,slot_date,start_time,end_time) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *",[s.id,slotDate,startTime,endTime]);
    await query("DELETE FROM teacher_availability_exceptions WHERE teacher_id=$1 AND slot_date=$2 AND start_time=$3",[s.id,slotDate,startTime]);
    return NextResponse.json(r.rows[0]||{ok:true})
  }
  const{dayOfWeek,startTime,endTime}=body;
  if(!Number.isInteger(dayOfWeek)||dayOfWeek<0||dayOfWeek>6||!startTime||!endTime||startTime>=endTime)return NextResponse.json({error:"Please provide a valid day and time range."},{status:400});
  const r=await query("INSERT INTO teacher_availability(teacher_id,day_of_week,start_time,end_time) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING *",[s.id,dayOfWeek,startTime,endTime]);
  return NextResponse.json(r.rows[0]||{ok:true})
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


export async function PATCH(req:Request){
  const s=await requireRole(["TEACHER"]);
  const{availabilityId}=await req.json();
  if(!availabilityId)return NextResponse.json({error:"Availability is required."},{status:400});
  const a=await query("SELECT * FROM teacher_availability WHERE id=$1 AND teacher_id=$2",[availabilityId,s.id]);
  if(!a.rowCount)return NextResponse.json({error:"Availability not found."},{status:404});
  const row=a.rows[0];
  const tz=process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg";
  const booked=await query("SELECT id FROM lessons WHERE teacher_id=$1 AND status<>'CANCELLED' AND EXTRACT(DOW FROM (starts_at AT TIME ZONE $2))::int=$3 AND (starts_at AT TIME ZONE $2)::time < $5::time AND (ends_at AT TIME ZONE $2)::time > $4::time",[s.id,tz,row.day_of_week,row.start_time,row.end_time]);
  if(booked.rowCount)return NextResponse.json({error:"This recurring availability contains booked lessons. Please request cancellation approval for those lessons first before removing this availability."},{status:409});
  await query("DELETE FROM teacher_availability WHERE id=$1 AND teacher_id=$2",[availabilityId,s.id]);
  return NextResponse.json({ok:true});
}
