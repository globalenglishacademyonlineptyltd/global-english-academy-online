import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";

export async function GET(){
 const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
 if(s.role==="ADMIN"){
  const r=await query("SELECT m.*,u.full_name creator_name FROM materials m LEFT JOIN users u ON u.id=m.created_by ORDER BY m.level,m.created_at DESC");
  return NextResponse.json(r.rows);
 }
 const r=await query("SELECT DISTINCT m.id,m.title,m.description,m.level,m.mime_type,m.created_at,u.full_name creator_name FROM lesson_materials lm JOIN materials m ON m.id=lm.material_id JOIN lessons l ON l.id=lm.lesson_id LEFT JOIN users u ON u.id=m.created_by WHERE "+(s.role==="TEACHER"?"l.teacher_id=$1":"l.student_id=$1")+" ORDER BY m.level,m.created_at DESC",[s.id]);
 return NextResponse.json(r.rows);
}

export async function POST(req:Request){
 const s=await requireRole(["ADMIN"]);
 const{title,description,url,level,contentData,mimeType}=await req.json();
 if(!title)return NextResponse.json({error:"Title required"},{status:400});
 if(contentData&&String(contentData).length>12*1024*1024)return NextResponse.json({error:"Uploaded file is too large. Please keep files under 9 MB."},{status:413});
 const r=await query("INSERT INTO materials(title,description,url,level,content_data,mime_type,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[title,description||"",url||"",level||"",contentData||"",mimeType||"",s.id]);
 return NextResponse.json(r.rows[0])
}