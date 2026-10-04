import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";

export async function GET(req:Request){
 const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
 const lessonId=new URL(req.url).searchParams.get("lessonId");
 if(!lessonId)return NextResponse.json({error:"Lesson is required."},{status:400});
 const lesson=await query<any>("SELECT id,teacher_id,student_id FROM lessons WHERE id=$1",[lessonId]);
 if(!lesson.rowCount)return NextResponse.json({error:"Lesson not found."},{status:404});
 const l=lesson.rows[0];
 if(s.role!=="ADMIN"&&s.id!==l.teacher_id&&s.id!==l.student_id)return NextResponse.json({error:"Not authorized."},{status:403});
 const r=await query("SELECT m.id,m.title,m.description,m.level,m.folder,m.sequence_no,m.mime_type,m.url,m.content_data,lm.lesson_id FROM lesson_materials lm JOIN materials m ON m.id=lm.material_id WHERE lm.lesson_id=$1 ORDER BY m.level,m.created_at",[lessonId]);
 return NextResponse.json(r.rows);
}

export async function POST(req:Request){
 await requireRole(["ADMIN"]);
 const{lessonId,materialId}=await req.json();
 if(!lessonId||!materialId)return NextResponse.json({error:"Lesson and material are required."},{status:400});
 const lesson=await query("SELECT id FROM lessons WHERE id=$1",[lessonId]);
 const material=await query("SELECT id FROM materials WHERE id=$1",[materialId]);
 if(!lesson.rowCount||!material.rowCount)return NextResponse.json({error:"Lesson or material not found."},{status:404});
 await query("INSERT INTO lesson_materials(lesson_id,material_id) VALUES($1,$2) ON CONFLICT DO NOTHING",[lessonId,materialId]);
 return NextResponse.json({ok:true});
}

export async function DELETE(req:Request){
 await requireRole(["ADMIN"]);
 const{lessonId,materialId}=await req.json();
 if(!lessonId||!materialId)return NextResponse.json({error:"Lesson and material are required."},{status:400});
 await query("DELETE FROM lesson_materials WHERE lesson_id=$1 AND material_id=$2",[lessonId,materialId]);
 return NextResponse.json({ok:true});
}