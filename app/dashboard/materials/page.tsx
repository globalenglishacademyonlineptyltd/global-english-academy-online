"use client";

import { useEffect, useState } from "react";
import PdfViewer from "@/app/components/PdfViewer";

const levels = Array.from({ length: 8 }, (_, i) => "Level " + (i + 1));
const folders = [...levels, "Demo", "Ferris Wheel"];

export default function Materials() {
  const [rows, setRows] = useState<any[]>([]);
  const [role, setRole] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [folder, setFolder] = useState("Level 1");
  const [sequenceNo, setSequenceNo] = useState("1");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [openMaterial, setOpenMaterial] = useState<any>(null);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  async function load() {
    const me = await fetch("/api/me").then(r => r.json());
    const currentRole = me.user?.role || "";
    setRole(currentRole);
    if (currentRole !== "ADMIN") {
      window.location.replace("/dashboard");
      return;
    }
    const x = await fetch("/api/materials", { cache: "no-store" });
    if (x.ok) setRows(await x.json());
  }

  useEffect(() => { load(); }, []);

  function startEdit(material: any) {
    setEditingMaterialId(material.id);
    setTitle(material.title || "");
    setDescription(material.description || "");
    setUrl(material.url || "");
    setFolder(material.folder || material.level || "Level 1");
    setSequenceNo(String(material.sequence_no || 1));
    setFile(null);
    setMessage("Editing material. Upload a new file only if you want to replace the existing workbook.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingMaterialId(null);
    setTitle("");
    setDescription("");
    setUrl("");
    setFolder("Level 1");
    setSequenceNo("1");
    setFile(null);
    setMessage("Edit cancelled.");
  }

  async function add() {
    setMessage("Saving…");
    if (!title.trim()) {
      setMessage("Lesson title is required.");
      return;
    }
    try {
      let contentData = "", mimeType = "";
      if (file) {
        mimeType = file.type || "application/octet-stream";
        setMessage("Uploading workbook to secure file storage…");
        const uploadForm = new FormData();
        uploadForm.append("file", file);
        const uploadResponse = await fetch("/api/materials/upload", {
          method: "POST",
          body: uploadForm
        });
        const uploaded = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) throw new Error(uploaded.error || "The workbook upload failed. Please try again.");
        contentData = uploaded.storageKey;
        setMessage("Workbook uploaded. Saving lesson details…");
      }
      const x = await fetch("/api/materials", {
        method: editingMaterialId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ materialId: editingMaterialId, title, description, url, folder, level: folder, sequenceNo, contentData, mimeType })
      });
      const j = await x.json();
      if (!x.ok) throw new Error(j.error || "Could not save material.");
      setEditingMaterialId(null);
      setTitle("");
      setDescription("");
      setUrl("");
      setFolder("Level 1");
      setSequenceNo(String(Number(sequenceNo) + 1));
      setFile(null);
      setMessage(editingMaterialId ? "Material updated." : "Material saved.");
      setExpandedFolders(previous => new Set(previous).add(folder));
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save material.");
    }
  }

  function toggleFolder(name: string) {
    setExpandedFolders(previous => {
      const next = new Set(previous);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function deleteMaterial(material: any) {
    const confirmed = window.confirm(
      'Permanently delete "' + material.title + '"? This cannot be undone. The uploaded file and its lesson-material assignments will also be deleted.'
    );
    if (!confirmed) return;

    setMessage("Deleting material…");
    const response = await fetch("/api/materials", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ materialId: material.id })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Could not delete material.");
      return;
    }
    setRows(previous => previous.filter(item => item.id !== material.id));
    if (openMaterial?.id === material.id) setOpenMaterial(null);
    setMessage('"' + material.title + '" was permanently deleted.');
  }

  const groups = rows.reduce((a, m) => {
    const k = m.folder || m.level || "Uncategorised";
    (a[k] ??= []).push(m);
    return a;
  }, {} as Record<string, any[]>);
  const ordered = [...levels, "Demo", "Ferris Wheel", "Uncategorised"].filter(k => groups[k]);

  if (role && role !== "ADMIN") return null;

  return (
    <main className="main">
      <div className="topbar">
        <div>
          <h1>Lesson Materials</h1>
          <p className="muted">Organise the curriculum into eight levels, with separate Demo and Ferris Wheel folders.</p>
        </div>
      </div>

      {role === "ADMIN" && <div className="card">
        <div className="card-head"><h3>{editingMaterialId ? "Edit Lesson Material" : "Add Lesson Material"}</h3><span className="badge">Admin only</span></div>
        <div className="form-grid">
          <input className="input" placeholder="Lesson title" value={title} onChange={e => setTitle(e.target.value)} />
          <select className="input" value={folder} onChange={e => setFolder(e.target.value)}>{folders.map(x => <option key={x}>{x}</option>)}</select>
          <input className="input" placeholder="Lesson number / sequence" type="number" min="1" value={sequenceNo} onChange={e => setSequenceNo(e.target.value)} />
          <input className="input" placeholder="Short description" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <label className="input file-input">{editingMaterialId ? "Replace workbook (optional)" : "Upload PDF / lesson file"} <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => setFile(e.target.files?.[0] || null)} /></label>
        {editingMaterialId && <p className="muted small">Leave the file field empty to keep the current uploaded workbook.</p>}
        <input className="input" placeholder="Optional external URL" value={url} onChange={e => setUrl(e.target.value)} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="primary compact-btn" onClick={add}>{editingMaterialId ? "Save Changes" : "Save material"}</button>{editingMaterialId && <button type="button" className="secondary compact-btn" onClick={cancelEdit}>Cancel Edit</button>}</div>
        {message && <div className="muted small" role="status" style={{ marginTop: 10 }}>{message}</div>}
      </div>}

      <div className="section">
        {ordered.map(name => {
          const isExpanded = expandedFolders.has(name);
          const folderRows = [...groups[name]].sort((a: any, b: any) => Number(a.sequence_no) - Number(b.sequence_no));
          return (
            <section className="material-folder" key={name}>
              <button
                type="button"
                className="folder-title"
                onClick={() => toggleFolder(name)}
                aria-expanded={isExpanded}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", border: 0, background: "transparent", padding: "14px 12px" }}
              >
                <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", fontSize: 13 }}>{isExpanded ? "▼" : "▶"}</span>
                <span aria-hidden="true">📁</span>
                <strong style={{ flex: 1 }}>{name}</strong>
                <span>{folderRows.length} lessons</span>
              </button>
              {isExpanded && <div className="material-list">
                {folderRows.map((r: any) => (
                  <div className="material-row" key={r.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="sequence">{String(r.sequence_no).padStart(2, "0")}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{r.title}</strong>
                      <div className="muted small">{r.description || "Lesson material"} • {r.content_data ? "Uploaded file" : r.url ? "External material" : "No file attached"}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button type="button" className="secondary compact-btn" onClick={() => startEdit(r)} title="Edit lesson details or replace the workbook">Edit</button>
                      <button type="button" className="secondary compact-btn" onClick={() => setOpenMaterial(r)} disabled={!r.content_data && !r.url} title={r.content_data || r.url ? "View this material" : "No file attached"}>View</button>
                      <button type="button" className="compact-btn" onClick={() => deleteMaterial(r)} aria-label={'Permanently delete ' + r.title} title="Permanently delete this material" style={{ background: "#B91C1C", color: "#fff", border: 0, borderRadius: 8, padding: "8px 12px" }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>}
            </section>
          );
        })}
        {ordered.length === 0 && <div className="card muted">No lesson materials have been uploaded yet.</div>}
      </div>

      {openMaterial && <div className="gc-modal-backdrop" onContextMenu={e => e.preventDefault()}>
        <div className="gc-material-modal">
          <div className="gc-modal-head"><h2>📄 {openMaterial.title}</h2><button onClick={() => setOpenMaterial(null)}>Close</button></div>
          <div className="gc-material-frame"><PdfViewer src={"/api/materials/file?materialId=" + encodeURIComponent(openMaterial.id)} title={openMaterial.title} /></div>
          <p>View-only material. The original uploaded workbook remains stored in your platform.</p>
        </div>
      </div>}
    </main>
  );
}
