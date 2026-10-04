import{NextResponse}from"next/server";import bcrypt from"bcryptjs";import{query}from"@/lib/db";import{requireRole,createSessionToken,setSessionCookie}from"@/lib/auth";
export async function POST(req:Request){
  try{
    const s=await requireRole(["ADMIN","TEACHER","STUDENT","PARENT"]);
    const{oldPassword,newPassword,confirmPassword}=await req.json();
    if(!oldPassword||!newPassword||!confirmPassword)return NextResponse.json({error:"All password fields are required."},{status:400});
    if(newPassword.length<8)return NextResponse.json({error:"New password must be at least 8 characters."},{status:400});
    if(newPassword!==confirmPassword)return NextResponse.json({error:"New password and Confirm Password must match."},{status:400});
    const r=await query<any>("SELECT id,email,full_name,role,password_hash FROM users WHERE id=$1 AND deleted_at IS NULL AND active=true",[s.id]);
    if(!r.rowCount)return NextResponse.json({error:"Account not found."},{status:404});
    const user=r.rows[0];
    const valid=await bcrypt.compare(oldPassword,String(user.password_hash));
    if(!valid)return NextResponse.json({error:"Old Password is incorrect."},{status:400});
    if(await bcrypt.compare(newPassword,String(user.password_hash)))return NextResponse.json({error:"New Password must be different from your Old Password."},{status:400});
    await query("UPDATE users SET password_hash=$1,must_change_password=false WHERE id=$2",[await bcrypt.hash(newPassword,12),s.id]);
    const token=await createSessionToken({id:String(user.id),email:String(user.email),name:String(user.full_name),role:user.role,mustChangePassword:false});
    const response=NextResponse.json({ok:true,message:"Password changed successfully."});
    setSessionCookie(response,token);
    return response;
  }catch{return NextResponse.json({error:"Could not change password."},{status:500})}
}