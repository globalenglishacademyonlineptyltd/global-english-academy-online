import {NextResponse}from"next/server";
import bcrypt from"bcryptjs";
import{query}from"@/lib/db";
import{createSessionToken,setSessionCookie}from"@/lib/auth";
export const dynamic="force-dynamic";

export async function POST(req:Request){
  const{email,password}=await req.json();
  const r=await query<any>("SELECT id,email,password_hash,full_name,role,active FROM users WHERE lower(email)=lower($1)",[email]);
  const u=r.rows[0];
  if(!u||!u.active||!(await bcrypt.compare(password,u.password_hash)))return NextResponse.json({error:"Invalid email or password"},{status:401});
  const token=await createSessionToken({id:u.id,email:u.email,name:u.full_name,role:u.role});
  const response=NextResponse.json({ok:true,role:u.role});
  setSessionCookie(response,token);
  return response;
}