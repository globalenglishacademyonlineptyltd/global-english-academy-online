"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [branding, setBranding] = useState<any>(null);

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
        else setU(j.user);
      });

    fetch("/api/lessons", { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : []))
      .then(setLessons);
    fetch("/api/materials", { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : []))
      .then(setMaterials);
    fetch("/api/students", { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : []))
      .then(setStudents);
    fetch("/api/teachers", { cache: "no-store" })
      .then((x) => (x.ok ? x.json() : []))
      .then(setTeachers);
  }, []);

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

  const nav =
    u.role === "ADMIN"
      ? [
          ["Dashboard", "/dashboard"],
          ["Teachers", "/dashboard/teachers"],
          ["Students", "/dashboard/students"],
          ["Lessons", "/dashboard/lessons"],
          ["Cancellation Requests", "/dashboard/cancellations"],
          ["Teacher Leave Requests", "/dashboard/teacher-leave"],
          ["Teacher Availability", "/dashboard/teacher-availability"],
          ["Teacher Score", "/dashboard/teacher-score"],
          ["Materials", "/dashboard/materials"],
          ["Recordings", "/dashboard/recordings"],
          ["School Branding", "/dashboard/branding"],
          ["Comm Centre", "/dashboard/comm-center"],
        ]
      : u.role === "TEACHER"
        ? [
            ["My Session", "/dashboard"],
            ["Teaching Record", "/dashboard/records"],
            ["Score", "/dashboard/score"],
            ["Booking Time", "/dashboard/availability"],
            ["Score", "/dashboard/score"],
            ["Training", "/dashboard/training"],
            ["Comm Centre", "/dashboard/comm-center"],
            ["Personal Information", "/dashboard/profile"],
            ["Change Password", "/change-password"],
          ]
        : [
            ["My Lessons", "/dashboard"],
            ["Book a Lesson", "/dashboard/book"],
            ["Lesson History", "/dashboard/records"],
            ["Rate Teachers", "/dashboard/rate-teachers"],
            ["Comm Centre", "/dashboard/comm-center"],
          ];

  return (
    <div className={`shell ${u.role === "ADMIN" ? "admin-shell" : ""}`}>
      {u.role === "ADMIN" ? (
        <div className="admin-menu-wrap">
          <button className="admin-menu-button" onClick={() => setAdminMenuOpen((v) => !v)} aria-expanded={adminMenuOpen}>
            <span className="admin-menu-icon">☰</span>
            <span>Menu</span>
            <span className="admin-menu-chevron">{adminMenuOpen ? "▲" : "▼"}</span>
          </button>
          {adminMenuOpen && (
            <div className="admin-dropdown">
              <div className="admin-dropdown-title">Global English Academy</div>
              {nav.map(([a, b]) => (
                <Link key={b} href={b} onClick={() => setAdminMenuOpen(false)}>
                  {a}
                </Link>
              ))}
              <button onClick={logout}>Sign out</button>
            </div>
          )}
        </div>
      ) : (
        <aside className="sidebar">
          <div className="brand">Global English Academy</div>
          <nav className="nav">
            {nav.map(([a, b]) => (
              <Link key={b} href={b}>
                {a}
              </Link>
            ))}
            <button onClick={logout}>Sign out</button>
          </nav>
        </aside>
      )}

      <main className="main">
        <div className="topbar">
          <div>
            <h1>Welcome, {u.name}</h1>
            <div className="muted">
              {u.role === "ADMIN"
                ? "School administration"
                : u.role === "TEACHER"
                  ? "Teacher portal"
                  : "Student portal"}
            </div>
          </div>
          <span className="badge">{u.role}</span>
        </div>

        <div className="grid">
          {u.role === "ADMIN" ? (
            <>
              <div className="card">
                <div className="muted">Teachers</div>
                <div className="metric">{teachers.length}</div>
              </div>
              <div className="card">
                <div className="muted">Students</div>
                <div className="metric">{students.length}</div>
              </div>
              <div className="card">
                <div className="muted">Lessons</div>
                <div className="metric">{lessons.length}</div>
              </div>
            </>
          ) : (
            <>
              <div className="card">
                <div className="muted">My lessons</div>
                <div className="metric">{lessons.length}</div>
              </div>
              <div className="card">
                <div className="muted">Materials</div>
                <div className="metric">{materials.length}</div>
              </div>
            </>
          )}
        </div>

        <div className="section">
          <h2>{u.role === "TEACHER" ? "My Sessions" : "Lessons"}</h2>
          <table className="table">
            <thead>
              <tr>
                {u.role === "TEACHER" && <th>Class ID</th>}
                <th>Date</th>
                <th>Time</th>
                <th>Teacher</th>
                <th>Student</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => {
                const req = cancellations.find((c) => c.lesson_id === l.id);
                const pending = req?.status === "PENDING";

                return (
                  <tr key={l.id}>
                    {u.role === "TEACHER" && <td>{l.class_id || "—"}</td>}
                    <td>{new Date(l.starts_at).toLocaleDateString()}</td>
                    <td>
                      {new Date(l.starts_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td>{l.teacher_name}</td>
                    <td>{l.student_name}</td>
                    <td>
                      <span className="badge">{l.status === "CANCELLED" ? "CANCELLED" : l.status}</span>
                    </td>
                    <td>
                      {l.status === "CANCELLED" && u.role === "STUDENT" ? (
                        <Link className="primary" href="/dashboard/book">Rebook lesson</Link>
                      ) : l.status === "SCHEDULED" ? (
                        <>
                          <Link href={"/classroom/" + l.room_code}>Join</Link>

                          {(u.role === "TEACHER" || u.role === "STUDENT") && (pending ? (<button disabled style={{marginLeft:"10px",background:"#dc2626",color:"white",border:"1px solid #b91c1c",cursor:"not-allowed"}}>Cancellation Pending</button>) : (<button disabled={submitting===l.id} style={{marginLeft:"10px",background:submitting===l.id?"#dc2626":undefined,color:submitting===l.id?"white":undefined}} onClick={async()=>{setSubmitting(l.id);const reason=window.prompt("Why do you need to cancel this lesson?");if(reason===null){setSubmitting(null);return;}try{const x=await fetch("/api/cancellation-requests",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lessonId:l.id,reason})});const j=await x.json();if(!x.ok)window.alert(j.error);else{setCancellations(prev=>[...prev.filter(c=>c.lesson_id!==l.id),j]);window.alert("Cancellation request sent to Admin for approval.");}}catch{window.alert("Could not submit the cancellation request. Please try again.");}finally{setSubmitting(null);}}}>{submitting===l.id?"Submitting…":"Request cancellation"}</button>))}
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
