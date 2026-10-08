"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PdfViewer from "@/app/components/PdfViewer";

type U = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  mustChangePassword?: boolean;
};

export default function Dashboard() {
  const [u, setU] = useState<U | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [cancellations, setCancellations] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [branding, setBranding] = useState<any>(null);
  const [serverTime, setServerTime] = useState(new Date());
  const [selectedLesson, setSelectedLesson] = useState<any>(null);
  const [teacherWorkbook, setTeacherWorkbook] = useState<any>(null);
  const [teacherNotePrompt, setTeacherNotePrompt] = useState(false);
  const [teacherNoteRead, setTeacherNoteRead] = useState(false);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Johannesburg" });
  const [searchStartDate, setSearchStartDate] = useState(today);
  const [searchEndDate, setSearchEndDate] = useState(today);
  const [searchTeacherId, setSearchTeacherId] = useState("");
  const [searchStudentId, setSearchStudentId] = useState("");
  const [adminSearchLoading, setAdminSearchLoading] = useState(false);
  async function rateTeacher(lessonId:string,rating:number){await fetch("/api/teacher-ratings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lessonId,rating})});}

  async function loadNotifications() {
    if (u?.role !== "STUDENT") return;
    try {
      const x = await fetch("/api/notifications", { cache: "no-store" });
      if (x.ok) setNotifications(await x.json());
    } catch {}
  }

  async function loadCancellationRequests() {
    if (u?.role !== "TEACHER" && u?.role !== "STUDENT") return;
    try {
      const x = await fetch("/api/cancellation-requests", { cache: "no-store" });
      if (x.ok) setCancellations(await x.json());
    } catch {}
  }

  useEffect(() => {
    fetch("/api/branding", { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : null))
      .then(setBranding)
      .catch(() => {});

    fetch("/api/me")
      .then((x) => x.json())
      .then((j) => {
        if (!j.user) location.href = "/login";
        else {
          setU(j.user);
          if (j.user.role === "ADMIN") {
            fetch("/api/materials", { cache: "no-store" })
              .then((x) => (x.ok ? x.json() : []))
              .then(setMaterials);
          }
        }
      });

    const lessonParams = new URLSearchParams({ startDate: today, endDate: today });
    fetch("/api/lessons?" + lessonParams.toString(), { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : []))
      .then(setLessons);
    fetch("/api/students", { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : []))
      .then(setStudents);
    fetch("/api/teachers", { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : []))
      .then(setTeachers);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setServerTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function searchAdminLessons() {
    if (u?.role !== "ADMIN" || !searchStartDate || !searchEndDate) return;
    setAdminSearchLoading(true);
    try {
      const p = new URLSearchParams({ startDate: searchStartDate, endDate: searchEndDate });
      if (searchTeacherId) p.set("teacherId", searchTeacherId);
      if (searchStudentId) p.set("studentId", searchStudentId);
      const x = await fetch("/api/lessons?" + p.toString(), { cache: "no-store" });
      if (x.ok) setLessons(await x.json());
    } finally {
      setAdminSearchLoading(false);
    }
  }

  useEffect(() => {
    if (!u?.role) return;
    const timer = setInterval(() => {
      const p = new URLSearchParams({ startDate: today, endDate: today });
      if (u.role === "ADMIN") {
        p.set("startDate", searchStartDate);
        p.set("endDate", searchEndDate);
        if (searchTeacherId) p.set("teacherId", searchTeacherId);
        if (searchStudentId) p.set("studentId", searchStudentId);
      }
      fetch("/api/lessons?" + p.toString(), { cache: "no-store" })
        .then((x) => (x.ok ? x.json() : []))
        .then(setLessons)
        .catch(() => {});
    }, 15000);
    return () => clearInterval(timer);
  }, [u?.role, searchStartDate, searchEndDate, searchTeacherId, searchStudentId, today]);

  useEffect(() => {
    if (u?.role !== "TEACHER" && u?.role !== "STUDENT") return;
    loadCancellationRequests();
    loadNotifications();

    const refresh = () => { loadCancellationRequests(); loadNotifications(); };
    window.addEventListener("pageshow", refresh);
    const timer = setInterval(refresh, 10000);

    return () => {
      window.removeEventListener("pageshow", refresh);
      clearInterval(timer);
    };
  }, [u?.role]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  if (!u) {
    return (
      <main className="login">
        <div className="login-card">Loading…</div>
      </main>
    );
  }

  if (u.mustChangePassword) {
    location.href = "/change-password";
    return null;
  }


  return (
    <div className={`shell ${u.role === "ADMIN" ? "admin-shell" : ""}`}>


      <main className="main">
        {u.role === "ADMIN" ? (
          <>
            <div className="topbar">
              <div>
                <h1>Welcome, {u.name}</h1>
                <div className="muted">School administration</div>
              </div>
              <span className="badge">ADMIN</span>
            </div>
            <div className="grid">
              <div className="card"><div className="muted">Teachers</div><div className="metric">{teachers.length}</div></div>
              <div className="card"><div className="muted">Students</div><div className="metric">{students.length}</div></div>
              <div className="card"><div className="muted">Lessons</div><div className="metric">{lessons.length}</div></div>
            </div>
            <div className="section">
              <h2>Lessons</h2>
              <form className="card" onSubmit={(e) => { e.preventDefault(); searchAdminLessons(); }} style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(150px,1fr))",gap:12,alignItems:"end",marginBottom:16}}>
                <label>Start Date (required)<input className="input" type="date" required value={searchStartDate} onChange={(e)=>setSearchStartDate(e.target.value)} /></label>
                <label>End Date (required)<input className="input" type="date" required value={searchEndDate} onChange={(e)=>setSearchEndDate(e.target.value)} /></label>
                <label>Teacher (optional)<select className="input" value={searchTeacherId} onChange={(e)=>setSearchTeacherId(e.target.value)}><option value="">All teachers</option>{teachers.map((t)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                <label>Student (optional)<select className="input" value={searchStudentId} onChange={(e)=>setSearchStudentId(e.target.value)}><option value="">All students</option>{students.map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <button className="primary" type="submit" disabled={adminSearchLoading} style={{gridColumn:"1 / -1",justifySelf:"start"}}>{adminSearchLoading ? "Searching…" : "Submit"}</button>
              </form>
              <table className="table">
                <thead><tr><th>Date</th><th>Time</th><th>Teacher</th><th>Student</th><th>Status</th></tr></thead>
                <tbody>{lessons.map((l)=><tr key={l.id}>
                  <td>{new Date(l.starts_at).toLocaleDateString()}</td>
                  <td>{new Date(l.starts_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</td>
                  <td>{l.teacher_name}</td>
                  <td>{l.student_name}</td>
                  <td><span className="badge">{l.status==="CANCELLED"?"CANCELLED":l.status==="MISSED_BY_TEACHER_AND_STUDENT"?"MISSED BY TEACHER AND STUDENT":l.status==="MISSED_BY_TEACHER"?"MISSED BY TEACHER":l.status==="NO_SHOW"?"MISSED BY STUDENT":l.status}</span></td>
                </tr>)}</tbody>
              </table>
              {lessons.length===0 && <div className="session-empty">No lessons found for the selected dates.</div>}
            </div>
          </>
        ) : (
          <div className="session-page">
            <div className="session-links">
              <Link href="/dashboard/profile">▣ Personal Information</Link>
              <Link href="/change-password">⌕ Change Password</Link>
            </div>
            <div className="session-heading">
              <div className="session-title">
                {branding?.logo_data ? <img src={branding.logo_data} alt="" /> : <span className="session-icon">◆</span>}
                <strong>My Session</strong>
              </div>
            </div>
            <div className="session-server-time">
              Server Time: {serverTime.toLocaleString("sv-SE", {hour12:false}).replace("T"," ")}
            </div>
            <div className="session-note">
              Note: The number beside the classroom means the system to be used. Your scheduled lessons appear below.
            </div>
            {u.role === "TEACHER" && <div className="session-legend" style={{display:"flex",flexWrap:"wrap",gap:"8px 16px"}}>
              <span><i className="session-dot pending-approval" style={{background:"#fef3c7",border:"1px solid #f59e0b"}}></i>Pending Approval for available slots</span>
              <span><i className="session-dot approved-available" style={{background:"#93c5fd",border:"1px solid #2563eb"}}></i>Approved available slots</span>
              <span><i className="session-dot regular" style={{background:"#ede9fe",border:"1px solid #8b5cf6"}}></i>Regular Junior class 1v1</span>
              <span><i className="session-dot ferris" style={{background:"#facc15",border:"1px solid #ca8a04"}}></i>Ferris wheel class</span>
              <span><i className="session-dot demo" style={{background:"#ff4fd8",border:"1px solid #db2777"}}></i>Demo class</span>
              <span><i className="session-dot pending-cancel" style={{background:"#fb923c",border:"1px solid #ea580c"}}></i>Pending cancellation slots</span>
              <span><i className="session-dot canceled" style={{background:"#ef4444",border:"1px solid #b91c1c"}}></i>Canceled slots</span>
            </div>}
            <div className="session-list">
              {lessons.filter(l=>{const nowKey=serverTime.toLocaleDateString("en-CA",{timeZone:"Africa/Johannesburg"});return l.status!=="CANCELLED"&&new Date(l.starts_at).toLocaleDateString("en-CA",{timeZone:"Africa/Johannesburg"})===nowKey;}).map((l)=>{
                const d=new Date(l.starts_at);
                const sessionStyle = l.status==="NO_SHOW" || l.status==="MISSED_BY_TEACHER_AND_STUDENT" && u.role==="STUDENT" ? {background:"#ff1f1f",color:"#111827",borderColor:"#dc2626"} : l.status==="MISSED_BY_TEACHER" || l.status==="MISSED_BY_TEACHER_AND_STUDENT" && u.role==="TEACHER" ? {background:"#d1d5db",color:"#111827",borderColor:"#6b7280"} : undefined; return <button type="button" className={`session-row ${u.role === "STUDENT" ? "session-student" : "session-teacher"}`} style={sessionStyle} key={l.id} onClick={() => { setSelectedLesson(l); setTeacherNotePrompt(false); setTeacherNoteRead(false); }}>
                  <span>{d.toLocaleDateString("sv-SE")} {d.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>
                  <span style={{marginLeft:"auto",fontWeight:700}}>
                    {["MISSED_BY_TEACHER_AND_STUDENT","MISSED_BY_TEACHER","NO_SHOW"].includes(l.status) ? (u.role==="TEACHER" ? "MISSED - UNPAID" : "MISSED") : ""}
                  </span>
                </button>;
              })}
              {lessons.filter(l=>{const nowKey=serverTime.toLocaleDateString("en-CA",{timeZone:"Africa/Johannesburg"});return l.status!=="CANCELLED"&&new Date(l.starts_at).toLocaleDateString("en-CA",{timeZone:"Africa/Johannesburg"})===nowKey;}).length===0 && <div className="session-empty">No scheduled sessions today.</div>}
            </div>
            {selectedLesson && (
              <div className="session-detail-overlay" onClick={() => setSelectedLesson(null)}>
                <div className="session-detail-panel" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="session-detail-close" onClick={() => setSelectedLesson(null)}>×</button>
                  {(() => {
                    const start = new Date(selectedLesson.starts_at);
                    const end = new Date(selectedLesson.ends_at);
                    const enterAt = start.getTime() - 10 * 60 * 1000;
                    const canEnter = serverTime.getTime() >= enterAt && serverTime.getTime() < end.getTime();
                    return <>
                      <h2>{u.role === "TEACHER" ? "Class Details" : "Lesson Details"}</h2>
                      <div className="session-detail-grid">
                        <div><span>ID</span><strong>{selectedLesson.class_id || "—"}</strong></div>
                        <div><span>Level</span><strong>{selectedLesson.student_level || "—"}</strong></div>
                        {u.role === "TEACHER" && <div><span>Teaching Material</span><strong>{selectedLesson.material_title || "—"}</strong></div>}
                        <div><span>Start Time</span><strong>{start.toLocaleString("sv-SE").replace("T"," ")}</strong></div>
                        <div><span>End Time</span><strong>{end.toLocaleString("sv-SE").replace("T"," ")}</strong></div>
                        <div><span>{u.role === "TEACHER" ? "Student" : "Teacher"}</span><strong>{u.role === "TEACHER" ? selectedLesson.student_name : selectedLesson.teacher_name}</strong></div>
                        {u.role === "TEACHER" && <div><span>Age</span><strong>{selectedLesson.student_age ?? "—"}</strong></div>}
                        {u.role === "TEACHER" && selectedLesson.material_id && <div style={{gridColumn:"1 / -1"}}><button type="button" className="primary" onClick={async()=>{const x=await fetch("/api/lesson-materials?lessonId="+encodeURIComponent(selectedLesson.id),{cache:"no-store"});const a=x.ok?await x.json():[];const m=a[0];if(m)setTeacherWorkbook({lessonId:selectedLesson.id,materialId:m.id,title:m.title});}}>📖 View Workbook for Class Preparation</button></div>}
                        {u.role === "TEACHER" && <div style={{gridColumn:"1 / -1"}}><span>Student Note</span><strong style={{display:"block",marginTop:6,whiteSpace:"pre-wrap",lineHeight:1.5}}>{selectedLesson.student_note?.trim() || "No student note has been added."}</strong></div>}
                      </div>
                      <div className="session-enter-area">
                        {canEnter ? (u.role==="TEACHER" ? <button type="button" className="session-enter-button" onClick={()=>{setTeacherNoteRead(false);setTeacherNotePrompt(true)}}>Enter classroom</button> : <a className="session-enter-button" href={"/classroom/"+selectedLesson.room_code}>Enter classroom</a>) : <div className="session-enter-wait">Enter classroom will appear exactly 10 minutes before the class starts.</div>}<>{teacherNotePrompt && u.role==="TEACHER" && canEnter && <div onClick={()=>setTeacherNotePrompt(false)} style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(15,23,42,.65)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div onClick={e=>e.stopPropagation()} style={{width:"min(760px,100%)",background:"#fff",borderRadius:14,boxShadow:"0 20px 60px rgba(0,0,0,.35)",padding:24}}><h2 style={{marginTop:0}}>Student Note — Please Read Before Class</h2><div style={{border:"1px solid #d1d5db",borderRadius:10,padding:16,background:"#fafafa",whiteSpace:"pre-wrap",lineHeight:1.6,minHeight:90}}>{selectedLesson.student_note?.trim() || "No student note has been added for this student. Please still confirm that you have checked the student information before entering the classroom."}</div><label style={{display:"flex",gap:10,alignItems:"flex-start",marginTop:18,fontWeight:600}}><input type="checkbox" checked={teacherNoteRead} onChange={e=>setTeacherNoteRead(e.target.checked)} style={{marginTop:4}}/>I have read the student note and student information and will follow the instructions during this lesson.</label><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:20}}><button type="button" className="secondary" onClick={()=>setTeacherNotePrompt(false)}>Cancel</button><button type="button" className="primary" disabled={!teacherNoteRead} onClick={()=>{window.location.href="/classroom/"+selectedLesson.room_code}}>I Have Read the Note — Enter Classroom</button></div></div></div>}</>{u.role==="TEACHER"&&serverTime.getTime()>=end.getTime()&&<a className="primary" style={{display:"inline-block",marginTop:10,textDecoration:"none"}} href={"/dashboard/records?lessonId="+encodeURIComponent(selectedLesson.id)}>Complete Report</a>}{u.role==="STUDENT"&&serverTime.getTime()>=end.getTime()&&(
  selectedLesson.status==="MISSED_BY_TEACHER" || selectedLesson.status==="MISSED_BY_TEACHER_AND_STUDENT"
    ? <div className="session-rating"><div><strong>No need to rate</strong></div></div>
    : selectedLesson.status!=="NO_SHOW"&&!selectedLesson.student_cancelled_late
      ? <div className="session-rating"><div>Rate your teacher</div><div>{Array.from({length:10},(_,i)=><button key={i} type="button" onClick={()=>rateTeacher(selectedLesson.id,i+1)}>★</button>)}</div></div>
      : null
)}
                      </div>
                    </>;
                  })()}
                </div>
              </div>
              <>{teacherWorkbook && <div className="gc-modal-backdrop" onContextMenu={(e)=>e.preventDefault()} onClick={()=>setTeacherWorkbook(null)}>
                <div className="gc-material-modal" onClick={(e)=>e.stopPropagation()}>
                  <div className="gc-modal-head"><h2>📖 {teacherWorkbook.title}</h2><button type="button" onClick={()=>setTeacherWorkbook(null)}>Close</button></div>
                  <div className="gc-material-frame"><PdfViewer src={"/api/lesson-materials/file?lessonId="+encodeURIComponent(teacherWorkbook.lessonId)+"&materialId="+encodeURIComponent(teacherWorkbook.materialId)} title={teacherWorkbook.title}/></div>
                  <p>Teacher preparation view only. This workbook is not available for download.</p>
                </div>
              </div>}</>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
