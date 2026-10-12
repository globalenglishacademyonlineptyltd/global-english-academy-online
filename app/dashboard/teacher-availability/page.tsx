"use client";

import { useEffect, useMemo, useState } from "react";

type Teacher = { id: string; name: string; availability_count?: number };
type Slot = { id: string; slot_date: string; start_time: string; end_time: string; admin_opened: boolean };

export default function AdminAvailability() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [mode, setMode] = useState<"weekly" | "selected">("weekly");
  const [weeks, setWeeks] = useState<1 | 2>(1);
  const [teacherMode, setTeacherMode] = useState<"ALL" | "SELECTED">("ALL");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadTeachers() {
    const r = await fetch("/api/availability", { cache: "no-store" });
    if (r.ok) setTeachers(await r.json());
  }

  async function loadSlots(id: string) {
    if (!id) {
      setSlots([]);
      setSelectedSlots([]);
      return;
    }
    const r = await fetch("/api/availability?teacherId=" + encodeURIComponent(id), { cache: "no-store" });
    if (r.ok) {
      const data: Slot[] = await r.json();
      setSlots(data);
      setSelectedSlots([]);
    } else {
      setSlots([]);
      setSelectedSlots([]);
    }
  }

  useEffect(() => { void loadTeachers(); }, []);
  useEffect(() => { void loadSlots(teacherId); }, [teacherId]);

  const unopenedSlots = useMemo(
    () => slots.filter((s) => !s.admin_opened).sort((a, b) =>
      (a.slot_date + a.start_time).localeCompare(b.slot_date + b.start_time)),
    [slots]
  );

  async function openWeekly() {
    if (teacherMode === "SELECTED" && !teacherId) {
      setMessage("Please select a teacher, or choose All teachers.");
      return;
    }
    setBusy(true);
    setMessage("Opening slots…");
    try {
      const r = await fetch("/api/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "openWeekly", weeks, teacherMode, teacherId: teacherMode === "SELECTED" ? teacherId : "" })
      });
      const j = await r.json();
      setMessage(r.ok
        ? `Successfully opened ${j.opened || 0} slots for ${weeks} week${weeks === 1 ? "" : "s"}.`
        : j.error || "Could not open slots.");
      await loadTeachers();
      if (teacherId) await loadSlots(teacherId);
    } catch {
      setMessage("Could not open slots. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function openSelected() {
    if (!teacherId) { setMessage("Choose a teacher before selecting individual slots."); return; }
    if (!selectedSlots.length) { setMessage("Select one or more future slots to open."); return; }
    const selected = unopenedSlots.filter((s) => selectedSlots.includes(s.id));
    if (!confirm(`Open ${selected.length} selected slot(s) for ${teachers.find((t) => t.id === teacherId)?.name || "this teacher"}?`)) return;
    setBusy(true);
    setMessage("Opening selected slots…");
    let opened = 0;
    const errors: string[] = [];
    try {
      for (const slot of selected) {
        const r = await fetch("/api/availability", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "openSingle", teacherId, slotDate: String(slot.slot_date).slice(0, 10), startTime: String(slot.start_time).slice(0, 5) })
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) opened += Number(j.opened || 1);
        else errors.push(`${String(slot.slot_date).slice(0, 10)} ${String(slot.start_time).slice(0, 5)}: ${j.error || "could not open"}`);
      }
      setMessage(errors.length
        ? `Opened ${opened} selected slot(s). ${errors.length} could not be opened: ${errors.slice(0, 2).join("; ")}${errors.length > 2 ? "…" : ""}`
        : `Successfully opened all ${opened} selected slot(s).`);
      await loadTeachers();
      await loadSlots(teacherId);
    } catch {
      setMessage(`Opened ${opened} slot(s), but the request was interrupted. Refresh to check the remaining slots.`);
      await loadSlots(teacherId);
    } finally {
      setBusy(false);
    }
  }

  async function closeFuture() {
    if (!teacherId) return;
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!confirm("Close all future unbooked slots for " + (teacher?.name || "this teacher") + "? Booked lessons will not be changed.")) return;
    setBusy(true);
    setMessage("Closing future slots…");
    try {
      const r = await fetch("/api/availability", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "closeFuture", teacherId })
      });
      const j = await r.json();
      setMessage(r.ok ? `${j.closed || 0} future unbooked slots closed.` : j.error || "Could not close slots.");
      await loadTeachers();
      await loadSlots(teacherId);
    } catch {
      setMessage("Could not close slots. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function toggleSlot(id: string, checked: boolean) {
    setSelectedSlots((current) => checked ? [...new Set([...current, id])] : current.filter((x) => x !== id));
  }

  return (
    <main className="main">
      <h1>Close Future Slots</h1>
      <p className="muted">Admin can open booking slots for one week, two weeks, or selected individual slots. You can also close a teacher’s future unbooked slots. Booked lessons are protected.</p>

      <section className="card" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>Open Slots</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, alignItems: "end" }}>
          <label>Opening method
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value as "weekly" | "selected")}>
              <option value="weekly">Open 1 or 2 weeks ahead</option>
              <option value="selected">Open only selected slots</option>
            </select>
          </label>
          {mode === "weekly" ? <>
            <label>Period to open
              <select className="input" value={weeks} onChange={(e) => setWeeks(Number(e.target.value) as 1 | 2)}>
                <option value={1}>1 week ahead</option>
                <option value={2}>2 weeks ahead</option>
              </select>
            </label>
            <label>Teachers
              <select className="input" value={teacherMode} onChange={(e) => setTeacherMode(e.target.value as "ALL" | "SELECTED")}>
                <option value="ALL">All teachers</option>
                <option value="SELECTED">Selected teacher</option>
              </select>
            </label>
            {teacherMode === "SELECTED" && <label>Teacher
              <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">Choose teacher</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>}
            <button className="primary" disabled={busy || (teacherMode === "SELECTED" && !teacherId)} onClick={openWeekly}>
              {busy ? "Please wait…" : `Open ${weeks} week${weeks === 1 ? "" : "s"}${teacherMode === "ALL" ? " for all teachers" : ""}`}
            </button>
          </> : <>
            <label>Teacher
              <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                <option value="">Choose teacher</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <button className="primary" disabled={busy || !teacherId || !selectedSlots.length} onClick={openSelected}>
              {busy ? "Opening…" : `Open ${selectedSlots.length} selected slot(s)`}
            </button>
          </>}
        </div>

        {mode === "selected" && <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Select future slots to open</h3>
            {unopenedSlots.length > 0 && <button type="button" onClick={() => setSelectedSlots(selectedSlots.length === unopenedSlots.length ? [] : unopenedSlots.map((s) => s.id))}>
              {selectedSlots.length === unopenedSlots.length ? "Clear selection" : "Select all unopened slots"}
            </button>}
          </div>
          {!teacherId ? <p className="muted">Choose a teacher to view their future slots.</p> :
            unopenedSlots.length === 0 ? <p className="muted">No unopened future slots are available for this teacher.</p> :
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table className="table">
                <thead><tr><th>Select</th><th>Date</th><th>Chinese Time</th></tr></thead>
                <tbody>{unopenedSlots.map((slot) => <tr key={slot.id}>
                  <td><input type="checkbox" checked={selectedSlots.includes(slot.id)} onChange={(e) => toggleSlot(slot.id, e.target.checked)} aria-label={`Select ${slot.slot_date} ${slot.start_time}`} /></td>
                  <td>{String(slot.slot_date).slice(0, 10)}</td>
                  <td>{String(slot.start_time).slice(0, 5)}–{String(slot.end_time).slice(0, 5)}</td>
                </tr>)}</tbody>
              </table>
            </div>}
        </div>}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Close Future Slots</h2>
        <p className="muted">Close all future unbooked slots for one teacher. Booked lessons will not be changed.</p>
        <label>Teacher
          <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">Choose teacher</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} • {t.availability_count || 0} future slots</option>)}
          </select>
        </label>
        <button className="primary" disabled={busy || !teacherId} onClick={closeFuture}>Close Future Unbooked Slots</button>
      </section>
      {message && <p className="muted" role="status" style={{ marginTop: 14 }}>{message}</p>}
    </main>
  );
}
