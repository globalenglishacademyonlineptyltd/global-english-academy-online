"use client";
import{useEffect,useState}from"react";
type U={id:string;name:string;email:string;role:string};
export default function TeacherShell({active,children}:{active:string;children:React.ReactNode}){
 const[u,setU]=useState<U|null>(null);
 useEffect(()=>{let alive=true;fetch("/api/me",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(!alive)return;if(!j.user){window.location.replace("/login");return}if(!["TEACHER","STUDENT"].includes(j.user.role)){window.location.replace("/dashboard");return}setU(j.user)}).catch(()=>{if(alive)window.location.replace("/login")});return()=>{alive=false}},[]);
 if(!u)return <main className="login"><div className="login-card">Loading…</div></main>;
 return <div className="teacher-page-shell"><div className="portal-content"><header className="portal-header"><div><div className="portal-kicker">{u.role==="STUDENT"?"STUDENT PORTAL":"TEACHER PORTAL"}</div><h1>{active}</h1></div><div className="teacher-chip"><span className="teacher-avatar">{u.name?.slice(0,1).toUpperCase()}</span><span><strong>{u.name}</strong><small>{u.email}</small></span></div></header>{children}</div></div>
}
