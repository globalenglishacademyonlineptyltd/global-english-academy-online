"use client";
import {useEffect,useRef,useState} from "react";

type Props={room:string;lessonId:string;teacher:boolean;student:boolean;studentName?:string;signal:(payload:any)=>void};
export default function ClassroomTeachingTools({room,lessonId,teacher,student,studentName="Student",signal}:Props){
 const [tab,setTab]=useState("question");
 const [question,setQuestion]=useState("Choose the correct answer");
 const [choices,setChoices]=useState(["A","B","C","D"]);
 const [correct,setCorrect]=useState(0);
 const [active,setActive]=useState<any>(null);
 const [responses,setResponses]=useState<any[]>([]);
 const [answer,setAnswer]=useState<number|null>(null);
 const [submitted,setSubmitted]=useState(false);
 const [seconds,setSeconds]=useState(60);
 const [remaining,setRemaining]=useState(60);
 const [running,setRunning]=useState(false);
 const [roll,setRoll]=useState(false);
 const [present,setPresent]=useState(false);
 const [notes,setNotes]=useState("");
 const [status,setStatus]=useState("");
 const after=useRef("1970-01-01T00:00:00.000Z");
 useEffect(()=>{let live=true;const poll=async()=>{try{const r=await fetch("/api/classroom-signals?roomCode="+encodeURIComponent(room)+"&after="+encodeURIComponent(after.current),{cache:"no-store"});if(!r.ok)return;const j=await r.json();for(const s of j.signals||[]){after.current=s.created_at;const p=s.payload||{};if(p.type==="teaching_poll"&&s.sender_id!==j.userId){setActive(p.poll);setResponses([]);setAnswer(null);setSubmitted(false);}if(p.type==="teaching_answer"&&teacher&&s.sender_id!==j.userId)setResponses(v=>v.some(x=>x.sender===s.sender_id)?v:v.concat([{sender:s.sender_id,choice:p.choice,name:p.name||studentName,correct:Number(p.choice)===Number(p.correct)}]));if(p.type==="teaching_close"&&s.sender_id!==j.userId){setActive(null);setAnswer(null);setSubmitted(false);}if(p.type==="roll_call"&&student&&s.sender_id!==j.userId)setRoll(true);if(p.type==="roll_response"&&teacher&&s.sender_id!==j.userId)setPresent(true);if(p.type==="class_timer"&&s.sender_id!==j.userId){setRemaining(Math.max(0,Number(p.seconds)||0));setRunning(!!p.running);}}}catch{}};poll();const id=setInterval(()=>{if(live)poll()},900);return()=>{live=false;clearInterval(id)}},[room,teacher,student]);
 useEffect(()=>{if(!running)return;const id=setInterval(()=>setRemaining(v=>{if(v<=1){setRunning(false);return 0;}return v-1}),1000);return()=>clearInterval(id)},[running]);
 const startPoll=()=>{const poll={id:Date.now(),question,choices:choices.filter(Boolean),correct};setActive(poll);setResponses([]);setAnswer(null);signal({type:"teaching_poll",poll});setStatus("Question sent to the student.");};
 const sendAnswer=()=>{if(answer===null||!active||submitted)return;signal({type:"teaching_answer",choice:answer,correct:active.correct,name:studentName});setSubmitted(true);setStatus(answer===active.correct?"Correct answer!":"Answer submitted.");};
 const closePoll=()=>{signal({type:"teaching_close"});setActive(null);setResponses([]);setAnswer(null);setSubmitted(false);setStatus("Question closed.");};
 const startTimer=()=>{setRemaining(seconds);setRunning(true);signal({type:"class_timer",seconds,running:true});};
 const stopTimer=()=>{setRunning(false);signal({type:"class_timer",seconds:remaining,running:false});};
 const startRoll=()=>{setRoll(true);setPresent(false);signal({type:"roll_call"});setStatus("Attendance request sent.");};
 const respondRoll=()=>{setRoll(false);signal({type:"roll_response"});setPresent(true);setStatus("Attendance confirmed.");};
 const fmt=(n:number)=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
 return <section className="gc-panel gc-teaching-tools"><h3>Teaching Tools</h3><div className="gc-tool-tabs">{[["question","Quick Question"],["timer","Countdown"],["attendance","Roll Call"],["notes","Class Notes"]].map(([id,label])=><button type="button" key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}</div>
 {tab==="question"&&<div className="gc-tool-content">{teacher?<><label>Question<input value={question} onChange={e=>setQuestion(e.target.value)} /></label>{choices.map((v,i)=><label key={i}>Option {String.fromCharCode(65+i)}<input value={v} onChange={e=>setChoices(old=>old.map((x,j)=>i===j?e.target.value:x))}/></label>)}<label>Correct answer<select value={correct} onChange={e=>setCorrect(Number(e.target.value))}>{choices.map((v,i)=><option value={i} key={i}>{String.fromCharCode(65+i)} — {v}</option>)}</select></label><button type="button" onClick={startPoll}>Send question to student</button><p>{responses.length} response(s) received</p>{responses.map((r,i)=><p key={i}>{r.name}: {String.fromCharCode(65+r.choice)} — {r.correct?"Correct":"Incorrect"}</p>)}{active&&<button type="button" onClick={closePoll}>Close question</button>}</>:active?<><strong>{active.question}</strong>{active.choices.map((v:string,i:number)=><button type="button" key={i} className={answer===i?"active":""} onClick={()=>setAnswer(i)} disabled={submitted}>{String.fromCharCode(65+i)}. {v}</button>)}<button type="button" disabled={answer===null||submitted} onClick={sendAnswer}>{submitted?"Answer submitted":"Submit answer"}</button></>:<p>Waiting for your teacher to send a question.</p>}</div>}
 {tab==="timer"&&<div className="gc-tool-content"><strong className="gc-tool-clock">{fmt(remaining)}</strong>{teacher&&<><label>Duration<select value={seconds} onChange={e=>setSeconds(Number(e.target.value))}><option value="120">2 minutes</option><option value="240">4 minutes</option><option value="360">6 minutes</option><option value="900">15 minutes</option><option value="2700">45 minutes</option></select></label><button type="button" onClick={startTimer}>Start countdown</button><button type="button" onClick={stopTimer}>Pause</button></>}{!teacher&&<p>{running?"Your teacher's countdown is running.":"Waiting for your teacher to start the timer."}</p>}</div>}
 {tab==="attendance"&&<div className="gc-tool-content">{teacher?<><button type="button" onClick={startRoll}>Start roll call</button><p>{present?"Student marked present.":"Waiting for student confirmation."}</p></>:roll?<><p>Your teacher is taking attendance.</p><button type="button" onClick={respondRoll}>I'm present</button></>:<p>{present?"Attendance confirmed.":"No attendance request at the moment."}</p>}</div>}
 {tab==="notes"&&<div className="gc-tool-content"><textarea rows={5} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Write lesson notes, new vocabulary and homework…" /><button type="button" onClick={()=>{const blob=new Blob([notes],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="GEAO-class-notes-"+lessonId+".txt";a.click();URL.revokeObjectURL(url);}}>Save notes to my device</button><p>Notes are kept in this classroom until you leave. Save a copy before ending the lesson.</p></div>}
 {status&&<small className="gc-tool-status">{status}</small>}</section>;
}
