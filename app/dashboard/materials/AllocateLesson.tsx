"use client";

import { useEffect, useState } from "react";

export default function AllocateLesson({ material, onDone }: { material: any; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function show() {
    setOpen(true); setMessage("");
    const r = await fetch("/api/students", { cache: "no-store" });
    if (r.ok) setStudents(await r.json());
    else setMessage("Could not load students.");
  }

  async function allocate() {
    if (!studentId) { setMessage("Please choose a student."); return; }
    setSaving(true); setMessage("");
    const r = await fetch("/api/students", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: studentId, startingMaterialId: material.id }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setMessage(j.error || "Could not allocate lesson."); return; }
    setMessage("Lesson allocated to the student.");
    setStudentId("");
    onDone?.();
  }

  return <>
    <button type="button" className="secondary compact-btn" onClick={show}>Allocate</button>
    {open && <div className="gc-modal-backdrop" onClick={() => setOpen(false)}>
      <div className="gc-material-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="gc-modal-head"><h2>Allocate Lesson</h2><button type="button" onClick={() => setOpen(false)}>Close</button></div>
        <p><strong>{material.title}</strong></p>
        <p className="muted small">{material.folder}{material.unit_no ? ` • Unit ${material.unit_no}` : ""}</p>
        <select className="input" value={studentId} onChange={e => setStudentId(e.target.value)}>
          <option value="">Choose an existing student</option>
          {students.map(s => <option key={s.id} value={s.id}>{s.name} — {s.level || "No level"}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button type="button" className="primary compact-btn" disabled={saving} onClick={allocate}>{saving ? "Allocating…" : "Allocate Lesson"}</button><button type="button" className="secondary compact-btn" onClick={() => setOpen(false)}>Cancel</button></div>
        {message && <p className="muted small" role="status">{message}</p>}
      </div>
    </div>}
  </>;
}