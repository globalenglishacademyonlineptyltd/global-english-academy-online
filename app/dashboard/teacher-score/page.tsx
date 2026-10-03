"use client";

import { useEffect, useState } from "react";

export default function TeacherScore() {
  const [rows, setRows] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [teacher, setTeacher] = useState("");

  async function load(q = "") {
    const x = await fetch("/api/teacher-ratings" + q, { cache: "no-store" });
    if (x.ok) {
      const j = await x.json();
      setRows(j.rows || []);
      setTeachers(j.teachers || []);
    }
  }

  useEffect(() => { load(); }, []);

  function filter() {
    const p = new URLSearchParams();
    if (start) p.set("start", start);
    if (end) p.set("end", end);
    if (teacher) p.set("teacher", teacher);
    load("?" + p.toString());
  }

  return (
    <main className="main">
      <div className="topbar">
        <div>
          <h1>Teacher Score</h1>
          <div className="muted">See exactly which student rated which teacher, including the class recording.</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="muted">Ratings</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{rows.length}</div>
        </div>
      </div>

      <div className="card section">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 12, alignItems: "end" }}>
          <label>Start Date<input className="input" type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
          <label>End Date<input className="input" type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
          <label>Teacher<select className="input" value={teacher} onChange={e => setTeacher(e.target.value)}>
            <option value="">All teachers</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select></label>
          <button className="primary" onClick={filter} disabled={!!(start && end && end < start)}>Filter</button>
        </div>
      </div>

      <div className="section" style={{ overflowX: "auto" }}>
        {rows.length === 0 ? (
          <div className="card">No teacher ratings have been submitted yet.</div>
        ) : (
          <table className="table" style={{ minWidth: 1150 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Class ID</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Student</th>
                <th>Teacher</th>
                <th>Score</th>
                <th>Opinion</th>
                <th>Recording</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td><strong>{r.class_id || "—"}</strong></td>
                  <td>{new Date(r.starts_at).toLocaleString()}</td>
                  <td>{new Date(r.ends_at).toLocaleString()}</td>
                  <td>{r.student_name}</td>
                  <td>{r.teacher_name}</td>
                  <td style={{ fontWeight: 800 }}>{r.rating}/10</td>
                  <td>{r.opinion || ""}</td>
                  <td>
                    {r.recording_url ? (
                      <a href={r.recording_url} target="_blank" rel="noreferrer">View recording</a>
                    ) : (
                      <span className="muted">No recording</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
