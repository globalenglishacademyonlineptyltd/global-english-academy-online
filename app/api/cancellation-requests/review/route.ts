import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";import{sendCancellationEmails,sendBookingEmails,sendNoReplacementTeacherEmail}from"@/lib/email";
export async function POST(req:Request){
 const s=await requireRole(["ADMIN"]);const{requestId,decision}=await req.json();
 if(!requestId||!["APPROVED","REJECTED"].includes(decision))return NextResponse.json({error:"Invalid cancellation decision."},{status:400});
 const r=await query("SELECT * FROM cancellation_requests WHERE id=$1",[requestId]);
 if(!r.rowCount)return NextResponse.json({error:"Request not found."},{status:404});
 if(r.rows[0].status!=="PENDING")return NextResponse.json({error:"This request has already been reviewed."},{status:409});
 const cr=r.rows[0];const lessonResult=await query<any>("SELECT l.*,t.email teacher_email,t.full_name teacher_name,st.email student_email,st.full_name student_name FROM lessons l JOIN users t ON t.id=l.teacher_id JOIN users st ON st.id=l.student_id WHERE l.id=$1",[cr.lesson_id]);
 if(!lessonResult.rowCount)return NextResponse.json({error:"The booked lesson could not be found."},{status:404});
 const lesson=lessonResult.rows[0];
 if(decision==="APPROVED"){
   const tz="Asia/Shanghai";
   const localDate=new Date(lesson.starts_at).toLocaleDateString("en-CA",{timeZone:tz});
   const localTime=new Date(lesson.starts_at).toLocaleTimeString("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",hour12:false});
   const duration=Number(lesson.lesson_duration_minutes)||30;
   const block=Number(lesson.calendar_block_minutes)||(duration===50?60:30);
   const replacement=await query<any>(`SELECT u.id teacher_id,u.email teacher_email,u.full_name teacher_name
     FROM teacher_availability_slots a JOIN users u ON u.id=a.teacher_id
     WHERE a.slot_date=$1::date AND a.start_time=$2::time AND a.admin_opened=true AND u.active=true AND u.role='TEACHER' AND u.id<>$3
     AND NOT EXISTS(SELECT 1 FROM teacher_availability_exceptions e WHERE e.teacher_id=u.id AND e.slot_date=$1::date AND e.start_time=$2::time)
     AND NOT EXISTS(SELECT 1 FROM lessons x WHERE x.teacher_id=u.id AND x.id<>$4 AND x.status<>'CANCELLED' AND x.starts_at<$5::timestamptz+($6::text||' minutes')::interval AND x.starts_at+(COALESCE(x.calendar_block_minutes,30)*interval '1 minute')>$5::timestamptz)
     AND NOT EXISTS(SELECT 1 FROM lessons x WHERE x.student_id=$7 AND x.id<>$4 AND x.status<>'CANCELLED' AND x.starts_at<$5::timestamptz+($6::text||' minutes')::interval AND x.starts_at+(COALESCE(x.calendar_block_minutes,30)*interval '1 minute')>$5::timestamptz)
     AND ($8<>50 OR EXISTS(SELECT 1 FROM teacher_availability_slots a2 WHERE a2.teacher_id=u.id AND a2.admin_opened=true AND a2.slot_date=($1::date+CASE WHEN $2::time>=time '23:30' THEN 1 ELSE 0 END) AND a2.start_time=(($2::time+interval '30 minutes')::time) AND NOT EXISTS(SELECT 1 FROM teacher_availability_exceptions e2 WHERE e2.teacher_id=u.id AND e2.slot_date=a2.slot_date AND e2.start_time=a2.start_time)))
     ORDER BY u.full_name LIMIT 1`,[localDate,localTime,lesson.teacher_id,lesson.id,lesson.starts_at,block,lesson.student_id,duration]);
   if(replacement.rowCount){
     const next=replacement.rows[0];
     await query("UPDATE lessons SET teacher_id=$1,status='BOOKED' WHERE id=$2",[next.teacher_id,lesson.id]);
     await query("UPDATE cancellation_requests SET status=$1,reviewed_by=$2,reviewed_at=now() WHERE id=$3",[decision,s.id,requestId]);
     await query("CREATE TABLE IF NOT EXISTS notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,title text NOT NULL,message text NOT NULL,link text DEFAULT '',read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now())");
     await query("INSERT INTO notifications(user_id,title,message,link) VALUES($1,$2,$3,$4)",[lesson.student_id,"Replacement teacher assigned","Your lesson remains booked at its original time. A replacement teacher has been assigned.","/dashboard/lessons"]);
     await query("INSERT INTO notifications(user_id,title,message,link) VALUES($1,$2,$3,$4)",[next.teacher_id,"Replacement lesson assigned","A replacement lesson has been assigned to you at the student's original booked time.","/dashboard/lessons"]);
     await sendBookingEmails({teacherEmail:next.teacher_email,teacherName:next.teacher_name,studentEmail:lesson.student_email,studentName:lesson.student_name,startsAt:lesson.starts_at,roomCode:lesson.room_code,classId:lesson.class_id,lessonTitle:lesson.topic||"English Lesson",lessonType:lesson.lesson_type}).catch(e=>console.error("Replacement lesson email failed",e));
     await sendCancellationEmails({teacherEmail:lesson.teacher_email,teacherName:lesson.teacher_name,studentEmail:"",studentName:lesson.student_name,startsAt:lesson.starts_at}).catch(e=>console.error("Original teacher cancellation email failed",e));
     return NextResponse.json({ok:true,status:decision,replacementAssigned:true,teacherName:next.teacher_name});
   }
   await query("UPDATE lessons SET status='CANCELLED' WHERE id=$1 AND status<>'CANCELLED'",[lesson.id]);
   await query("UPDATE cancellation_requests SET status=$1,reviewed_by=$2,reviewed_at=now() WHERE id=$3",[decision,s.id,requestId]);
   await query("CREATE TABLE IF NOT EXISTS notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,title text NOT NULL,message text NOT NULL,link text DEFAULT '',read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now())");
   await query("INSERT INTO notifications(user_id,title,message,link) VALUES($1,$2,$3,$4)",[lesson.student_id,"Lesson cancelled — please rebook","Unfortunately, your teacher had to cancel due to an emergency, and no replacement teacher is available at your original booked time. Please book another class. We sincerely apologise for the inconvenience.","/dashboard/book"]);
   await sendNoReplacementTeacherEmail({studentEmail:lesson.student_email,studentName:lesson.student_name,startsAt:lesson.starts_at}).catch(e=>console.error("No replacement email failed",e));
   await sendCancellationEmails({teacherEmail:lesson.teacher_email,teacherName:lesson.teacher_name,studentEmail:"",studentName:lesson.student_name,startsAt:lesson.starts_at}).catch(e=>console.error("Original teacher cancellation email failed",e));
   return NextResponse.json({ok:true,status:decision,replacementAssigned:false});
 }
 await query("UPDATE cancellation_requests SET status=$1,reviewed_by=$2,reviewed_at=now() WHERE id=$3",[decision,s.id,requestId]);
 return NextResponse.json({ok:true,status:decision});
}