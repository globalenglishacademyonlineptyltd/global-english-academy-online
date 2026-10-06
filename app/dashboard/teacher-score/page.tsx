"use client";
import {useEffect,useState} from "react";
export default function TeacherScoresAdmin(){
  const [teachers,setTeachers]=useState<any[]>([]);
  const [selected,setSelected]=useState<any|null>(null);
  const [query,setQuery]=useState("");
  const [rows,setRows]=useState<any[]>([]);
  const [stats,setStats]=useState<any[]>([]);
  const [totals,setTotals]=useState<any>({total_lessons:0,completed_lessons:0});
  const [start,setStart]=useState("");
  const [end,setEnd]=useState("");
  const [recording,setRecording]=useState<any|null>(null);
  const [loading,setLoading]=useState(false);

  async function loadTeachers(){
    const x=await fetch("/api/teacher-ratings",{cache:"no-store"});
    if(x.ok){const j=await x.json();setTeachers(j.teachers||[]);}
  }
  async function loadTeacher(id:string){
    setLoading(true);
    const p=new URLSearchParams({teacher:id});
    if(start)p.set("start",start);
    if(end)p.set("end",end);
    const x=await fetch("/api/teacher-ratings?"+p.toString(),{cache:"no-store"});
    if(x.ok){const j=await x.json();setRows(j.rows||[]);setStats(j.stats||[]);setTotals(j.totals||{total_lessons:0,completed_lessons:0});}
    setLoading(false);
  }
  useEffect(()=>{loadTeachers()},[]);
  useEffect(()=>{if(selected){const timer=setInterval(()=>loadTeacher(selected.id),15000);return()=>clearInterval(timer)}},[selected,start,end]);

  const visible=teachers.filter(t=>String(t.full_name||"").toLowerCase().includes(query.toLowerCase().trim()));
  const counts=Array.from({length:10},(_,i)=>stats.find(s=>Number(s.rating)===i+1)?.count||0);

  if(!selected){
    return <main className="main">
      <div className="topbar">
        <div><h1>Teacher Score</h1><div className="muted">Select a teacher to view their individual scores.</div></div>
      </div>
      <div className="card section">
        <label>Search teacher<input className="input" placeholder="Search by teacher name" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      </div>
      <div className="section">
        <div className="card">
          {visible.map(t=><button key={t.id} type="button" onClick={()=>{setSelected(t);loadTeacher(t.id)}} style={{display:"block",width:"100%",textAlign:"left",padding:"16px 18px",marginBottom:8,border:"1px solid #e5e7eb",borderRadius:12,background:"white",cursor:"pointer",fontWeight:700}}>
            {t.full_name}
          </button>)}
          {!visible.length&&<div className="muted">No teachers found.</div>}
        </div>
      </div>
    </main>;
  }

  return <main className="main">
    <div className="topbar">
      <div><button onClick={()=>{setSelected(null);setRows([]);setStats([])}} style={{marginBottom:8}}>← All Teachers</button><h1>{selected.full_name}</h1><div className="muted">Teacher Score</div></div>
      <div style={{textAlign:"right"}}><div className="muted">All lessons</div><div style={{fontSize:28,fontWeight:800}}>{totals.total_lessons||0}</div><div className="muted">Completed lessons: <strong>{totals.completed_lessons||0}</strong></div></div>
    </div>
    <div className="card section">
      <h3>Total Statistical</h3>
      <table className="table"><thead><tr>{counts.map((_,i)=><th key={i} style={{textAlign:"center"}}>{i+1}</th>)}</tr></thead><tbody><tr>{counts.map((n,i)=><td key={i} style={{textAlign:"center",fontWeight:800}}>{n}</td>)}</tr></tbody></table>
      <h3 style={{marginTop:24}}>Trend</h3>
      <div className="muted">Statistics above are automatically calculated from student ratings.</div>
    </div>
    <div className="card section">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:12,alignItems:"end"}}>
        <label>Start Date<input className="input" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
        <label>End Date<input className="input" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
        <button className="primary" onClick={()=>loadTeacher(selected.id)} disabled={!!(start&&end&&end<start)||loading}>{loading?"Loading…":"Filter"}</button>
      </div>
    </div>
    <div className="section" style={{overflowX:"auto"}}>
      <table className="table" style={{minWidth:1000}}>
        <thead><tr><th>#</th><th>Class ID</th><th>Start Time</th><th>End Time</th><th>Student</th><th>Score</th><th>Status</th><th>Opinion</th><th>Recording</th></tr></thead>
        <tbody>{rows.map((r,i)=><tr key={r.lesson_id||r.id}>
          <td>{i+1}</td><td><strong>{r.class_id||"—"}</strong></td><td>{new Date(r.starts_at).toLocaleString()}</td><td>{new Date(r.ends_at).toLocaleString()}</td><td>{r.student_name}</td>
          <td style={{fontWeight:800}}>{r.rating?String(r.rating)+"/10":"—"}</td>
          <td>{r.status==="COMPLETED"?"COMPLETED":r.status==="CANCELLED"?"CANCELLED":r.status==="MISSED_BY_TEACHER"?"MISSED BY TEACHER":r.status==="NO_SHOW"?"MISSED BY STUDENT":r.status==="MISSED_BY_TEACHER_AND_STUDENT"?"MISSED BY TEACHER AND STUDENT":r.status||"—"}</td>
          <td>{r.opinion||""}</td><td>{r.recording_url?<button className="primary" onClick={()=>setRecording(r)}>View recording</button>:<span className="muted">No recording</span>}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length&&<div className="session-empty">No lessons found for this teacher.</div>}
    </div>
    {recording&&<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:1000}} onClick={()=>setRecording(null)}>
      <div className="card" style={{width:"min(1000px,95vw)",maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
        <div className="topbar" style={{marginBottom:16}}><div><h2 style={{margin:0}}>Class Recording</h2><div className="muted">{recording.class_id||"Class"} · {recording.student_name} · {selected.full_name}</div></div><button onClick={()=>setRecording(null)}>Close</button></div>
        <video controls autoPlay style={{width:"100%",maxHeight:"70vh"}} src={recording.recording_url}/>
      </div>
    </div>}
  </main>;
}