"use client";
import{useEffect,useRef,useState}from"react";
import Link from"next/link";
import{usePathname}from"next/navigation";

type U={id:string;name:string;email:string;role:"ADMIN"|"TEACHER"|"STUDENT"|"PARENT";mustChangePassword?:boolean};

const adminNav=[["Dashboard","/dashboard"],["Add/Remove Teacher","/dashboard/teachers"],["Add/Remove Students","/dashboard/students"],["View Teachers","/dashboard/view-teachers"],["View Students","/dashboard/view-students"],["Deleted Teacher Histories","/dashboard/deleted-teachers"],["Deleted Student Histories","/dashboard/deleted-students"],["Lessons","/dashboard/lessons"],["Global Calendar","/dashboard/calendar"],["Cancellation Requests","/dashboard/cancellations"],["Teacher Leave Requests","/dashboard/teacher-leave"],["Teacher Availability","/dashboard/teacher-availability"],["Open Weekly Slots","/dashboard/open-weekly-slots"],["Teacher Score","/dashboard/teacher-score"],["Materials","/dashboard/materials"],["Recordings","/dashboard/recordings"],["School Branding","/dashboard/branding"],["Comm Centre","/dashboard/comm-center"],["Change Password","/change-password"]];
const teacherNav=[["My Session","/dashboard"],["Teaching Record","/dashboard/records"],["Booking Time","/dashboard/availability"],["Score","/dashboard/score"],["Training","/dashboard/training"],["Comm Centre","/dashboard/comm-center"],["Personal Information","/dashboard/profile"],["Change Password","/change-password"]];
const studentNav=[["My Lessons","/dashboard"],["Book a Lesson","/dashboard/book"],["Lesson History","/dashboard/records"],["Rate Teachers","/dashboard/rate-teachers"],["Comm Centre","/dashboard/comm-center"],["Personal Information","/dashboard/profile"],["Change Password","/change-password"]];

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
   {children}
 </div>;
}
