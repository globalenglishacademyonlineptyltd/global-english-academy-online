import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireRole } from "@/lib/auth";
export const dynamic = "force-dynamic";
async function ensureChatbotTables() {
 await query("CREATE TABLE IF NOT EXISTS geao_chatbot_leads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),contact_name text NOT NULL,contact_email text NOT NULL DEFAULT '',whatsapp_number text NOT NULL DEFAULT '',enquiry_type text NOT NULL DEFAULT 'Child (4–16)',student_name text NOT NULL DEFAULT '',student_age integer,country_timezone text NOT NULL DEFAULT '',english_level text NOT NULL DEFAULT '',preferred_times text NOT NULL DEFAULT '',follow_up_date date,notes text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'NEW' CHECK(status IN ('NEW','CONTACTED','QUOTED','ENROLLED','CLOSED')),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now())");
 await query("CREATE INDEX IF NOT EXISTS geao_chatbot_leads_created_idx ON geao_chatbot_leads(created_at DESC)");
}
export async function GET() {
 try { await requireRole(["ADMIN"]); await ensureChatbotTables();
 const r=await query("SELECT id,contact_name,contact_email,whatsapp_number,enquiry_type,student_name,student_age,country_timezone,english_level,preferred_times,follow_up_date::text,notes,status,created_at FROM geao_chatbot_leads ORDER BY created_at DESC LIMIT 500");
 return NextResponse.json({leads:r.rows,integration:{whatsapp:"not_connected",ai:"not_configured"}});
 } catch(e) { const m=e instanceof Error?e.message:""; return NextResponse.json({error:m==="UNAUTHORIZED"?"Admin access required.":"Could not load chatbot records."},{status:m==="UNAUTHORIZED"?403:500}); }
}
export async function POST(req:Request) {
 try { await requireRole(["ADMIN"]); await ensureChatbotTables(); const b=await req.json(); const name=String(b.contact_name||"").trim().slice(0,120); if(!name)return NextResponse.json({error:"Contact name is required."},{status:400});
 const age=b.student_age===""||b.student_age==null?null:Number(b.student_age); if(age!==null&&(!Number.isInteger(age)||age<4||age>99))return NextResponse.json({error:"Please enter a valid age."},{status:400});
 const r=await query("INSERT INTO geao_chatbot_leads(contact_name,contact_email,whatsapp_number,enquiry_type,student_name,student_age,country_timezone,english_level,preferred_times,follow_up_date,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,'')::date,$11) RETURNING id,contact_name,contact_email,whatsapp_number,enquiry_type,student_name,student_age,country_timezone,english_level,preferred_times,follow_up_date::text,notes,status,created_at",[name,String(b.contact_email||"").slice(0,160),String(b.whatsapp_number||"").slice(0,40),String(b.enquiry_type||"Child (4–16)").slice(0,40),String(b.student_name||"").slice(0,100),age,String(b.country_timezone||"").slice(0,100),String(b.english_level||"").slice(0,80),String(b.preferred_times||"").slice(0,160),String(b.follow_up_date||""),String(b.notes||"").slice(0,3000)]);
 return NextResponse.json({lead:r.rows[0]},{status:201});
 } catch(e) { const m=e instanceof Error?e.message:""; return NextResponse.json({error:m==="UNAUTHORIZED"?"Admin access required.":"Could not save the lead."},{status:m==="UNAUTHORIZED"?403:500}); }
}
export async function PATCH(req:Request) {
 try { await requireRole(["ADMIN"]); await ensureChatbotTables(); const b=await req.json(); const allowed=["NEW","CONTACTED","QUOTED","ENROLLED","CLOSED"]; if(!b.id||!allowed.includes(b.status))return NextResponse.json({error:"Invalid lead or status."},{status:400});
 const r=await query("UPDATE geao_chatbot_leads SET status=$2,updated_at=now() WHERE id=$1 RETURNING id,status",[b.id,b.status]); if(!r.rowCount)return NextResponse.json({error:"Lead not found."},{status:404}); return NextResponse.json({ok:true,lead:r.rows[0]});
 } catch(e) { const m=e instanceof Error?e.message:""; return NextResponse.json({error:m==="UNAUTHORIZED"?"Admin access required.":"Could not update the lead."},{status:m==="UNAUTHORIZED"?403:500}); }
}