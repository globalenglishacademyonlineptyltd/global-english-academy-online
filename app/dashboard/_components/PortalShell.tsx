"use client";
import{useEffect,useRef,useState}from"react";
import Link from"next/link";
import{usePathname}from"next/navigation";

type U={id:string;name:string;email:string;role:"ADMIN"|"TEACHER"|"STUDENT"|"PARENT";mustChangePassword?:boolean};

const adminNav=[["Dashboard","/dashboard"],["Add/Remove Teacher","/dashboard/teachers"],["Add/Remove Students","/dashboard/students"],["View Teachers","/dashboard/view-teachers"],["View Students","/dashboard/view-students"],["Deleted Teacher Histories","/dashboard/deleted-teachers"],["Deleted Student Histories","/dashboard/deleted-students"],["Lessons","/dashboard/lessons"],["Global Calendar","/dashboard/calendar"],["Cancellation Requests","/dashboard/cancellations"],["Teacher Leave Requests","/dashboard/teacher-leave"],["Teacher Availability","/dashboard/teacher-availability"],["Open Weekly Slots","/dashboard/open-weekly-slots"],["Teacher Score","/dashboard/teacher-score"],["Materials","/dashboard/materials"],["Recordings","/dashboard/recordings"],["School Branding","/dashboard/branding"],["Comm Centre","/dashboard/comm-center"],["Change Password","/change-password"]];
const teacherNav=[["My Session","/dashboard"],["Teaching Record","/dashboard/records"],["Booking Time","/dashboard/availability"],["Score","/dashboard/score"],["Training","/dashboard/training"],["Comm Centre","/dashboard/comm-center"],["Personal Information","/dashboard/profile"],["Change Password","/change-password"]];
const studentNav=[["My Lessons","/dashboard"],["Book a Lesson","/dashboard/book"],["Lesson History","/dashboard/records"],["Rate Teachers","/dashboard/rate-teachers"],["Comm Centre","/dashboard/comm-center"],["Personal Information","/dashboard/profile"],["Change Password","/change-password"]];

function pageTitle(path:string,u:U){
 if(path==="/dashboard")return u.role==="ADMIN"?`Welcome, ${u.name}`:"My Session";
 const titles:[[string,string],...Array<[string,string]>]=[
  ["/dashboard/teachers","Add / Remove Teacher"],["/dashboard/students","Add / Remove Students"],["/dashboard/view-teachers","View Teachers"],["/dashboard/view-students","View Students"],
  ["/dashboard/deleted-teachers","Deleted Teacher Histories"],["/dashboard/deleted-students","Deleted Student Histories"],["/dashboard/lessons","Lessons"],["/dashboard/calendar","Global Calendar"],
  ["/dashboard/cancellations","Cancellation Requests"],["/dashboard/teacher-leave","Teacher Leave Requests"],["/dashboard/teacher-availability","Teacher Availability"],["/dashboard/open-weekly-slots","Open Weekly Slots"],
  ["/dashboard/teacher-score","Teacher Score"],["/dashboard/materials","Materials"],["/dashboard/recordings","Recordings"],["/dashboard/branding","School Branding"],["/dashboard/comm-center","Comm Centre"],
  ["/dashboard/records",u.role==="STUDENT"?"Lesson History":"Teaching Record"],["/dashboard/availability","Booking Time"],["/dashboard/score","Score"],["/dashboard/training","Training"],
  ["/dashboard/profile","Personal Information"],["/dashboard/book","Book a Lesson"],["/dashboard/rate-teachers","Rate Teachers"],["/change-password","Change Password"]
 ];
 return titles.find(([p])=>path===p)?.[1]||"Global English Academy";
}

export default function PortalShell({children}:{children:React.ReactNode}){
 const[u,setU]=useState<U|null>(null),[branding,setBranding]=useState<any>(null),[open,setOpen]=useState(false);
 const wrap=useRef<HTMLDivElement>(null),pathname=usePathname();
 useEffect(()=>{let alive=true;fetch("/api/me",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(!alive)return;if(!j.user){window.location.replace("/login");return}setU(j.user)}).catch(()=>{if(alive)window.location.replace("/login")});fetch("/api/branding",{cache:"no-store"}).then(r=>r.ok?r.json():null).then(x=>alive&&setBranding(x)).catch(()=>{});return()=>{alive=false}},[]);
 useEffect(()=>setOpen(false),[pathname]);
 useEffect(()=>{const onPointer=(e:PointerEvent)=>{if(wrap.current&&!wrap.current.contains(e.target as Node))setOpen(false)};const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape")setOpen(false)};document.addEventListener("pointerdown",onPointer);document.addEventListener("keydown",onKey);return()=>{document.removeEventListener("pointerdown",onPointer);document.removeEventListener("keydown",onKey)}},[]);
 async function logout(){try{await fetch("/api/auth/logout",{method:"POST"})}finally{window.location.replace("/login")}}
 if(!u)return <>{children}</>;
 const nav=u.role==="ADMIN"?adminNav:u.role==="TEACHER"?teacherNav:studentNav;
 const roleClass=u.role==="ADMIN"?"portal-admin":u.role==="TEACHER"?"portal-teacher":"portal-student";
 const title=pageTitle(pathname,u);
 const kicker=u.role==="ADMIN"?"SCHOOL ADMINISTRATION":u.role==="TEACHER"?"TEACHER PORTAL":"STUDENT PORTAL";
 return <div className={roleClass}>
   <div ref={wrap} className="global-portal-menu-wrap">
     <button type="button" className="global-portal-menu-button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label="Open menu"><span>☰</span></button>
     {open&&<div className="global-portal-dropdown">
       <div className="global-portal-dropdown-title">Global English Academy</div>
       {nav.map(([label,href])=><Link key={href} href={href} className={pathname===href?"active":""} onClick={()=>setOpen(false)}>{label}</Link>)}
       <button type="button" onClick={logout}>Sign out</button>
     </div>}
   </div>
   <div className="global-portal-brand">{branding?.logo_data?<img src={branding.logo_data} alt="Global English Academy Online"/>:<strong>GEA</strong>}</div>
   <div className="global-portal-top-space" aria-hidden="true"/>
   <header className="global-portal-header">
     <div className="global-portal-header-title"><div className="portal-kicker">{kicker}</div><h1>{title}</h1>{u.role==="ADMIN"&&pathname==="/dashboard"&&<div className="muted">School administration</div>}</div>
     <div className="teacher-chip global-portal-user"><span className="teacher-avatar">{u.name?.slice(0,1).toUpperCase()}</span><span><strong>{u.name}</strong><small>{u.email}</small></span></div>
   </header>
   <main className="global-portal-page">{children}</main>
 </div>;
}
