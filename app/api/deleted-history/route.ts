import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";

export async function GET(req:Request){
 const s=await requireRole(["ADMIN"]);
 const p=new URL(req.url).searchParams;
 const role=String(p.get("role")||"").toUpperCase();
 const userId=p.get("userId");
 if(!["TEACHER","STUDENT"].includes(role))return NextResponse.json({error:"Invalid deleted-user type."},{status:400});
 let usersSql="SELECT id,email,full_name name,created_at,deleted_at FROM users WHERE role=$1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC";
 let users=(await query(usersSql,[role])).rows;
 if(userId){
  const ok=users.some((u:any)=>u.id===userId);
  if(!ok)return NextResponse.json({error:"Deleted user not found."},{status:404});
 }
 const values:any[]=[role];
 let q="SELECT l.id lesson_id,l.class_id,l.starts_at,l.ends_at,l.status,l.lesson_type,l.room_code,t.full_name teacher_name,st.full_name student_name,coalesce(si.level,'Beginner') student_level,mat.title material_title,lr.id report_id,lr.notes,lr.homework,lr.scores,lr.assessment,lr.report_status,lr.updated_at,r.id recording_id,r.storage_url recording_url,r.duration_seconds recording_duration,r.created_at recording_created_at FROM lessons l JOIN users t ON t.id=l.teacher_id JOIN users st ON st.id=l.student_id LEFT JOIN students si ON si.user_id=st.id LEFT JOIN LATERAL(SELECT m.title FROM lesson_materials lm JOIN materials m ON m.id=lm.material_id WHERE lm.lesson_id=l.id ORDER BY m.sequence_no,m.title LIMIT 1) mat ON true LEFT JOIN lesson_records lr ON lr.lesson_id=l.id LEFT JOIN recordings r ON r.lesson_id=l.id WHERE ($1='TEACHER' AND t.deleted_at IS NOT NULL) OR ($1='STUDENT' AND st.deleted_at IS NOT NULL)";
 if(userId){q+=" AND "+(role==="TEACHER"?"l.teacher_id":"l.student_id")+"=$2";values.push(userId)}
 q+=" ORDER BY l.starts_at DESC LIMIT 1000";
 const history=(await query(q,values)).rows;
 return NextResponse.json({users,history});
}