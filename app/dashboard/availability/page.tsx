"use client";
import {useEffect,useMemo,useState} from "react";
import Link from "next/link";

const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const pad=(n:number)=>String(n).padStart(2,"0");
const addMinutes=(t:string,m:number)=>{const p=t.split(":").map(Number),v=p[0]*60+p[1]+m;return pad(Math.floor(v/60)%24)+":"+pad(v%60)};
const fmtDate=(d:Date)=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());

export default function Availability(){
 const today=useMemo(()=>{const d=new Date();d.setHours(12,0,0,0);return d},[]);
 const maxDate=useMemo(()=>{const d=new Date(today);d.setDate(d.getDate()+14);return d},[today]);
 const[slots,setSlots]=useState<any[]>([]),[lessons,setLessons]=useState<any[]>([]),[busy,setBusy]=useState(""),[selected,setSelected]=useState<any>(null),[materials,setMaterials]=useState<any[]>([]),[records,setRecords]=useState<any[]>([]),[recordings,setRecordings]=useState<any[]>([]),[openMaterial,setOpenMaterial]=useState<any>(null);
 const[week,setWeek]=useState(()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay());return d});

 async function load(){try{const[a,l]=await Promise.all([fetch("/api/availability",{cache:"no-store"}),fetch("/api/lessons",{cache:"no-store"})]);if(a.ok)setSlots(await a.json());if(l.ok)setLessons(await l.json())}catch{}}
 useEffect(()=>{load();const refresh=()=>load();window.addEventListener("pageshow",refresh);window.addEventListener("visibilitychange",refresh);return()=>{window.removeEventListener("pageshow",refresh);window.removeEventListener("visibilitychange",refresh)}},[]);

 const dates=useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date(week);d.setDate(week.getDate()+i);return d}),[week]);
 const slotData=(date:string,time:string)=>{
   const dt=new Date(date+"T"+time+":00"),end=new Date(dt.getTime()+1800000);
   const lesson=lessons.find(l=>l.status!=="CANCELLED"&&new Date(l.starts_at)<end&&new Date(l.ends_at)>dt);
   const slot=slots.find(s=>s.slot_date===date&&String(s.start_time).slice(0,5)===time);
   return{lesson,slot}
 };

 async function openBooked(lesson:any){
   setSelected(lesson);setMaterials([]);setRecords([]);setRecordings([]);
   try{
    const[m,r,rec]=await Promise.all([
      fetch("/api/lesson-materials?lessonId="+encodeURIComponent(lesson.id),{cache:"no-store"}),
      fetch("/api/records",{cache:"no-store"}),
      fetch("/api/recordings",{cache:"no-store"})
    ]);
    if(m.ok)setMaterials(await m.json());
    if(r.ok)setRecords((await r.json()).filter((x:any)=>x.student_name===lesson.student_name&&x.lesson_id!==lesson.id));
    if(rec.ok)setRecordings((await rec.json()).filter((x:any)=>x.student_name===lesson.student_name&&x.lesson_id!==lesson.id));
   }catch{}
 }

 async function closeFuture(){
   if(!confirm("Close all future unbooked slots? Already booked lessons will NOT be changed."))return;
   setBusy("future");
   try{const x=await fetch("/api/availability",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"closeFuture"})});const j=await x.json();if(!x.ok)alert(j.error||"Could not close future slots.");else{alert((j.closed||0)+" future unbooked slot(s) closed. Booked lessons were left untouched.");load()}}finally{setBusy("")}
 }

 async function openSlot(date:string,time:string){
   const key=date+time;setBusy(key);
   try{
    const x=await fetch("/api/availability",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({slotDate:date,startTime:time})});
    const text=await x.text();let j:any={};try{j=JSON.parse(text)}catch{}
    if(!x.ok)alert(j.error||("Could not open slot. Server returned "+x.status));
    else setSlots(prev=>prev.some(s=>s.slot_date===date&&String(s.start_time).slice(0,5)===time)?prev:[...prev,{id:j.id,slot_date:date,start_time:time,end_time:addMinutes(time,30)}]);
   }catch{alert("Could not open slot. Please try again.")}finally{setBusy("")}
 }

 async function cancelSlot(date:string,time:string){
   setBusy(date+time);
   const x=await fetch("/api/availability?date="+encodeURIComponent(date)+"&startTime="+encodeURIComponent(time),{method:"DELETE"});
   const j=await x.json();if(!x.ok)alert(j.error||"Could not cancel slot.");else load();setBusy("")
 }

 function move(n:number){
   const d=new Date(week);d.setDate(d.getDate()+n);
   const maxWeek=new Date(today);maxWeek.setDate(maxWeek.getDate()-maxWeek.getDay());
   const last=new Date(maxWeek);last.setDate(last.getDate()+14);
   if(d<maxWeek||d>last)return;setWeek(d)
 }

 const times=Array.from({length:27},(_,i)=>addMinutes("09:00",i*30));
 const materialSrc=(m:any)=>"/api/lesson-materials/file?lessonId="+encodeURIComponent(selected?.id||"")+"&materialId="+encodeURIComponent(m.id);
 const isSameDay=(d:Date)=>fmtDate(d)===fmtDate(today);

 return <main className="main">
  <div className="booking-header">
   <div>
    <div className="eyebrow">TEACHER SCHEDULE</div>
    <h1>Booking Time</h1>
    <div className="muted">Your weekly teaching schedule and booked classes.</div>
   </div>
   <div className="booking-actions">
    <button onClick={()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay());setWeek(d)}}>This Week</button>
    <button onClick={()=>move(-7)}>← Previous</button>
    <button onClick={()=>move(7)}>Next →</button>
    <button className="secondary" onClick={closeFuture} disabled={busy==="future"}>{busy==="future"?"Closing…":"Close Future Slots"}</button>
   </div>
  </div>

  <div className="booking-summary">
   <div><span className="summary-dot booked-dot"></span><strong>Booked</strong><span>Click to prepare for class</span></div>
   <div><span className="summary-dot open-dot"></span><strong>Available</strong><span>Open for student booking</span></div>
   <div><span className="summary-dot empty-dot"></span><strong>Closed</strong><span>No booking slot</span></div>
  </div>

  <div className="schedule-card">
   <div className="schedule-scroll">
    <table className="booking-calendar">
     <thead><tr>
      <th className="time-head">Time</th>
      {dates.map((d,i)=><th key={i} className={isSameDay(d)?"today-head":""}><div>{dayNames[d.getDay()]}</div><strong>{d.toLocaleDateString("en-US",{month:"short",day:"numeric"})}</strong>{isSameDay(d)&&<span>Today</span>}</th>)}
     </tr></thead>
     <tbody>{times.map(t=><tr key={t}>
      <td className="time-cell">{t}</td>
      {dates.map(d=>{
       const date=fmtDate(d),sa=addMinutes(t,-360),{lesson,slot}=slotData(date,sa),key=date+sa;
       const dayOnly=new Date(date+"T12:00:00"),now=new Date();
       const nowSA=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",hour:"2-digit",minute:"2-digit",hour12:false}).format(now);
       const todaySA=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
       const inWindow=dayOnly>=today&&dayOnly<=maxDate,hasPassed=date<todaySA||(date===todaySA&&sa<=nowSA);
       return <td key={key} className={"schedule-cell "+(isSameDay(d)?"today-column":"")}>
        {lesson?<button className="booked-class" onClick={()=>openBooked(lesson)}>
          <div className="class-time">{sa} – {addMinutes(sa,30)}</div>
          <div className="class-student">{lesson.student_name}</div>
          <div className="class-type">{lesson.topic||"English Lesson"}</div>
          <div className="class-footer"><span>View class</span><span>›</span></div>
        </button>
        :slot?<div className="open-slot">
          <div className="open-label">AVAILABLE</div>
          <button className="cancel-slot" onClick={()=>cancelSlot(date,sa)} disabled={busy===key}>{busy===key?"…":"Close"}</button>
        </div>
        :!inWindow?<div className="closed-slot">Not open</div>
        :hasPassed?<div className="closed-slot">Passed</div>
        :<button className="book-slot" onClick={()=>openSlot(date,sa)} disabled={busy===key}>{busy===key?"Opening…":"Open slot"}</button>}
       </td>
      })}
     </tr>)}</tbody>
    </table>
   </div>
  </div>

  {selected&&<div className="class-modal-backdrop" onClick={()=>setSelected(null)}>
   <div className="class-modal" onClick={e=>e.stopPropagation()}>
    <div className="class-modal-head">
     <div><div className="eyebrow">BOOKED CLASS</div><h2>{selected.student_name}</h2><div className="muted">{selected.topic||"English lesson"} • {new Date(selected.starts_at).toLocaleString("en-ZA",{timeZone:"Africa/Johannesburg"})}</div></div>
     <button onClick={()=>setSelected(null)}>Close</button>
    </div>

    <div className="class-info-grid">
     <div><span>Student</span><strong>{selected.student_name}</strong></div>
     <div><span>Level</span><strong>{selected.student_level||"Beginner"}</strong></div>
     <div><span>Age</span><strong>{selected.student_age??"Not set"}</strong></div>
     <div><span>Classroom ID</span><strong><code>{selected.room_code}</code></strong></div>
    </div>

    <section className="prep-section">
     <div className="section-title"><div><span className="section-number">1</span><div><h3>Teaching Material</h3><p>Material selected for this lesson</p></div></div></div>
     {materials.length?<div className="material-cards">{materials.map(m=><button key={m.id} onClick={()=>setOpenMaterial(m)} className="prep-material"><span className="material-icon">▣</span><span><strong>{m.title}</strong><small>{m.folder||m.level||"School material"} • View only</small></span><span className="arrow">›</span></button>)}</div>:<div className="empty-prep">No lesson material has been assigned by the school yet.</div>}
    </section>

    <section className="prep-section">
     <div className="section-title"><div><span className="section-number">2</span><div><h3>Previous Performance</h3><p>Use this to prepare for the student</p></div></div></div>
     {records.length?<div className="history-list">{records.slice(0,5).map(r=><div key={r.id}><strong>{new Date(r.updated_at).toLocaleDateString("en-ZA")}</strong><span>{r.notes||"No comment recorded."}</span>{r.homework&&<small>Homework: {r.homework}</small>}</div>)}</div>:<div className="empty-prep">No previous performance record is available yet.</div>}
    </section>

    <section className="prep-section">
     <div className="section-title"><div><span className="section-number">3</span><div><h3>Previous Recording</h3><p>Recent lessons with this student</p></div></div></div>
     {recordings.length?<div className="recording-list">{recordings.slice(0,5).map(r=><div key={r.id}><span className="recording-icon">●</span><strong>{new Date(r.starts_at).toLocaleDateString("en-ZA",{timeZone:"Africa/Johannesburg"})}</strong><span>{Math.round((r.duration_seconds||0)/60)} min</span></div>)}</div>:<div className="empty-prep">No previous recordings.</div>}
    </section>

    <div className="class-modal-footer"><Link className="primary classroom-button" href={"/classroom/"+selected.room_code}>Open Classroom</Link></div>
   </div>
  </div>}

  {openMaterial&&selected&&<div className="material-viewer" onContextMenu={e=>e.preventDefault()}>
   <div className="material-viewer-head"><strong>▣ {openMaterial.title}</strong><button onClick={()=>setOpenMaterial(null)}>Close</button></div>
   <div className="material-viewer-body">{openMaterial.mime_type?.startsWith("image/")?<img src={materialSrc(openMaterial)} draggable={false} onContextMenu={e=>e.preventDefault()} />:<iframe title={openMaterial.title} src={materialSrc(openMaterial)+"#toolbar=0&navpanes=0&scrollbar=1"} sandbox="allow-same-origin allow-scripts" />}</div>
   <div className="material-viewer-note">School material • view only • downloading is not provided.</div>
  </div>}
 </main>
}