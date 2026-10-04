"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type User = { id:string; name:string; email:string; role:"ADMIN"|"TEACHER"|"STUDENT"|"PARENT" };
type Message = { id:string; title:string; message:string; link?:string; audience?:string; read_at?:string|null; created_at:string; recipient_name?:string; recipient_email?:string };

const adminNav = [
  ["Dashboard","/dashboard"],["Teachers","/dashboard/teachers"],["Students","/dashboard/students"],["Lessons","/dashboard/lessons"],
  ["Cancellation Requests","/dashboard/cancellations"],["Teacher Leave Requests","/dashboard/teacher-leave"],["Teacher Availability","/dashboard/teacher-availability"],
  ["Teacher Score","/dashboard/teacher-score"],["Materials","/dashboard/materials"],["Recordings","/dashboard/recordings"],["School Branding","/dashboard/branding"],["Comm Centre","/dashboard/comm-center"]
];

export default function CommCenter(){
  const [u,setU]=useState<User|null>(null);
  const [items,setItems]=useState<Message[]>([]);
  const [teachers,setTeachers]=useState<User[]>([]);
  const [students,setStudents]=useState<User[]>([]);
  const [teacherId,setTeacherId]=useState("");
  const [studentId,setStudentId]=useState("");
  const [title,setTitle]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [sent,setSent]=useState("");
  const [openId,setOpenId]=useState<string|null>(null);
  const [adminMenuOpen,setAdminMenuOpen]=useState(false);\n  const [branding,setBranding]=useState<any>(null);

  async function load(){
    const m=await fetch("/api/me",{cache:"no-store"});
    const mj=await m.json();
    if(!mj.user){location.href="/login";return}
    setU(mj.user);
    const b=await fetch("/api/branding",{cache:"no-store"});
    if(b.ok){const bj=await b.json();setBranding(bj)}
    const n=await fetch("/api/notifications",{cache:"no-store"});
    if(n.ok){const j=await n.json();setItems(j.items||[])}
    if(mj.user.role==="ADMIN"){
      const [t,s]=await Promise.all([
        fetch("/api/teachers",{cache:"no-store"}),
        fetch("/api/students",{cache:"no-store"})
      ]);
      if(t.ok)setTeachers(await t.json());
      if(s.ok)setStudents(await s.json());
    }
  }

  useEffect(()=>{load()},[]);

  async function send(){
    setError("");setSent("");
    const ids=[teacherId,studentId].filter(Boolean);
    if(!ids.length){setError("Please select a teacher or a student.");return}
    if(!title.trim()||!message.trim()){setError("Please enter a subject and message.");return}
    setBusy(true);
    try{
      const r=await fetch("/api/notifications",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({title,message,audience:"DIRECT",userIds:ids})
      });
      const j=await r.json();
      if(!r.ok){setError(j.error||"Could not send notification.");return}
      setTitle("");setMessage("");setTeacherId("");setStudentId("");
      setSent("Notification sent successfully to "+j.sent+" recipient"+(j.sent===1?"":"s")+".");
      await load();
    }catch{setError("Could not send notification. Please try again.")}
    finally{setBusy(false)}
  }

  async function openMessage(item:Message){
    setOpenId(item.id);
    if(!item.read_at){
      await fetch("/api/notifications",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action:"markRead",notificationId:item.id})
      });
      setItems(v=>v.map(x=>x.id===item.id?{...x,read_at:new Date().toISOString()}:x));
    }
  }

  async function logout(){
    await fetch("/api/auth/logout",{method:"POST"});
    location.href="/login";
  }

  if(!u)return <main className="login"><div className="login-card">Loading…</div></main>;

  const opened=items.find(x=>x.id===openId)||null;

  if(u.role==="ADMIN"){
    return <div className="shell admin-shell">
      <div className="admin-menu-wrap">
        <button className="admin-menu-button" onClick={()=>setAdminMenuOpen(v=>!v)} aria-expanded={adminMenuOpen}>
          <span className="admin-menu-icon">☰</span><span>Menu</span><span className="admin-menu-chevron">{adminMenuOpen?"▲":"▼"}</span>
        </button>
        {adminMenuOpen&&<div className="admin-dropdown">
          <div className="admin-dropdown-title">Global English Academy</div>
          {adminNav.map(([label,href])=><Link key={href} href={href} className={label==="Comm Centre"?"active":""} onClick={()=>setAdminMenuOpen(false)}>{label}</Link>)}
          <button onClick={logout}>Sign out</button>
        </div>}
      </div>
      <div className="role-brand-logo admin-role-logo">{branding?.logo_data&&<img src={branding.logo_data} alt="Global English Academy Online" />}</div>
      <main className="main">
        <div className="topbar"><div><h1>Comm Centre</h1><div className="muted">Admin communication centre</div></div><span className="badge">ADMIN</span></div>

        <section className="section">
          <h2>Send Notification</h2>
          <p className="muted">Only Admin can send notifications. Select a teacher, a student, or one of each.</p>
          <div className="card">
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              <div>
                <label>Teacher</label>
                <select value={teacherId} onChange={e=>setTeacherId(e.target.value)}>
                  <option value="">Select a teacher</option>
                  {teachers.filter(x=>x.active!==false).map(x=><option key={x.id} value={x.id}>{x.name} — {x.email}</option>)}
                </select>
              </div>
              <div>
                <label>Student</label>
                <select value={studentId} onChange={e=>setStudentId(e.target.value)}>
                  <option value="">Select a student</option>
                  {students.filter(x=>x.active!==false).map(x=><option key={x.id} value={x.id}>{x.name} — {x.email}</option>)}
                </select>
              </div>
            </div>
            <label style={{display:"block",marginTop:16}}>Subject</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Enter notification subject" />
            <label style={{display:"block",marginTop:16}}>Comment</label>
            <textarea value={message} onChange={e=>setMessage(e.target.value)} rows={7} placeholder="Write the notification..." />
            <div style={{display:"flex",gap:12,alignItems:"center",marginTop:16,flexWrap:"wrap"}}>
              <button className="primary" disabled={busy} onClick={send}>{busy?"Sending…":"Send Notification"}</button>
              {sent&&<span style={{color:"#15803d"}}>{sent}</span>}
              {error&&<span style={{color:"#b91c1c"}}>{error}</span>}
            </div>
          </div>
        </section>

        <section className="section">
          <h2>Sent Notifications</h2>
          <table className="table"><thead><tr><th>Date & Time</th><th>Notification</th><th>Recipient</th></tr></thead><tbody>
            {items.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString()}</td><td><button onClick={()=>openMessage(x)} style={{background:"none",border:0,padding:0,cursor:"pointer",fontWeight:700,textAlign:"left"}}>{x.title}</button></td><td>{x.recipient_name||x.recipient_email||"—"}</td></tr>)}
            {!items.length&&<tr><td colSpan={3}>No notifications sent yet.</td></tr>}
          </tbody></table>
        </section>
      </main>

      {opened&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:500}}>
        <div className="card" style={{maxWidth:700,width:"100%"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"start"}}><div><div className="muted">{new Date(opened.created_at).toLocaleString()}</div><h2 style={{marginTop:6}}>{opened.title}</h2></div><button onClick={()=>setOpenId(null)}>Close</button></div>
          <div style={{marginTop:18,whiteSpace:"pre-wrap",lineHeight:1.6}}>{opened.message}</div>
        </div>
      </div>}
    </div>
  }

  return <div className="teacher-menu-shell">
    <div className="teacher-menu-wrap"><button className="teacher-menu-button" onClick={()=>setAdminMenuOpen(v=>!v)} aria-expanded={adminMenuOpen}><span className="teacher-menu-icon">☰</span><span>Menu</span><span className="teacher-menu-chevron">{adminMenuOpen?"▲":"▼"}</span></button>{adminMenuOpen&&<div className="teacher-dropdown">
      <div className="teacher-dropdown-title">Global English Academy</div>
      {(u.role==="TEACHER"?[["My Session","/dashboard"],["Teaching Record","/dashboard/records"],["Score","/dashboard/score"],["Booking Time","/dashboard/availability"],["Training","/dashboard/training"],["Comm Centre","/dashboard/comm-center"],["Personal Information","/dashboard/profile"],["Change Password","/change-password"]]:[["My Lessons","/dashboard"],["Book a Lesson","/dashboard/book"],["Lesson History","/dashboard/records"],["Rate Teachers","/dashboard/rate-teachers"],["Comm Centre","/dashboard/comm-center"]]).map(([label,href])=><Link key={href} href={href} className={label==="Comm Centre"?"active":""} onClick={()=>setAdminMenuOpen(false)}>{label}</Link>)}
      <button onClick={logout}>Sign out</button>
    </div>}</div>
    <div className="teacher-menu-brand">{branding?.logo_data?<img src={branding.logo_data} alt="Global English Academy Online" />:<div className="brand-mark">GEA</div>}</div>
    <div className="portal-content">
      <header className="portal-header"><div><div className="portal-kicker">{u.role==="TEACHER"?"TEACHER PORTAL":"STUDENT PORTAL"}</div><h1>Comm Centre</h1></div><div className="teacher-chip"><span className="teacher-avatar">{u.name?.slice(0,1).toUpperCase()}</span><span><strong>{u.name}</strong><small>{u.email}</small></span></div></header>
      <section className="section">
        <h2>Notifications</h2>
        <p className="muted">Notifications from the Admin are read-only. You cannot reply or send messages.</p>
        <table className="table"><thead><tr><th>Date & Time</th><th>Notification</th></tr></thead><tbody>
          {items.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString()}</td><td><button onClick={()=>openMessage(x)} style={{background:"none",border:0,padding:0,cursor:"pointer",fontWeight:700,textAlign:"left"}}>{x.title}</button>{!x.read_at&&<span className="badge" style={{marginLeft:10}}>NEW</span>}</td></tr>)}
          {!items.length&&<tr><td colSpan={2}>No notifications yet.</td></tr>}
        </tbody></table>
      </section>
    </div>
    {opened&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:500}}>
      <div className="card" style={{maxWidth:700,width:"100%"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"start"}}><div><div className="muted">{new Date(opened.created_at).toLocaleString()}</div><h2 style={{marginTop:6}}>{opened.title}</h2></div><button onClick={()=>setOpenId(null)}>Close</button></div>
        <div style={{marginTop:18,whiteSpace:"pre-wrap",lineHeight:1.6}}>{opened.message}</div>
      </div>
    </div>}
  </div>;
}
