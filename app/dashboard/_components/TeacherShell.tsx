"use client";
import{useEffect,useState}from"react";
import Link from"next/link";
type U={id:string;name:string;email:string;role:string};
const nav=[
["My Session","/dashboard"],["Teaching Record","/dashboard/records"],["Booking Time","/dashboard/availability"],["Score","/dashboard/score"],["Training","/dashboard/training"],["Comm Centre","/dashboard/comm-center"],["Personal Information","/dashboard/profile"],["Change Password","/change-password"]
];
export default function TeacherShell({active,children}:{active:string;children:React.ReactNode}){
 const[u,setU]=useState<U|null>(null),[branding,setBranding]=useState<any>(null),[menuOpen,setMenuOpen]=useState(false);
 useEffect(()=>{fetch("/api/me",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(!j.user){location.href="/login";return}if(j.user.role!=="TEACHER"){location.href="/dashboard";return}setU(j.user)});fetch("/api/branding",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(setBranding).catch(()=>{})},[]);
 async function logout(){await fetch("/api/auth/logout",{method:"POST"});location.href="/login"}
 if(!u)return <main className="login"><div className="login-card">Loading…</div></main>;
 return <div className="teacher-menu-shell"><div className="teacher-menu-wrap"><button className="teacher-menu-button" onClick={()=>setMenuOpen(v=>!v)} aria-expanded={menuOpen}><span className="teacher-menu-icon">☰</span><span>Menu</span><span className="teacher-menu-chevron">{menuOpen?"▲":"▼"}</span></button>{menuOpen&&<div className="teacher-dropdown"><div className="teacher-dropdown-title">Global English Academy</div>{nav.map(([label,href])=><Link key={href} href={href} className={active===label?"active":""} onClick={()=>setMenuOpen(false)}>{label}</Link>)}<button onClick={logout}>Sign out</button></div>}</div><div className="teacher-menu-brand">{branding?.logo_data?<img src={branding.logo_data} alt="Global English Academy"/>:<div className="brand-mark">GEA</div>}</div><div className="portal-content"><header className="portal-header"><div><div className="portal-kicker">TEACHER PORTAL</div><h1>{active}</h1></div><div className="teacher-chip"><span className="teacher-avatar">{u.name?.slice(0,1).toUpperCase()}</span><span><strong>{u.name}</strong><small>{u.email}</small></span></div></header>{children}</div></div>
}