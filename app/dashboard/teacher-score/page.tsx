"use client";

import {useEffect,useState} from "react";

export default function TeacherScoresAdmin(){
  const [rows,setRows]=useState<any[]>([]);
  const [teachers,setTeachers]=useState<any[]>([]);
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [teacher,setTeacher]=useState("");
  const [recording,setRecording]=useState<any|null>(null);

  async function load(q=""){
    const x=await fetch("/api/teacher-ratings"+q,{cache:"no-store"});
    if(x.ok){
      const j=await x.json();
      setRows(j.rows||[]);
      setTeachers(j.teachers||[]);
    }
  }
  useEffect(()=>{load()},[]);

  function filter(){
    const p=new URLSearchParams();
    if(start)p.set("start",start);
    if(end)p.set("end",end);
    if(teacher)p.set("teacher",teacher);
    load("?"+p.toString());
  }

  return <main className="main">
    <div className="topbar">
      <div><h1>Teacher Score</h1><div className="muted">See exactly which student rated which teacher, the score given, and the class recording.</div></div>
      <div style={{textAlign:"right"}}><div className="muted">Ratings</div><div style={{fontSize:28,fontWeight:800}}>{rows.length}</div></div>
    </div>
    <div className="card section">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:12,alignItems:"end"}}>
        <label>Start Date<input className="input" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label>End Date<input className="input" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
        <label>Teacher<select className="input" value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">All teachers</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></label>
        <button className="primary" onClick={filter} disabled={!!(start&&end&&end<start)}>Filter</button>
      </div>
    </div>
    <div className="section" style={{overflowX:"auto"}}>
      <table className="table" style={{minWidth:1050}}>
        <thead><tr><th>#</th><th>Class ID</th><th>Start Time</th><th>End Time</th><th>Student</th><th>Teacher</th><th>Score</th><th>Opinion</th><th>Recording</th></tr></thead>
        <tbody>
          {rows.map((r,i)=><tr key={r.id}>
            <td>{i+1}</td><td><strong>{r.class_id||"—"}</strong></td>
            <td>{new Date(r.starts_at).toLocaleString()}</td><td>{new Date(r.ends_at).toLocaleString()}</td>
            <td>{r.student_name}</td><td>{r.teacher_name}</td><td style={{fontWeight:800}}>{r.rating}/10</td><td>{r.opinion||""}</td>
            <td>{r.recording_url?<button className="primary" onClick={()=>setRecording(r)}>View recording</button>:<span className="muted">No recording</span>}</td>
          </tr>)}
          {!rows.length&&<tr><td colSpan={9} className="muted">No teacher ratings found.</td></tr>}
        </tbody>
      </table>
    </div>
    {recording&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000}} onClick={()=>setRecording(null)}>
      <div className="card" style={{width:"min(1000px,95vw)",maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
        <div className="topbar" style={{marginBottom:16}}>
          <div><h2 style={{margin:0}}>Class Recording</h2><div className="muted">{recording.class_id||"Class"} · {recording.student_name} · {recording.teacher_name}</div></div>
          <button onClick={()=>setRecording(null)}>Close</button>
        </div>
        <video controls autoPlay style={{width:"100%",maxHeight:"70vh"}} src={recording.recording_url}/>
      </div>
    </div>}
  </main>;
}
