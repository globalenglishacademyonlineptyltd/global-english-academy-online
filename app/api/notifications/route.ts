import{NextResponse}from"next/server";import{query}from"@/lib/db";import{requireRole}from"@/lib/auth";

async function setup(){await query(`CREATE TABLE IF NOT EXISTS notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL,
 message text NOT NULL,
 link text DEFAULT '',
 read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
)`);}

export async function GET(){const s=await requireRole(["ADMIN","TEACHER","STUDENT","PARENT"]);try{await setup();const r=await query("SELECT id,title,message,link,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",[s.id]);return NextResponse.json(r.rows)}catch{return NextResponse.json({error:"Could not load notifications."},{status:500})}}

export async function POST(req:Request){const s=await requireRole(["ADMIN"]);try{await setup();const{userId,title,message,link}=await req.json();if(!userId||!title||!message)return NextResponse.json({error:"Notification details are required."},{status:400});const r=await query("INSERT INTO notifications(user_id,title,message,link) VALUES($1,$2,$3,$4) RETURNING *",[userId,title,message,link||""]);return NextResponse.json(r.rows[0])}catch{return NextResponse.json({error:"Could not create notification."},{status:500})}}