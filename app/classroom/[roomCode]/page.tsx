"use client";

import {useEffect,useRef,useState} from "react";
import {useParams,useRouter} from "next/navigation";

const GAMES=[
 {id:"pick",title:"Picture Pick",prompt:"Click the correct animal.",items:["🐶 Dog","🐱 Cat","🐟 Fish","🦁 Lion"],answer:"🐶 Dog"},
 {id:"sort",title:"Sort It",prompt:"Sort the animals into the correct group.",items:["🐶 Dog","🐱 Cat","🐟 Fish","🦈 Shark"],answer:"Land / Water"},
 {id:"match",title:"Match It",prompt:"Match each word to its picture.",items:["SUN","☀️","APPLE","🍎"],answer:"Match"},
 {id:"order",title:"Put in Order",prompt:"Put the story in the correct order.",items:["Wake up","Eat breakfast","Go to school","Go home"],answer:"Order"}
];

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export default function Classroom(){
 const params:any=useParams();
 const router=useRouter();
 const roomCode=String(params?.roomCode||"");
 const [me,setMe]=useState<any>(null);
 const [lesson,setLesson]=useState<any>(null);
 const [branding,setBranding]=useState<any>(null);
 const [materials,setMaterials]=useState<any[]>([]);
 const [materialIndex,setMaterialIndex]=useState(0);
 const [interactive,setInteractive]=useState(false);
 const [game,setGame]=useState<any>(null);
 const [score,setScore]=useState(0);
 const [reward,setReward]=useState("");
 const [connected,setConnected]=useState(false);
 const [muted,setMuted]=useState(false);
 const [camera,setCamera]=useState(true);
 const [recording,setRecording]=useState(false);
 const [recordTime,setRecordTime]=useState(0);
 const [chat,setChat]=useState<any[]>([]);
 const [chatText,setChatText]=useState("");
 const [showGames,setShowGames]=useState(false);
 const [showLayout,setShowLayout]=useState(false);
 const [positions,setPositions]=useState<any>({teacher:{x:2,y:2,w:24},student:{x:74,y:2,w:24}});
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [ending,setEnding]=useState(false);

 const localVideo=useRef<HTMLVideoElement|null>(null);
 const remoteVideo=useRef<HTMLVideoElement|null>(null);
 const localStream=useRef<MediaStream|null>(null);
 const remoteStream=useRef<MediaStream|null>(null);
 const peer=useRef<RTCPeerConnection|null>(null);
 const after=useRef("1970-01-01T00:00:00.000Z");
 const seen=useRef<Set<string>>(new Set());
 const poller=useRef<any>(null);
 const recorder=useRef<MediaRecorder|null>(null);
 const recordChunks=useRef<Blob[]>([]);
 const recordStarted=useRef<number>(0);

 const teacher=me?.role==="TEACHER";
 const student=me?.role==="STUDENT";

 const signal=async(payload:any)=>{
   try{await fetch("/api/classroom-signals",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({roomCode,payload})});}catch{}
 };

 const broadcast=(extra:any={})=>{
   if(!teacher)return;
   signal({type:"state",interactive,game,score,reward,positions,...extra});
 };

 const createPeer=()=>{
   if(peer.current)return peer.current;
   const p=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]});
   peer.current=p;
   if(localStream.current)localStream.current.getTracks().forEach(t=>p.addTrack(t,localStream.current as MediaStream));
   p.onicecandidate=(e)=>{if(e.candidate)signal({type:"ice",candidate:e.candidate});};
   p.ontrack=(e)=>{
     if(!remoteStream.current)remoteStream.current=new MediaStream();
     if(!remoteStream.current.getTracks().some(t=>t.id===e.track.id))remoteStream.current.addTrack(e.track);
     if(remoteVideo.current)remoteVideo.current.srcObject=remoteStream.current;
   };
   p.onconnectionstatechange=()=>setConnected(p.connectionState==="connected");
   return p;
 };

 const offer=async()=>{
   if(!teacher)return;
   const p=createPeer();
   try{const o=await p.createOffer();await p.setLocalDescription(o);await signal({type:"offer",description:p.localDescription});}catch{}
 };

 const handleSignal=async(s:any)=>{
   if(seen.current.has(s.id))return;
   seen.current.add(s.id);
   const x=s.payload||{};
   if(x.type==="hello"){if(teacher)offer();return;}
   if(x.type==="state"&&student){
     setInteractive(!!x.interactive);setGame(x.game||null);setScore(Number(x.score)||0);setReward(x.reward||"");if(x.positions)setPositions(x.positions);return;
   }
   if(x.type==="chat"){setChat((v)=>v.concat([{name:x.name||"Classroom",text:x.text||""}]).slice(-80));return;}
   const p=createPeer();
   try{
     if(x.type==="offer"&&student){await p.setRemoteDescription(x.description);const a=await p.createAnswer();await p.setLocalDescription(a);await signal({type:"answer",description:p.localDescription});}
     if(x.type==="answer"&&teacher)await p.setRemoteDescription(x.description);
     if(x.type==="ice"&&x.candidate)await p.addIceCandidate(x.candidate);
   }catch{}
 };

 const poll=async()=>{
   try{
     const r=await fetch("/api/classroom-signals?roomCode="+encodeURIComponent(roomCode)+"&after="+encodeURIComponent(after.current),{cache:"no-store"});
     if(!r.ok)return;
     const j=await r.json();
     for(const s of j.signals||[]){after.current=s.created_at;if(s.sender_id!==j.userId)await handleSignal(s);}
   }catch{}
 };

 useEffect(()=>{
   Promise.all([
     fetch("/api/me",{cache:"no-store"}).then(r=>r.json()),
     fetch("/api/branding",{cache:"no-store"}).then(r=>r.json()).catch(()=>null),
     fetch("/api/lessons",{cache:"no-store"}).then(r=>r.json())
   ]).then(([a,b,c])=>{
     if(!a.user){router.replace("/login");return;}
     const found=(c||[]).find((x:any)=>x.room_code===roomCode);
     if(!found){setError("This classroom could not be found.");return;}
     setMe(a.user);setBranding(b);setLesson(found);setLoading(false);
   }).catch(()=>setError("Unable to load the classroom."));
 },[roomCode,router]);

 useEffect(()=>{
   if(!lesson)return;
   fetch("/api/lesson-materials?lessonId="+encodeURIComponent(lesson.id),{cache:"no-store"}).then(r=>r.ok?r.json():[]).then(setMaterials).catch(()=>{});
 },[lesson]);

 useEffect(()=>{
   if(!lesson||!me)return;
   let live=true;
   navigator.mediaDevices.getUserMedia({video:true,audio:true}).then((s)=>{
     if(!live)return;
     localStream.current=s;
     if(localVideo.current)localVideo.current.srcObject=s;
     createPeer();
     signal({type:"hello"});
   }).catch(()=>setCamera(false));
   poll();
   poller.current=setInterval(poll,700);
   return()=>{live=false;if(poller.current)clearInterval(poller.current);localStream.current?.getTracks().forEach(t=>t.stop());if(peer.current)peer.current.close();peer.current=null;};
 },[lesson,me]);

 useEffect(()=>{
   if(!teacher||!lesson)return;
   const t=setInterval(()=>broadcast(),2000);
   return()=>clearInterval(t);
 });

 useEffect(()=>{
   if(!recording)return;
   const t=setInterval(()=>setRecordTime(Math.floor((Date.now()-recordStarted.current)/1000)),1000);
   return()=>clearInterval(t);
 },[recording]);

 const startRecording=()=>{
   if(recording||!lesson)return;
   try{
     const canvas=document.createElement("canvas");canvas.width=1280;canvas.height=720;
     const ctx=canvas.getContext("2d");if(!ctx)return;
     const draw=()=>{
       if(!recordStarted.current)return;
       ctx.fillStyle="#f4f7fb";ctx.fillRect(0,0,1280,720);
       ctx.fillStyle="#fff";ctx.fillRect(24,24,1232,672);
       ctx.fillStyle="#172033";ctx.font="bold 28px Arial";ctx.fillText(branding?.school_name||"Global English Academy",48,62);
       ctx.font="bold 34px Arial";ctx.fillText(game?.title||lesson.topic||"English Lesson",55,130);
       ctx.font="22px Arial";ctx.fillText(game?.prompt||"Interactive one-to-one English class",55,172);
       if(localVideo.current&&localVideo.current.readyState>=2)ctx.drawImage(localVideo.current,930,90,270,170);
       if(remoteVideo.current&&remoteVideo.current.readyState>=2)ctx.drawImage(remoteVideo.current,930,275,270,170);
       requestAnimationFrame(draw);
     };
     const stream=canvas.captureStream(10);
     if(localStream.current?.getAudioTracks()[0])stream.addTrack(localStream.current.getAudioTracks()[0]);
     const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")?"video/webm;codecs=vp9,opus":"video/webm";
     const mr=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:800000});
     recordChunks.current=[];
     mr.ondataavailable=(e)=>{if(e.data.size)recordChunks.current.push(e.data);};
     mr.onstop=()=>{
       stream.getTracks().forEach(t=>t.stop());
       const reader=new FileReader();
       reader.onloadend=()=>{fetch("/api/recordings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lessonId:lesson.id,roomCode,durationSeconds:recordTime,mimeType:mime,data:reader.result})}).catch(()=>{});};
       reader.readAsDataURL(new Blob(recordChunks.current,{type:mime}));
     };
     recorder.current=mr;recordStarted.current=Date.now();setRecordTime(0);setRecording(true);mr.start(1000);draw();
   }catch{alert("Recording could not be started in this browser.");}
 };

 const stopRecording=()=>{if(recorder.current)recorder.current.stop();recorder.current=null;recordStarted.current=0;setRecording(false);};

 const endClass=async()=>{
   if(ending)return;
   setEnding(true);if(recording)stopRecording();
   try{await fetch("/api/classroom-complete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lessonId:lesson?.id})});}catch{}
   router.replace("/dashboard");
 };

 const startGame=(g:any)=>{
   if(!teacher)return;
   setGame(g);setInteractive(true);setScore(0);setReward("");setShowGames(false);
   broadcast({game:g,interactive:true,score:0,reward:""});
 };

 const studentAnswer=(item:string)=>{
   if(!student||!interactive||!game)return;
   const correct=game.id==="pick"&&item===game.answer;
   const next=correct?score+1:score;
   setScore(next);setReward(correct?"⭐ Great job!":"Try again!");
   signal({type:"state",interactive,game,score:next,reward:correct?"⭐ Great job!":"Try again!",positions});
 };

 const sendChat=()=>{
   const text=chatText.trim();if(!text)return;
   const name=me?.name||"User";
   setChat((v)=>v.concat([{name,text}]).slice(-80));signal({type:"chat",name,text});setChatText("");
 };

 const moveVideo=(who:"teacher"|"student",e:any)=>{
   if(!teacher&&((who==="teacher"&&!teacher)||(who==="student"&&!student)))return;
   const parent=e.currentTarget.parentElement.getBoundingClientRect();
   const box=e.currentTarget.getBoundingClientRect();
   const dx=e.clientX-box.left,dy=e.clientY-box.top;
   const move=(ev:any)=>{
     const x=clamp(((ev.clientX-parent.left-dx)/parent.width)*100,0,100-positions[who].w);
     const y=clamp(((ev.clientY-parent.top-dy)/parent.height)*100,0,85);
     setPositions((v:any)=>({...v,[who]:{...v[who],x,y}}));
   };
   const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);if(teacher)broadcast();};
   window.addEventListener("pointermove",move);window.addEventListener("pointerup",up,{once:true});
 };

 const setLayout=(mode:string)=>{
   const p=mode==="roleplay"?{teacher:{x:4,y:62,w:27},student:{x:69,y:62,w:27}}:mode==="side"?{teacher:{x:3,y:3,w:21},student:{x:27,y:3,w:21}}:{teacher:{x:2,y:2,w:24},student:{x:74,y:2,w:24}};
   setPositions(p);if(teacher)broadcast({positions:p});setShowLayout(false);
 };

 if(loading)return <main className="classroom-loading">Loading classroom…</main>;
 if(error)return <main className="classroom-error"><div><h2>{error}</h2><button onClick={()=>router.replace("/dashboard")}>Back to Dashboard</button></div></main>;

 const material=materials[materialIndex];
 const source=material?.content_data||material?.url||"";
 const time=String(Math.floor(recordTime/60)).padStart(2,"0")+":"+String(recordTime%60).padStart(2,"0");

 return <main className="gea-classroom">
  <header className="gc-top">
   <div className="gc-brand">{branding?.logo_data?<img src={branding.logo_data} alt={branding.school_name}/>:<span className="gc-brand-icon">🎓</span>}<div><strong>{branding?.school_name||"Global English Academy"}</strong><small>{lesson.class_id||"Live Classroom"} • {lesson.student_name}</small></div></div>
   <div className="gc-status"><span className={connected?"gc-dot live":"gc-dot"}></span>{connected?"Connected":"Waiting for partner…"}</div>
   <div className="gc-actions">
    <button className={muted?"active":""} onClick={()=>{const n=!muted;localStream.current?.getAudioTracks().forEach(t=>t.enabled=!n);setMuted(n);}}>🎙 {muted?"Unmute":"Mute"}</button>
    <button className={!camera?"active":""} onClick={()=>{const n=!camera;localStream.current?.getVideoTracks().forEach(t=>t.enabled=n);setCamera(n);}}>📷 Camera</button>
    <button className={recording?"active":""} onClick={recording?stopRecording:startRecording}>⏺ {recording?"Stop "+time:"Record"}</button>
    <button onClick={()=>setShowGames(true)}>🎮 Games</button>
    <button onClick={()=>setShowLayout(true)}>🎭 Role Play</button>
    <button className="danger" onClick={endClass}>{ending?"Ending…":"End Class"}</button>
   </div>
  </header>

  <div className="gc-body">
   <section className="gc-main">
    <div className="gc-stage">
     <div className="gc-lessonbar"><strong>{lesson.topic||"English Lesson"}</strong><span>{interactive?"🟢 Interactive Mode ON":"Teaching Mode"} {recording?" • 🔴 Recording":""}</span></div>
     <div className="gc-material">
      {source&&/^data:image\//.test(source)?<img src={source} alt="Lesson material"/>:source&&/\.pdf($|\?)/i.test(source)?<iframe src={source} title="Lesson material"/>:<div className="gc-placeholder"><div>📚</div><h2>{lesson.topic||"Let's learn English!"}</h2><p>{material?.title||"Choose an interactive game or open your assigned lesson material."}</p></div>}
     </div>
     <div className="gc-video" style={{left:positions.teacher.x+"%",top:(positions.teacher.y+5)+"%",width:positions.teacher.w+"%"}} onPointerDown={(e)=>moveVideo("teacher",e)}>
       <video ref={teacher?localVideo:remoteVideo} autoPlay playsInline muted={teacher}/>
       <div className="gc-video-label">👩‍🏫 {lesson.teacher_name}</div>
     </div>
     <div className="gc-video" style={{left:positions.student.x+"%",top:(positions.student.y+5)+"%",width:positions.student.w+"%"}} onPointerDown={(e)=>moveVideo("student",e)}>
       <video ref={teacher?remoteVideo:localVideo} autoPlay playsInline muted={student}/>
       <div className="gc-video-label">🧒 {lesson.student_name}</div>
     </div>
     {game&&interactive&&<div className="gc-game-overlay"><div className="gc-game-card"><h2>{game.title}</h2><p>{game.prompt}</p><div className="gc-game-grid">{game.items.map((x:string)=><button className="gc-game-item" key={x} disabled={!student} onClick={()=>studentAnswer(x)}>{x}</button>)}</div>{reward&&<div className="gc-reward">{reward} {score>0?"Score: "+score:""}</div>}{teacher&&<button className="gc-close-activity" onClick={()=>{setInteractive(false);setGame(null);setReward("");broadcast({interactive:false,game:null,reward:""});}}>Close Activity</button>}</div></div>}
     <div className="gc-stage-hint">Drag teacher/student cameras to reposition them during role-play.</div>
    </div>
    <div className="gc-tools">
      <button onClick={()=>setShowGames(true)}>🎮 Games</button>
      <button className={interactive?"active":""} disabled={!teacher} onClick={()=>{const n=!interactive;setInteractive(n);broadcast({interactive:n});}}>🎯 {interactive?"Interactive ON":"Interactive OFF"}</button>
      <button onClick={()=>setShowLayout(true)}>🎭 Move Cameras</button>
      <button onClick={()=>{if(material)alert("Assigned material: "+material.title);}}>📚 Materials</button>
      <span className="tool-spacer"></span><button onClick={()=>setMaterialIndex(v=>Math.max(0,v-1))}>‹</button><span className="page-count">Page {materialIndex+1}</span><button onClick={()=>setMaterialIndex(v=>Math.min(Math.max(materials.length-1,0),v+1))}>›</button>
    </div>
   </section>

   <aside className="gc-right">
    <div className="gc-right-head"><strong>Classroom Controls</strong><span>1-to-1 interactive teaching</span></div>
    <div className="gc-panel"><h3>Student Interaction</h3><div className="gc-control-row"><button className={interactive?"active":""} disabled={!teacher} onClick={()=>{const n=!interactive;setInteractive(n);broadcast({interactive:n});}}>{interactive?"🟢 ON":"⚪ OFF"}</button><button onClick={()=>setShowGames(true)}>🎮 Games</button></div></div>
    <div className="gc-panel"><h3>Lesson</h3><strong>{lesson.topic||"English Lesson"}</strong><p>{lesson.student_name} • {lesson.student_level||"English"}{lesson.student_age?" • Age "+lesson.student_age:""}</p></div>
    <div className="gc-chat"><div className="gc-chat-list">{chat.length===0?<div className="empty-chat">Class chat is ready.</div>:chat.map((m,i)=><div className="gc-msg" key={i}><strong>{m.name}</strong>{m.text}</div>)}</div><div className="gc-chat-input"><input value={chatText} onChange={e=>setChatText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendChat();}} placeholder="Message…"/><button onClick={sendChat}>Send</button></div></div>
   </aside>
  </div>

  {showGames&&<div className="gc-modal-backdrop" onClick={()=>setShowGames(false)}><div className="gc-modal" onClick={e=>e.stopPropagation()}><div className="gc-modal-head"><h2>Interactive Activities</h2><button onClick={()=>setShowGames(false)}>Close</button></div><p>Students can click and participate only when Interactive Mode is ON.</p><div className="gc-modal-grid">{GAMES.map(g=><button key={g.id} disabled={!teacher} onClick={()=>startGame(g)}><strong>{g.title}</strong><span>{g.prompt}</span></button>)}</div></div></div>}

  {showLayout&&<div className="gc-modal-backdrop" onClick={()=>setShowLayout(false)}><div className="gc-modal" onClick={e=>e.stopPropagation()}><div className="gc-modal-head"><h2>Role-play Camera Layout</h2><button onClick={()=>setShowLayout(false)}>Close</button></div><p>Use a preset or drag the camera windows directly on the lesson stage.</p><div className="gc-layout-buttons"><button onClick={()=>setLayout("normal")}>Normal Corners</button><button onClick={()=>setLayout("roleplay")}>Role Play</button><button onClick={()=>setLayout("side")}>Side by Side</button></div></div></div>}
 </main>;
}
