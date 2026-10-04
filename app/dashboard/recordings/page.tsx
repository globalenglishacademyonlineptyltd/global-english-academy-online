"use client";
import{useEffect,useMemo,useState}from"react";

export default function Recordings(){
 const[rows,setRows]=useState<any[]>([]);
 const[teacher,setTeacher]=useState("");
 const[student,setStudent]=useState("");
 const[start,setStart]=useState("");
 const[end,setEnd]=useState("");
 const[filtered,setFiltered]=useState<any[]>([]);
 const[submitted,setSubmitted]=useState(false);

 useEffect(()=>{
  fetch("/api/recordings").then(r=>r.ok?r.json():[]).then((data)=>{
   setRows(data);
   setFiltered(data);
  });
 },[]);

 const teachers=useMemo(()=>Array.from(new Map(rows.map(r=>[r.teacher_id,r.teacher_name]).filter(([id,name])=>id&&name)).entries()).sort((a,b)=>String(a[1]).localeCompare(String(b[1]))),[rows]);
 const students=useMemo(()=>Array.from(new Map(rows.map(r=>[r.student_id,r.student_name]).filter(([id,name])=>id&&name)).entries()).sort((a,b)=>String(a[1]).localeCompare(String(b[1]))),[rows]);

 function applyFilter(){
  const startTime=start?new Date(start+"T00:00:00").getTime():null;
  const endTime=end?new Date(end+"T23:59:59.999").getTime():null;
  setFiltered(rows.filter(r=>{
   const t=new Date(r.starts_at).getTime();
   return(!teacher||r.teacher_id===teacher)&&(!student||r.student_id===student)&&(startTime===null||t>=startTime)&&(endTime===null||t<=endTime);
  }));
  setSubmitted(true);
 }

 function clearFilter(){
  setTeacher("");setStudent("");setStart("");setEnd("");setFiltered(rows);setSubmitted(false);
 }

 return <main className="main">
  <h1>Recordings</h1>
  <p className="muted">Lesson recordings saved from the virtual classroom.</p>
  <div className="card section" style={{marginBottom:16}}>
   <h2 style={{marginTop:0}}>Search Recordings</h2>
   <div className="form-grid">
    <label>Teacher<select value={teacher} onChange={e=>setTeacher(e.target.value)}><option value="">All Teachers</option>{teachers.map(([id,name])=><option key={String(id)} value={String(id)}>{String(name)}</option>)}</select></label>
    <label>Student<select value={student} onChange={e=>setStudent(e.target.value)}><option value="">All Students</option>{students.map(([id,name])=><option key={String(id)} value={String(id)}>{String(name)}</option>)}</select></label>
    <label>Start Date<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label>
    <label>End Date<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label>
   </div>
   <div style={{display:"flex",gap:10,marginTop:14}}>
    <button className="btn" type="button" onClick={applyFilter}>Filter</button>
    {submitted&&<button className="btn secondary" type="button" onClick={clearFilter}>Clear</button>}
   </div>
  </div>
  {rows.length===0?<div className="card section">No recordings have been stored yet.</div>:filtered.length===0?<div className="card section">No recordings match the selected filters.</div>:<div className="section">
   <table className="table"><thead><tr><th>Date</th><th>Teacher</th><th>Student</th><th>Duration</th><th>Recording</th></tr></thead>
   <tbody>{filtered.map(r=><tr key={r.id}><td>{new Date(r.starts_at).toLocaleString()}</td><td>{r.teacher_name}</td><td>{r.student_name}</td><td>{Math.floor((r.duration_seconds||0)/60)}:{String((r.duration_seconds||0)%60).padStart(2,"0")}</td><td><a href={r.storage_url} target="_blank" rel="noreferrer">Open recording</a></td></tr>)}</tbody></table>
  </div>}
 </main>
}