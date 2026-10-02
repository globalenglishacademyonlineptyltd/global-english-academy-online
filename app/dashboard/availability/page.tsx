"use client";
import{useEffect,useMemo,useState}from"react";import Link from"next/link";

const dayNames=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const fullDays=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const pad=(n:number)=>String(n).padStart(2,"0");
const addMinutes=(t:string,m:number)=>{const p=t.split(":").map(Number),v=p[0]*60+p[1]+m;return pad(Math.floor(v/60)%24)+":"+pad(v%60)};
const fmtDate=(d:Date)=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());

export default function Availability(){
 const[rows,setRows]=useState<any[]>([]),[lessons,setLessons]=useState<any[]>([]),[week,setWeek]=useState(()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay());return d}),[busy,setBusy]=useState("");
 async function load(){const[a,l]=await Promise.all([fetch("/api/availability"),fetch("/api/lessons")]);if(a.ok)setRows(await a.json());if(l.ok)setLessons(await l.json())}
 useEffect(()=>{load()},[]);
 const dates=useMemo(()=>Array.from({length:7},(_,i)=>{const d=new Date(week);d.setDate(week.getDate()+i);return d}),[week]);
 const recurringSlots=(date:string)=>{const dow=new Date(date+"T12:00:00").getDay(),out:string[]=[];for(const r of rows.filter(x=>x.day_of_week===dow)){let cur=String(r.start_time).slice(0,5),end=String(r.end_time).slice(0,5);while(cur<end){out.push(cur);cur=addMinutes(cur,30)}}return out};
 const slotData=(date:string,time:string)=>{
  const dt=new Date(date+"T"+time+":00"),end=new Date(dt.getTime()+1800000);
  const lesson=lessons.find(l=>l.status!=="CANCELLED"&&new Date(l.starts_at)<end&&new Date(l.ends_at)>dt);
  const recurring=recurringSlots(date).includes(time);
  const slotRow=rows.find(x=>x.slot_date===date&&String(x.start_time).slice(0,5)===time);
  return{lesson,recurring,slotRow};
 };
 async function openSlot(date:string,time:string){
  setBusy(date+time);
  const x=await fetch("/api/availability",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({slotDate:date,startTime:time})});
  const j=await x.json();if(!x.ok)alert(j.error||"Could not open slot.");else load();setBusy("");}
 async function cancelSlot(date:string,time:string){
  setBusy(date+time);
  const x=await fetch("/api/availability?date="+encodeURIComponent(date)+"&startTime="+encodeURIComponent(time),{method:"DELETE"});
  const j=await x.json();if(!x.ok)alert(j.error||"Could not cancel slot.");else load();setBusy("");}
 function prev(){const d=new Date(week);d.setDate(d.getDate()-7);setWeek(d)}
 function next(){const d=new Date(week);d.setDate(d.getDate()+7);setWeek(d)}
 const title=dates[0].toLocaleDateString("en-US",{month:"2-digit",day:"2-digit"})+" – "+dates[6].toLocaleDateString("en-US",{month:"2-digit",day:"2-digit"});
 const times=Array.from({length:27},(_,i)=>addMinutes("09:00",i*30));
 return <main className="main"><div className="topbar"><div><h1>Booking Time</h1><div className="muted">Open individual 30-minute teaching slots for students to book.</div></div><div><button onClick={prev}>← Previous</button><button style={{marginLeft:8}} onClick={()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-d.getDay());setWeek(d)}}>This Week</button><button style={{marginLeft:8}} onClick={next}>Next →</button></div></div>
 <div className="card"><strong>{title}</strong><p className="muted">Main time: Taiwan / student schedule. Smaller time: South Africa. Each button opens exactly one 30-minute slot.</p></div>
 <div style={{overflowX:"auto"}}><table className="table" style={{minWidth:1100}}><thead><tr><th style={{minWidth:90}}>Time</th>{dates.map((d,i)=><th key={i} style={{minWidth:135}}>{dayNames[d.getDay()]}<br/>{d.toLocaleDateString("en-US",{month:"2-digit",day:"2-digit"})}</th>)}</tr></thead>
 <tbody>{times.map(t=><tr key={t}><td><strong>{t}</strong></td>{dates.map(d=>{const date=fmtDate(d),sa=addMinutes(t,-360),{lesson,recurring,slotRow}=slotData(date,sa);const key=date+sa;return <td key={key} style={{verticalAlign:"top"}}><div className="muted" style={{fontSize:12}}>SA {sa}</div>{lesson?<><div className="badge">BOOKED</div><div style={{fontSize:12,marginTop:4}}>{lesson.student_name}</div><Link href={"/classroom/"+lesson.room_code}>Join</Link></>:slotRow||recurring?<><div style={{fontSize:12}}>OPEN</div><button onClick={()=>cancelSlot(date,sa)} disabled={busy===key}>{busy===key?"...":"Cancel Slot"}</button></>:<button className="primary" onClick={()=>openSlot(date,sa)} disabled={busy===key}>{busy===key?"Opening…":"Book Slot"}</button>}</td>})}</tr>)}</tbody></table></div>
 <div className="section"><h2>Recurring availability</h2><p className="muted">Your existing recurring windows remain available. They automatically create 30-minute openings; individual calendar slots can be opened or cancelled for specific dates.</p><table className="table"><thead><tr><th>Day</th><th>Start</th><th>End</th><th>Action</th></tr></thead><tbody>{rows.filter(r=>!r.slot_date).map(r=><tr key={r.id}><td>{fullDays[r.day_of_week]}</td><td>{String(r.start_time).slice(0,5)}</td><td>{String(r.end_time).slice(0,5)}</td><td><button onClick={async()=>{if(!confirm("Cancel this recurring availability?"))return;const x=await fetch("/api/availability",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({availabilityId:r.id})});const j=await x.json();if(!x.ok)alert(j.error);else load()}}>Cancel availability</button></td></tr>)}</tbody></table></div>
 </main>
}