import {cookies} from "next/headers";
import {SignJWT,jwtVerify} from "jose";
import {query} from "./db";

const secret=new TextEncoder().encode(process.env.AUTH_SECRET||"change-me");
const COOKIE="gea_session";
export type SessionUser={id:string;email:string;name:string;role:"ADMIN"|"TEACHER"|"STUDENT"|"PARENT";mustChangePassword?:boolean};

export async function createSessionToken(user:SessionUser){
  return new SignJWT(user).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(secret);
}

export function setSessionCookie(response:Response,token:string){
  const value=[
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "Max-Age=604800",
    "HttpOnly",
    "SameSite=Lax",
    ...(process.env.NODE_ENV==="production"?["Secure"]:[]),
  ].join("; ");
  response.headers.append("Set-Cookie",value);
}

export async function createSession(user:SessionUser){
  const token=await createSessionToken(user);
  cookies().set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:604800});
  return token;
}

export async function getSession():Promise<SessionUser|null>{
  const token=cookies().get(COOKIE)?.value;
  if(!token)return null;
  try{
    const {payload}=await jwtVerify(token,secret);
    const id=String(payload.id);
    const r=await query<any>("SELECT id,email,full_name name,role,active,deleted_at,must_change_password FROM users WHERE id=$1",[id]);
    if(!r.rowCount)return null;
    const user=r.rows[0];
    if(user.deleted_at||user.active===false)return null;
    return {
      id:String(user.id),
      email:String(user.email),
      name:String(user.name),
      role:user.role as SessionUser["role"],
      mustChangePassword:user.must_change_password===true
    };
  }catch{return null;}
}

export function clearSession(){
  cookies().set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0});
}

export async function requireRole(roles:SessionUser["role"][]){
  const s=await getSession();
  if(!s||!roles.includes(s.role))throw new Error("UNAUTHORIZED");
  return s;
}

export async function userExists(){
  const r=await query<{count:string}>("SELECT count(*)::text count FROM users");
  return Number(r.rows[0].count)>0;
}