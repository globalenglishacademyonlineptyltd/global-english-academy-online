import Link from "next/link";

const lessons = [
  { time: "14:00", student: "Sample Student", teacher: "Teacher 1", status: "Upcoming" },
  { time: "15:00", student: "Sample Student", teacher: "Teacher 2", status: "Upcoming" },
  { time: "16:00", student: "Sample Student", teacher: "Teacher 3", status: "Completed" }
];

export default function Dashboard() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Global English Academy</div>
        <nav className="nav">
          <Link className="active" href="/dashboard">Dashboard</Link>
          <Link href="/dashboard/teachers">Teachers</Link>
          <Link href="/dashboard/students">Students</Link>
          <Link href="/dashboard/lessons">Lessons</Link>
          <Link href="/dashboard/materials">Materials</Link>
          <Link href="/dashboard/recordings">Recordings</Link>
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <div><h1>School Dashboard</h1><div className="muted">Global English Academy Online</div></div>
          <span className="badge">Admin</span>
        </div>
        <div className="grid">
          <div className="card"><div className="muted">Teachers</div><div className="metric">5</div></div>
          <div className="card"><div className="muted">Students</div><div className="metric">0</div></div>
          <div className="card"><div className="muted">Today's Lessons</div><div className="metric">3</div></div>
          <div className="card"><div className="muted">Recordings</div><div className="metric">0</div></div>
        </div>
        <div className="section">
          <h2>Upcoming & recent lessons</h2>
          <table className="table"><thead><tr><th>Time</th><th>Student</th><th>Teacher</th><th>Status</th></tr></thead>
          <tbody>{lessons.map((l) => <tr key={l.time}><td>{l.time}</td><td>{l.student}</td><td>{l.teacher}</td><td><span className="badge">{l.status}</span></td></tr>)}</tbody>
          </table>
        </div>
      </main>
    </div>
  );
}