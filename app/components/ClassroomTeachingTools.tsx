"use client";

import {useEffect,useRef,useState} from "react";

type Props={room:string;lessonId:string;teacher:boolean;student:boolean;studentName?:string;signal:(payload:any)=>void};
type Poll={id:number;kind:string;question:string;choices:string[];correct:number;seconds:number};
type Response={sender:string;name:string;answer:string;correct:boolean;at:number};

export default function ClassroomTeachingTools({room,lessonId,teacher,student,studentName="Student",signal}:Props){
 const [tab,setTab]=useState("questions");
 const [kind,setKind]=useState("multiple");
 const [question,setQuestion]=useState("Choose the correct answer");
 const [choices,setChoices]=useState(["A","B","C","D"]);
 const [correct,setCorrect]=useState(0);
 const [answer,setAnswer]=useState("");
 const [fillAnswer,setFillAnswer]=useState("");
 const [active,setActive]=useState<Poll|null>(null);
 const [responses,setResponses]=useState<Response[]>([]);
 const [submitted,setSubmitted]=useState(false);
 const [seconds,setSeconds]=useState(60);
 const [remaining,setRemaining]=useState(60);
 const [pollRemaining,setPollRemaining]=useState(0);
 const [running,setRunning]=useState(false);
 const [roll,setRoll]=useState(false);
 const [attendance,setAttendance]=useState<string[]>([]);
 const [notes,setNotes]=useState("");
 const [status,setStatus]=useState("");
 const after=useRef("1970-01-01T00:00:00.000Z");
 const name=studentName||"Student";

 useEffect(()=>{
  let live=true;
  const poll=async()=>{
   try{
    const r=await fetch("/api/classroom-signals?roomCode="+encodeURIComponent(room)+"&after="+encodeURIComponent(after.current),{cache:"no-store"});
    if(!r.ok)return;
    const j=await r.json();
    for(const s of j.signals||[]){
     after.current=s.created_at;
     const p=s.payload||{};
     if(s.sender_id===j.userId)continue;
     if(p.type==="teaching_poll"&&student){setActive(p.poll);setAnswer("");setFillAnswer("");setSubmitted(false);setStatus("Your teacher has sent a question.");}
     if(p.type==="teaching_answer"&&teacher){setResponses(v=>v.some(x=>x.sender===s.sender_id)?v:v.concat([{sender:s.sender_id,name:p.name||"Student",answer:String(p.answerLabel??p.answer??""),correct:!!p.correct,at:Date.now()}]));}
     if(p.type==="teaching_close"&&student){setActive(null);setSubmitted(false);setStatus("The question has closed.");}
     if(p.type==="roll_call"&&student){setRoll(true);setStatus("Your teacher is taking attendance.");}
     if(p.type==="roll_end"&&student){setRoll(false);setStatus("Roll call has ended.");}
     if(p.type==="roll_response"&&teacher){setAttendance(v=>v.includes(p.name||"Student")?v:v.concat([p.name||"Student"]));}
     if(p.type==="class_timer"&&student){setRemaining(Math.max(0,Number(p.seconds)||0));setRunning(!!p.running);}
    }
   }catch{}
  };
  void poll();const id=setInterval(()=>{if(live)void poll();},800);
  return()=>{live=false;clearInterval(id);};
 },[room,teacher,student]);

 useEffect(()=>{
  if(!running)return;
  const id=setInterval(()=>setRemaining(v=>{if(v<=1){setRunning(false);return 0;}return v-1;}),1000);
  return()=>clearInterval(id);
 },[running]);

 useEffect(()=>{
  if(!active)return;
  const endAt=Date.now()+Math.max(1,active.seconds||60)*1000;
  const tick=()=>{
   const left=Math.max(0,Math.ceil((endAt-Date.now())/1000));
   setPollRemaining(left);
   if(left===0){setActive(null);setSubmitted(true);setStatus("Question time is up.");if(teacher)signal({type:"teaching_close"});}
  };
  tick();const id=setInterval(tick,250);
  return()=>clearInterval(id);
 },[active,teacher,signal]);

 const startPoll=()=>{
  const opts=kind==="truefalse"?["True","False"]:kind==="yesno"?["Yes","No"]:kind==="understand"?["I understand","I need help"]:choices.filter(Boolean);
  const poll:Poll={id:Date.now(),kind,question,choices:opts,correct:kind==="multiple"?correct:kind==="truefalse"?correct:0,seconds};
  setActive(poll);setResponses([]);setSubmitted(false);signal({type:"teaching_poll",poll});setStatus("Question released to the student.");
 };
 const sendAnswer=()=>{
  if(!active||submitted)return;
  const value=active.kind==="fill"?fillAnswer.trim():answer;
  if(!value)return;
  const right=active.kind==="fill"?value.toLowerCase()===active.choices[0].toLowerCase():active.kind==="understand"?value==="I understand":Number(value)===active.correct;
  signal({type:"teaching_answer",answer:value,answerLabel:active.kind==="multiple"||active.kind==="truefalse"||active.kind==="yesno"?active.choices[Number(value)]:value,correct:right,name,kind:active.kind});
  setSubmitted(true);setStatus(active.kind==="understand"?(value==="I understand"?"Student understands.":"Student needs help."):(right?"Correct answer!":"Answer submitted."));
 };
 const closePoll=()=>{signal({type:"teaching_close"});setActive(null);setResponses([]);setStatus("Question closed.");};
 const startTimer=()=>{setRemaining(seconds);setRunning(true);signal({type:"class_timer",seconds,running:true});};
 const pauseTimer=()=>{setRunning(false);signal({type:"class_timer",seconds:remaining,running:false});};
 const startRoll=()=>{setRoll(true);setAttendance([]);signal({type:"roll_call"});setStatus("Attendance request sent.");};
 const endRoll=()=>{setRoll(false);signal({type:"roll_end"});setStatus("Roll call ended.");};
 const respondRoll=()=>{setRoll(false);signal({type:"roll_response",name});setStatus("Attendance confirmed.");};
 const fmt=(n:number)=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
 const saveNotes=()=>{const blob=new Blob([notes],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="GEAO-class-notes-"+lessonId+".txt";a.click();URL.revokeObjectURL(url);};

 return <section className="gc-panel gc-teaching-tools">
  <h3>Teaching Centre</h3>
  <div className="gc-tool-tabs">
   {[["questions","Questions & Polls"],["attendance","Roll Call"],["timer","Countdown"],["notes","Class Notes"]].map(([id,label])=><button type="button" key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}
  </div>
  {tab==="questions"&&<div className="gc-tool-content">
   {teacher?<>
    <label>Question type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="multiple">Multiple choice</option><option value="fill">Fill in the blank</option><option value="truefalse">True / False</option><option value="yesno">Yes / No</option><option value="understand">Understand / Need help</option></select></label>
    <label>Question<input value={question} onChange={e=>setQuestion(e.target.value)} /></label>
    {kind==="multiple"&&<>{choices.map((v,i)=><label key={i}>Option {String.fromCharCode(65+i)}<input value={v} onChange={e=>setChoices(old=>old.map((x,j)=>i===j?e.target.value:x))}/></label>)}<label>Correct answer<select value={correct} onChange={e=>setCorrect(Number(e.target.value))}>{choices.map((v,i)=><option value={i} key={i}>{String.fromCharCode(65+i)} — {v}</option>)}</select></label></>}
    {kind==="fill"&&<label>Correct answer<input value={choices[0]} onChange={e=>setChoices(old=>[e.target.value,...old.slice(1)])} placeholder="Expected answer"/></label>}
    {(kind==="truefalse"||kind==="yesno")&&<label>Correct answer<select value={correct} onChange={e=>setCorrect(Number(e.target.value))}><option value={0}>{kind==="truefalse"?"True":"Yes"}</option><option value={1}>{kind==="truefalse"?"False":"No"}</option></select></label>}
    <label>Answer time<select value={seconds} onChange={e=>setSeconds(Number(e.target.value))}><option value="30">30 seconds</option><option value="60">1 minute</option><option value="120">2 minutes</option><option value="240">4 minutes</option><option value="360">6 minutes</option><option value="900">15 minutes</option><option value="2700">45 minutes</option></select></label>
    <button type="button" onClick={startPoll}>Release question to student</button>
    <p>{responses.length} response(s) received</p>
    {responses.map((r,i)=><p key={i}><strong>{r.name}</strong>: {r.answer} — {r.correct?"Correct":"Submitted"}</p>)}
    {active&&<><p>Time remaining: <strong>{fmt(pollRemaining)}</strong></p><button type="button" onClick={closePoll}>Close question</button></>}
   </>:active?<><strong>{active.question}</strong>
    {active.kind==="fill"?<input value={fillAnswer} onChange={e=>setFillAnswer(e.target.value)} disabled={submitted} placeholder="Type your answer"/>:active.choices.map((v,i)=><button type="button" key={i} className={answer===String(i)?"active":""} onClick={()=>setAnswer(active.kind==="understand"?v:String(i))} disabled={submitted}>{active.kind==="multiple"?String.fromCharCode(65+i)+". ":""}{v}</button>)}
    <button type="button" disabled={submitted||(active.kind==="fill"?!fillAnswer.trim():!answer)} onClick={sendAnswer}>{submitted?"Answer submitted":"Submit answer"}</button>
   </>:<p>Waiting for your teacher to release a question.</p>}
  </div>}
  {tab==="attendance"&&<div className="gc-tool-content">
   {teacher?<><button type="button" onClick={startRoll}>Start roll call</button><button type="button" onClick={endRoll} disabled={!roll}>End roll call</button><p><strong>Attendance responses</strong></p>{attendance.length?attendance.map((n,i)=><p key={i}>🟢 {n} — Present</p>):<p>Waiting for student confirmation.</p>}</>:roll?<><p>Your teacher is taking attendance.</p><button type="button" onClick={respondRoll}>I'm present</button></>:<p>There is no active roll call.</p>}
  </div>}
  {tab==="timer"&&<div className="gc-tool-content"><strong className="gc-tool-clock">{fmt(remaining)}</strong>{teacher&&<><label>Countdown duration<select value={seconds} onChange={e=>setSeconds(Number(e.target.value))}><option value="120">2 minutes</option><option value="240">4 minutes</option><option value="360">6 minutes</option><option value="900">15 minutes</option><option value="2700">45 minutes</option></select></label><button type="button" onClick={startTimer}>Start countdown</button><button type="button" onClick={pauseTimer}>Pause countdown</button></>}{student&&<p>{running?"Your teacher's countdown is running.":"Waiting for your teacher to start the timer."}</p>}</div>}
  {tab==="notes"&&<div className="gc-tool-content"><textarea rows={5} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Write lesson notes, new vocabulary and homework…"/><button type="button" onClick={saveNotes}>Save class notes</button><p>Notes are private to this classroom session. Save a copy before leaving.</p></div>}
  {status&&<small className="gc-tool-status" aria-live="polite">{status}</small>}
 </section>;
}
