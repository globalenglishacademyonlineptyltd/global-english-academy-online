import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";

export async function GET(req:Request){
 const s=await requireRole(["ADMIN","TEACHER"]);
 const p=new URL(req.url).searchParams,lessonId=p.get("lessonId"),materialId=p.get("materialId");
 if(!lessonId||!materialId)return NextResponse.json({error:"Lesson and material are required."},{status:400});
 const r=await query<any>("SELECT m.content_data,m.url,m.mime_type,m.title,l.teacher_id,l.student_id FROM lesson_materials lm JOIN materials m ON m.id=lm.material_id JOIN lessons l ON l.id=lm.lesson_id WHERE lm.lesson_id=$1 AND lm.material_id=$2",[lessonId,materialId]);
 if(!r.rowCount)return NextResponse.json({error:"Material not found for this lesson."},{status:404});
 const m=r.rows[0];
 if(s.role!=="ADMIN"&&s.id!==m.teacher_id)return NextResponse.json({error:"Not authorized."},{status:403});
 if(m.content_data?.startsWith("data:")){
  const match=String(m.content_data).match(/^data:([^;]+);base64,(.*)$/s);
  if(!match)return NextResponse.json({error:"Invalid material file."},{status:500});
  return new NextResponse(Buffer.from(match[2],"base64"),{headers:{"Content-Type":match[1]||m.mime_type||"application/octet-stream","Content-Disposition":"inline; filename*=UTF-8''"+encodeURIComponent(m.title||"lesson-material"),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }
 if(m.url)return NextResponse.redirect(m.url);
 return NextResponse.json({error:"No material file is attached."},{status:404});
}