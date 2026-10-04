import {NextResponse} from "next/server";
import {query} from "@/lib/db";
import {requireRole} from "@/lib/auth";

export const dynamic="force-dynamic";

export async function GET(req:Request){
  const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
  const url=new URL(req.url);
  const roomCode=String(url.searchParams.get("roomCode")||"");
  const after=String(url.searchParams.get("after")||"1970-01-01T00:00:00.000Z");
  if(!roomCode)return NextResponse.json({error:"roomCode is required."},{status:400});
  const r=await query(
    "SELECT id,room_code,sender_id,payload,created_at FROM classroom_signals WHERE room_code=$1 AND created_at>$2 ORDER BY created_at ASC LIMIT 200",
    [roomCode,after]
  );
  return NextResponse.json({userId:s.id,signals:r.rows});
}

export async function POST(req:Request){
  const s=await requireRole(["ADMIN","TEACHER","STUDENT"]);
  const body=await req.json();
  const roomCode=String(body.roomCode||"");
  const payload=body.payload;
  if(!roomCode||!payload)return NextResponse.json({error:"roomCode and payload are required."},{status:400});
  if(JSON.stringify(payload).length>200000)return NextResponse.json({error:"Signal payload is too large."},{status:413});
  const lesson=await query<any>("SELECT id,teacher_id,student_id FROM lessons WHERE room_code=$1",[roomCode]);
  if(!lesson.rowCount)return NextResponse.json({error:"Classroom not found."},{status:404});
  const l=lesson.rows[0];
  if(s.id!==l.teacher_id&&s.id!==l.student_id&&s.role!=="ADMIN")return NextResponse.json({error:"Not allowed."},{status:403});
  const r=await query(
    "INSERT INTO classroom_signals(room_code,sender_id,payload) VALUES($1,$2,$3::jsonb) RETURNING id,created_at",
    [roomCode,s.id,JSON.stringify(payload)]
  );
  return NextResponse.json(r.rows[0]);
}
