"use client";
import{useEffect,useState}from"react";
import TeacherShell from "../_components/TeacherShell";

export default function Profile(){
  const[u,setU]=useState<any>(null);
  useEffect(()=>{
    fetch("/api/me",{cache:"no-store"}).then(r=>r.json()).then(j=>{
      if(!j.user||!["TEACHER","STUDENT"].includes(j.user.role)){location.href="/dashboard";return}
      setU(j.user)
    })
  },[]);
  if(!u)return <main className="login"><div className="login-card">Loading…</div></main>;

  const roleLabel=u.role==="TEACHER"?"Teacher":"Student";

  return <TeacherShell active="Personal Information">
    <main className="teacher-page">
      <div className="profile-hero">
        <div className="profile-avatar">{u.name?.slice(0,1).toUpperCase()}</div>
        <div><h2>{u.name}</h2><p className="muted">{roleLabel} account</p></div>
      </div>
      <div className="profile-grid">
        <section className="card">
          <h3>Personal Information</h3>
          <p className="muted profile-readonly-note">These details are managed by Global English Academy. You can view them, but only an Admin can change them.</p>
          <div className="info-row"><span>Full name</span><strong>{u.name||"—"}</strong></div>
          <div className="info-row"><span>Email address</span><strong>{u.email||"—"}</strong></div>
          <div className="info-row"><span>Account type</span><strong>{roleLabel}</strong></div>
          <div className="info-row"><span>Account ID</span><strong>{u.id||"—"}</strong></div>
        </section>
        <section className="card">
          <h3>Account Access</h3>
          <p className="muted">Your profile information is view-only. If any personal information needs to be corrected, please contact the school Admin.</p>
          <a className="primary profile-link" href="/change-password">Change Password</a>
        </section>
      </div>
    </main>
  </TeacherShell>
}