"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {useParams,useRouter} from "next/navigation";

type Lesson={id:string;room_code:string;teacher_id:string;student_id:string;teacher_name:string;student_name:string;starts_at:string;ends_at:string;status:string;topic:string;lesson_type:string;class_id?:string;student_age?:number;student_level?:string};
type Activity={kind:"pick"|"sort"|"match"|"order";title:string;prompt:string;items:string[];answer:string[]};
type Signal={id:string;sender_id:string;payload:any;created_at:string};
type Pos={x:number;y:number;w:number};

const activities:Activity[]=[
 {kind:"pick",title:"Picture Pick",prompt:"Click the correct animal.",items:["🐶 Dog","🐱 Cat","🐟 Fish","🦁 Lion"],answer:["🐶 Dog"]},
 {kind:"sort",title:"Sort It",prompt:"Put each animal in the correct group.",items:["🐶 Dog","🐟 Fish","🐱 Cat","🦈 Shark"],answer:["Land","Water"]},
 {kind:"match",title:"Match It",prompt:"Match each word to its picture.",items:["SUN","🍎","APPLE","☀️"],answer:["SUN→☀️","APPLE→🍎"]},
 {kind:"order",title:"Put in Order",prompt:"Put the story in the correct order.",items:["Wake up","Go to school","Eat breakfast","Go home"],answer:["Wake up","Eat breakfast","Go to school","Go home"]}
];

function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n));}

export default function Classroom(){
 const params=useParams<{roomCode:string}>();
 const router=useRouter();
 const roomCode=String(params?.roomCode||"");
 const [user,setUser]=useState<any>(null);
 const [lesson,setLesson]=useState<Lesson|null>(null);
 const [branding,setBranding]=useState<any>(null);
 const [error,setError]=useState("");
 const [connected,setConnected]=useState(false);
 const [muted,setMuted]=useState(false);
 const [cameraOn,setCameraOn]=useState(true);
 const [interactive,setInteractive]=useState(false);
 const [activity,setActivity]=useState<Activity|null>(null);
 const [score,setScore]=useState(0);
 const [reward,setReward]=useState("");
 const [chat,setChat]=useState<{name:string;text:string}[]>([]);
 const [chatText,setChatText]=useState("");
 const [recording,setRecording]=useState(false);
 const [recordSeconds,setRecordSeconds]=useState(0);
 const [ending,setEnding]=useState(false);
 const [showGames,setShowGames]=useState(false);
 const [showLayout,setShowLayout]=useState(false);
 const [positions,setPositions]=useState<{teacher:Pos;student:Pos}>({teacher:{x:2,y:2,w:24},student:{x:74,y:2,w:24}});
 const [materials,setMaterials]=useState<any[]>([]);
 const [materialIndex,setMaterialIndex]=useState(0);

 const localVideo=useRef<HTMLVideoElement>(null);
 const remoteVideo=useRef<HTMLVideoElement>(null);
 const localStream=useRef<MediaStream|null>(null);
 const remoteStream=useRef<MediaStream|null>(null);
 const pc=useRef<RTCPeerConnection|null>(null);
 const pollTimer=useRef<ReturnType<typeof setInterval>|null>(null);
 const after=useRef("1970-01-01T00:00:00.000Z");
 const seen=useRef(new Set<string>());
 const recorder=useRef<MediaRecorder|null>(null);
 const chunks=useRef<Blob[]>([]);
 const recordingStarted=useRef<number|null>(null);
 const snapshotTimer=useRef<ReturnType<typeof setInterval>|null>(null);

 const isTeacher=user?.role==="TEACHER";
 const isStudent=user?.role==="STUDENT";

 const sendSignal=useCallback(async(payload:any)=>{
   if(!roomCode)return;
   try{await fetch("/api/classroom-signals",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({roomCode,payload})});}catch{}
 },[roomCode]);

 const broadcast=useCallback((extra:any={})=>{
   if(!isTeacher)return;
   sendSignal({type:"state",interactive,activity,positions,score,reward,...extra});
 },[isTeacher,sendSignal,interactive,activity,positions,score,reward]);

 const makePeer=useCallback(()=>{
   if(pc.current)return pc.current;
   const peer=new RTCPeerConnection({
     iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]
   });
   pc.current=peer;
   if(localStream.current)localStream.current.getTracks().forEach(t=>peer.addTrack(t,localStream.current as MediaStream));
   peer.onicecandidate=e=>{if(e.candidate)sendSignal({type:"ice",candidate:e.candidate});};
   peer.ontrack=e=>{
     if(!remoteStream.current)remoteStream.current=new MediaStream();
     if(!remoteStream.current.getTracks().some(t=>t.id===e.track.id))remoteStream.current.addTrack(e.track);
     if(remoteVideo.current)remoteVideo.current.srcObject=remoteStream.current;
   };
   peer.onconnectionstatechange=()=>{
     setConnected(peer.connectionState==="connected");
   };
   return peer;
 },[sendSignal]);

 const startOffer=useCallback(async()=>{
   if(!isTeacher)return;
   const peer=makePeer();
   try{
     const offer=await peer.createOffer();
     await peer.setLocalDescription(offer);
     await sendSignal({type:"offer",description:peer.localDescription});
   }catch{}
 },[isTeacher,makePeer,sendSignal]);

 const handleSignal=useCallback(async(sig:Signal)=>{
   if(seen.current.has(sig.id))return;
   seen.current.add(sig.id);
   const p=sig.payload||{};
   if(p.type==="hello"){if(isTeacher)await startOffer();return;}
   if(p.type==="state"&&isStudent){
     setInteractive(Boolean(p.interactive));
     setActivity(p.activity||null);
     if(p.positions)setPositions(p.positions);
     setScore(Number(p.score)||0);
     setReward(String(p.reward||""));
     return;
   }
   if(p.type==="chat"){
     setChat(v=>v.concat([{name:String(p.name||"Classroom"),text:String(p.text||"")}]).slice(-80));
     return;
   }
   const peer=makePeer();
   if(p.type==="offer"&&isStudent){
     try{
       await peer.setRemoteDescription(p.description);
       const answer=await peer.createAnswer();
       await peer.setLocalDescription(answer);
       await sendSignal({type:"answer",description:peer.localDescription});
     }catch{}
   }else if(p.type==="answer"&&isTeacher){
     try{await peer.setRemoteDescription(p.description);}catch{}
   }else if(p.type==="ice"&&p.candidate){
     try{await peer.addIceCandidate(p.candidate);}catch{}
   }
 },[isTeacher,isStudent,startOffer,makePeer,sendSignal]);

 const poll=useCallback(async()=>{
   try{
     const r=await fetch("/api/classroom-signals?roomCode="+encodeURIComponent(roomCode)+"&after="+encodeURIComponent(after.current),{cache:"no-store"});
     if(!r.ok)return;
     const j=await r.json();
     for(const sig of (j.signals||[]) as Signal[]){
       after.current=sig.created_at;
       if(sig.sender_id!==j.userId)await handleSignal(sig);
     }
   }catch{}
 },[roomCode,handleSignal]);

 useEffect(()=>{
   Promise.all([
     fetch("/api/me",{cache:"no-store"}).then(r=>r.json()),
     fetch("/api/branding",{cache:"no-store"}).then(r=>r.json()).catch(()=>null),
     fetch("/api/lessons",{cache:"no-store"}).then(r=>r.json())
   ]).then(([me,b,ls])=>{
     if(!me.user){router.replace("/login");return;}
     setUser(me.user);setBranding(b);
     const found=(ls||[]).find((x:any)=>x.room_code===roomCode);
     if(!found){setError("This classroom could not be found.");return;}
     setLesson(found);
   }).catch(()=>setError("Unable to load this classroom."));
 },[roomCode,router]);

 useEffect(()=>{
   if(!lesson||!user)return;
   fetch("/api/materials",{cache:"no-store"}).then(r=>r.ok?r.json():[]).then(setMaterials).catch(()=>{});
 },[lesson,user]);

 useEffect(()=>{
   if(!lesson||!user)return;
   let alive=true;
   navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(stream=>{
     if(!alive)return;
     localStream.current=stream;
     if(localVideo.current)localVideo.current.srcObject=stream;
     makePeer();
     sendSignal({type:"hello"});
   }).catch(()=>{setCameraOn(false);});
   return()=>{alive=false;localStream.current?.getTracks().forEach(t=>t.stop());localStream.current=null;if(pc.current){pc.current.close();pc.current=null;}};
 },[lesson,user,makePeer,sendSignal]);

 useEffect(()=>{
   if(!lesson||!user)return;
   poll();
   pollTimer.current=setInterval(poll,700);
   return()=>{if(pollTimer.current)clearInterval(pollTimer.current);};
 },[lesson,user,poll]);

 useEffect(()=>{
   if(!isTeacher||!lesson)return;
   snapshotTimer.current=setInterval(()=>broadcast(),2000);
   return()=>{if(snapshotTimer.current)clearInterval(snapshotTimer.current);};
 },[isTeacher,lesson,broadcast]);

 useEffect(()=>{
   if(!recording)return;
   const t=setInterval(()=>{if(recordingStarted.current)setRecordSeconds(Math.floor((Date.now()-recordingStarted.current)/1000));},1000);
   return()=>clearInterval(t);
 },[recording]);

 const startRecording=()=>{
   if(recording||!lesson)return;
   const canvas=document.createElement("canvas");canvas.width=1280;canvas.height=720;
   const ctx=canvas.getContext("2d");if(!ctx){alert("Recording is not supported here.");return;}
   const draw=()=>{
     if(!recordingStarted.current)return;
     ctx.fillStyle="#f4f7fb";ctx.fillRect(0,0,1280,720);
     ctx.fillStyle="#ffffff";ctx.fillRect(25,25,1230,670);
     ctx.fillStyle="#172033";ctx.font="bold 30px Arial";ctx.fillText(branding?.school_name||"Global English Academy",50,65);
     ctx.font="bold 34px Arial";ctx.fillText(activity?.title||lesson.topic||"English Lesson",60,130);
     ctx.font="24px Arial";ctx.fillText(activity?.prompt||"Live interactive English lesson",60,175);
     const a=localVideo.current,b=remoteVideo.current;
     if(a&&a.readyState>=2)ctx.drawImage(a,930,85,270,170);
     if(b&&b.readyState>=2)ctx.drawImage(b,930,270,270,170);
     requestAnimationFrame(draw);
   };
   const stream=canvas.captureStream(10);
   if(localStream.current?.getAudioTracks()[0])stream.addTrack(localStream.current.getAudioTracks()[0]);
   const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")?"video/webm;codecs=vp9,opus":"video/webm";
   try{
     chunks.current=[];
     const mr=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:800000});
     mr.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data);};
     mr.onstop=()=>{
       stream.getTracks().forEach(t=>t.stop());
       const blob=new Blob(chunks.current,{type:mime});
       const reader=new FileReader();
       reader.onloadend=()=>{fetch("/api/recordings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lessonId:lesson.id,roomCode,durationSeconds:recordSeconds,mimeType:mime,data:reader.result})}).catch(()=>{});};
       reader.readAsDataURL(blob);
     };
     recorder.current=mr;recordingStarted.current=Date.now();setRecordSeconds(0);setRecording(true);mr.start(1000);draw();
   }catch{alert("Recording could not be started.");}
 };

 const stopRecording=()=>{if(recorder.current){recorder.current.stop();recorder.current=null;}recordingStarted.current=null;setRecording(false);};

 const endClass=async()=>{
   if(ending)return;
   setEnding(true);if(recording)stopRecording();
   try{await fetch("/api/classroom-complete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lessonId:lesson?.id})});}catch{}
   localStream.current?.getTracks().forEach(t=>t.stop());
   router.replace("/dashboard");
 };

 const chooseActivity=(a:Activity)=>{
   if(!isTeacher)return;
   setActivity(a);setInteractive(true);setReward("");setScore(0);setShowGames(false);
   broadcast({activity:a,interactive:true,reward:"",score:0});
 };

 const studentClick=(item:string)=>{
   if(!isStudent||!interactive||!activity)return;
   const correct=activity.kind==="pick"&&item===activity.answer[0];
   const next=correct?score+1:score;
   setScore(next);setReward(correct?"⭐ Great job!":"Try again!");
   sendSignal({type:"state",interactive,activity,positions,score:next,reward:correct?"⭐ Great job!":"Try again!"});
 };

 const sendChat=()=>{
   const text=chatText.trim();if(!text)return;
   const name=user?.name||"User";
   setChat(v=>v.concat([{name,text}]).slice(-80));
   sendSignal({type:"chat",name,text});setChatText("");
 };

 const dragVideo=(who:"teacher"|"student",e:React.PointerEvent)=>{
   if(!isTeacher&&((who==="teacher"&&user?.role!=="TEACHER")||(who==="student"&&user?.role!=="STUDENT")))return;
   const parent=(e.currentTarget.parentElement as HTMLElement);if(!parent)return;
   const box=(e.currentTarget as HTMLElement).getBoundingClientRect();const pr=parent.getBoundingClientRect();
   const dx=e.clientX-box.left,dy=e.clientY-box.top;
   const move=(ev:PointerEvent)=>{
     const x=clamp(((ev.clientX-pr.left-dx)/pr.width)*100,0,100-positions[who].w);
     const y=clamp(((ev.clientY-pr.top-dy)/pr.height)*100,0,85);
     setPositions(v=>({...v,[who]:{...v[who],x,y}}));
   };
   const up=()=>{
     window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);
     if(isTeacher)broadcast();
   };
   window.addEventListener("pointermove",move);window.addEventListener("pointerup",up,{once:true});
 };

 const layout=(name:"normal"|"roleplay"|"side")=>{
   const p=name==="roleplay"?{teacher:{x:4,y:62,w:27},student:{x:69,y:62,w:27}}:name==="side"?{teacher:{x:3,y:3,w:21},student:{x:27,y:3,w:21}}:{teacher:{x:2,y:2,w:24},student:{x:74,y:2,w:24}};
   setPositions(p);if(isTeacher)broadcast({positions:p});setShowLayout(false);
 };

 const format=(s:number)=>String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");
 const material=materials[materialIndex];
 const src=material?.content_data||material?.url||"";

 if(error)return <main className="classroom-error"><div><h2>{error}</h2><button onClick={()=>router.replace("/dashboard")}>Back to Dashboard</button></div></main>;
 if(!lesson||!user)return <main className="classroom-loading">Loading classroom…</main>;

 return <main className="gea-classroom" style={{"--school-primary":branding?.primary_color||"#2563eb","--school-secondary":branding?.secondary_color||"#0f172a","--school-accent":branding?.accent_color||"#f59e0b"} as React.CSSProperties}>
  <header className="gc-top">
   <div className="gc-brand">{branding?.logo_data?<img src={branding.logo_data} alt={branding.school_name}/>:<span className="gc-brand-icon">🎓</span>}<div><strong>{branding?.school_name||"Global English Academy"}</strong><small>{lesson.class_id||"Live Classroom"} • {lesson.student_name}</small></div></div>
   <div className="gc-status"><span className={connected?"gc-dot live":"gc-dot"}></span>{connected?"Connected":"Waiting for partner…"}</div>
   <div className="gc-actions">
    <button className={muted?"active":""} onClick={()=>{const n=!muted;localStream.current?.getAudioTracks().forEach(t=>t.enabled=!n);setMuted(n);}}>🎙 {muted?"Unmute":"Mute"}</button>
    <button className={!cameraOn?"active":""} onClick={()=>{const n=!cameraOn;localStream.current?.getVideoTracks().forEach(t=>t.enabled=n);setCameraOn(n);}}>📷 Camera</button>
    <button className={recording?"active":""} onClick={recording?stopRecording:startRecording}>⏺ {recording?"Stop "+format(recordSeconds):"Record"}</button>
    <button onClick={()=>setShowLayout(true)}>🎭 Role Play</button>
    <button className="danger" onClick={endClass}>{ending?"Ending…":"End Class"}</button>
   </div>
  </header>

  <div className="gc-body">
   <section className="gc-main">
    <div className="gc-stage">
     <div className="gc-lessonbar"><strong>{lesson.topic||"English Lesson"}</strong><span>{interactive?"🟢 Interactive Mode ON":"Teaching Mode"} {recording?" • 🔴 Recording":""}</span></div>
     <div className="gc-material">
      {src&&/^data:image\//.test(src)?<img src={src} alt="Lesson material"/>:src&&/\.pdf($|\?)/i.test(src)?<iframe src={src} title="Lesson material"/>:<div className="gc-placeholder"><div>📚</div><h2>{lesson.topic||"Let's learn English!"}</h2><p>{material?.title||"Choose a game or open a lesson material."}</p></div>}
     </div>

     <div className="gc-video" style={{left:positions.teacher.x+"%",top:(positions.teacher.y+5)+"%",width:positions.teacher.w+"%"}} onPointerDown={e=>dragVideo("teacher",e)}>
       <video ref={isTeacher?localVideo:remoteVideo} autoPlay playsInline muted={isTeacher}/>
       <div className="gc-video-label">👩‍🏫 {lesson.teacher_name}</div>
     </div>
     <div className="gc-video" style={{left:positions.student.x+"%",top:(positions.student.y+5)+"%",width:positions.student.w+"%"}} onPointerDown={e=>dragVideo("student",e)}>
       <video ref={isTeacher?remoteVideo:localVideo} autoPlay playsInline muted={isStudent}/>
       <div className="gc-video-label">🧒 {lesson.student_name}</div>
     </div>

     {activity&&interactive&&<div className="gc-game-overlay"><div className="gc-game-card">
       <h2>{activity.title}</h2><p>{activity.prompt}</p>
       {activity.kind==="pick"&&<div className="gc-game-grid">{activity.items.map(x=><button className="gc-game-item" key={x} disabled={!isStudent} onClick={()=>studentClick(x)}>{x}</button>)}</div>}
       {activity.kind==="sort"&&<div className="gc-game-grid">{activity.items.map(x=><button className="gc-game-item" key={x} disabled={!isStudent} onClick={()=>studentClick(x+" Land")}>{x}</button>)}</div>}
       {activity.kind==="match"&&<div className="gc-game-grid">{activity.items.map(x=><button className="gc-game-item" key={x} disabled={!isStudent} onClick={()=>studentClick(x)}>{x}</button>)}</div>}
       {activity.kind==="order"&&<div className="gc-game-grid">{activity.items.map(x=><button className="gc-game-item" key={x} disabled={!isStudent} onClick={()=>studentClick(x)}>{x}</button>)}</div>}
       {reward&&<div className="gc-reward">{reward} {score>0?"Score: "+score:""}</div>}
       {isTeacher&&<button className="gc-close-activity" onClick={()=>{setInteractive(false);setActivity(null);setReward("");broadcast({interactive:false,activity:null,reward:""});}}>Close Activity</button>}
     </div></div>}

     <div className="gc-stage-hint">Drag the teacher and student video windows to reposition them during role-play.</div>
    </div>

    <div className="gc-tools">
      <button onClick={()=>setShowGames(true)}>🎮 Games</button>
      <button className={interactive?"active":""} disabled={!isTeacher} onClick={()=>{const n=!interactive;setInteractive(n);broadcast({interactive:n});}}>🎯 {interactive?"Interactive ON":"Interactive OFF"}</button>
      <button onClick={()=>setShowLayout(true)}>🎭 Move Cameras</button>
      <button onClick={()=>{if(material){alert("Material selected: "+(material.title||"Lesson material"));}}}>📚 Materials</button>
      <span className="tool-spacer"></span>
      <button onClick={()=>setMaterialIndex(v=>Math.max(0,v-1))}>‹</button>
      <span className="page-count">Page {materialIndex+1}</span>
      <button onClick={()=>setMaterialIndex(v=>Math.min(Math.max(materials.length-1,0),v+1))}>›</button>
      <button onClick={()=>setShowGames(true)}>✨ Activities</button>
    </div>
   </section>

   <aside className="gc-right">
    <div className="gc-right-head"><strong>Classroom Controls</strong><span>1-to-1 interactive teaching</span></div>
    <div className="gc-panel"><h3>Student Interaction</h3><div className="gc-control-row"><button className={interactive?"active":""} disabled={!isTeacher} onClick={()=>{const n=!interactive;setInteractive(n);broadcast({interactive:n});}}>{interactive?"🟢 ON":"⚪ OFF"}</button><button onClick={()=>setShowGames(true)}>🎮 Games</button></div></div>
    <div className="gc-panel"><h3>Lesson</h3><strong>{lesson.topic||"English Lesson"}</strong><p>{lesson.student_name} • {lesson.student_level||"English"}{lesson.student_age?" • Age "+lesson.student_age:""}</p></div>
    <div className="gc-chat"><div className="gc-chat-list">{chat.length===0?<div className="empty-chat">Class chat is ready.</div>:chat.map((m,i)=><div className="gc-msg" key={i}><strong>{m.name}</strong>{m.text}</div>)}</div><div className="gc-chat-input"><input value={chatText} onChange={e=>setChatText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendChat();}} placeholder="Message…"/><button onClick={sendChat}>Send</button></div></div>
   </aside>
  </div>

  {showGames&&<div className="gc-modal-backdrop" onClick={()=>setShowGames(false)}><div className="gc-modal" onClick={e=>e.stopPropagation()}><div className="gc-modal-head"><h2>Interactive Activities</h2><button onClick={()=>setShowGames(false)}>Close</button></div><p>Students can click and participate only when Interactive Mode is ON.</p><div className="gc-modal-grid">{activities.map(a=><button key={a.kind} disabled={!isTeacher} onClick={()=>chooseActivity(a)}><strong>{a.title}</strong><span>{a.prompt}</span></button>)}</div></div></div>}

  {showLayout&&<div className="gc-modal-backdrop" onClick={()=>setShowLayout(false)}><div className="gc-modal" onClick={e=>e.stopPropagation()}><div className="gc-modal-head"><h2>Role-play Camera Layout</h2><button onClick={()=>setShowLayout(false)}>Close</button></div><p>Choose a preset or drag either video window on the stage. Teachers can arrange both windows.</p><div className="gc-layout-buttons"><button onClick={()=>layout("normal")}>Normal Corners</button><button onClick={()=>layout("roleplay")}>Role Play</button><button onClick={()=>layout("side")}>Side by Side</button></div></div></div>}
 </main>;
}
