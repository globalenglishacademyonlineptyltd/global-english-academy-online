"use client";
import{useEffect,useState}from"react";
import Link from"next/link";
type U={id:string;name:string;email:string;role:string};
const nav=[
["My Session","/dashboard"],["Teaching Record","/dashboard/records"],["Booking Time","/dashboard/availability"],["Score","/dashboard/score"],["Training","/dashboard/training"],["Comm Centre","/dashboard/comm-center"],["Personal Information","/dashboard/profile"],["Change Password","/change-password"]
];
export default function TeacherShell({active,children}:{active:string;children:React.ReactNode}){
 const[u,setU]=useState<U|null>(null),[branding,setBranding]=useState<any>(null);
 useEffect(()=>{fetch("/api/me",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(!j.user){location.href="/login";return}if(j.user.role!=="TEACHER"){location.href="/dashboard";return}setU(j.user)});fetch("/api/branding",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(setBranding).catch(()=>{})},[]);
 async function logout(){await fetch("/api/auth/logout",{method:"POST"});location.href="/login"}
 if(!u)return <main className="login"><div className="login-card">Loading…</div></main>;
 return <div className="portal-shell"><aside className="portal-sidebar"><div className="portal-brand">{branding?.logo_data?<img src={branding.logo_data} alt="Global English Academy"/>:<div className="brand-mark">GEA</div>}<div><strong>{branding?.school_name||"Global English Academy"}</strong><small>ONLINE • Teacher Portal</small></div></div><nav className="portal-nav">{nav.map(([label,href])=><Link key={href} href={href} className={active===label?"active":""}>{label}</Link>)}<button onClick={logout}>Logout</button></nav><div className="portal-footer">Speak • Learn • Succeed</div></aside><div className="portal-content"><header className="portal-header"><div><div className="portal-kicker">TEACHER PORTAL</div><h1>{active}</h1></div><div className="teacher-chip"><span className="teacher-avatar">{u.name?.slice(0,1).toUpperCase()}</span><span><strong>{u.name}</strong><small>{u.email}</small></span></div></header>{children}</div></div>
}