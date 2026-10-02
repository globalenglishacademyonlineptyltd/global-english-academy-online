import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";

export async function GET(){
  await requireRole(["ADMIN","TEACHER","STUDENT"]);
  const r=await query("SELECT m.*,u.full_name creator_name FROM materials m LEFT JOIN users u ON u.id=m.created_by ORDER BY m.level,m.created_at DESC");
  return NextResponse.json(r.rows)
}

export async function POST(req:Request){
  const s=await requireRole(["ADMIN"]);
  const{title,description,url,level,contentData,mimeType}=await req.json();
  if(!title)return NextResponse.json({error:"Title required"},{status:400});
  if(contentData&&String(contentData).length>12*1024*1024)return NextResponse.json({error:"Uploaded file is too large. Please keep files under 9 MB."},{status:413});
  const r=await query("INSERT INTO materials(title,description,url,level,content_data,mime_type,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",[title,description||"",url||"",level||"",contentData||"",mimeType||"",s.id]);
  return NextResponse.json(r.rows[0])
}