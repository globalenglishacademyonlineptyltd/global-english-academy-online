import {cookies} from "next/headers";import {SignJWT,jwtVerify} from "jose";import {query} from "./db";
const secret=new TextEncoder().encode(process.env.AUTH_SECRET||"change-me");const COOKIE="gea_session";
export type SessionUser={id:string;email:string;name:string;role:"ADMIN"|"TEACHER"|"STUDENT"};
export async function createSession(user:SessionUser){const token=await new SignJWT(user).setProtectedHeader({alg:"HS256"}).setIssuedAt().setExpirationTime("7d").sign(secret);cookies().set(COOKIE,token,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:604800})}
export async function getSession():Promise<SessionUser|null>{const token=cookies().get(COOKIE)?.value;if(!token)return null;try{const {payload}=await jwtVerify(token,secret);return{id:String(payload.id),email:String(payload.email),name:String(payload.name),role:payload.role as SessionUser["role"]}}catch{return null}}
export function clearSession(){cookies().set(COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:0})}
export async function requireRole(roles:SessionUser["role"][]){const s=await getSession();if(!s||!roles.includes(s.role))throw new Error("UNAUTHORIZED");return s}
export async function userExists(){const r=await query<{count:string}>("SELECT count(*)::text count FROM users");return Number(r.rows[0].count)>0}