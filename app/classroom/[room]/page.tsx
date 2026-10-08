"use client";

import {useEffect,useRef,useState} from "react";
import {useParams,useRouter} from "next/navigation";
import PdfViewer from "@/app/components/PdfViewer";

const GAMES=[
 {id:"pick",title:"Picture Pick",prompt:"Click the correct animal.",items:["🐶 Dog","🐱 Cat","🐟 Fish","🦁 Lion"],answer:"🐶 Dog"},
 {id:"sort",title:"Sort It",prompt:"Sort the animals into the correct group.",items:["🐶 Dog","🐱 Cat","🐟 Fish","🦈 Shark"],answer:"Land / Water"},
 {id:"match",title:"Match It",prompt:"Match each word to its picture.",items:["SUN","☀️","APPLE","🍎"],answer:"Match"},
 {id:"order",title:"Put in Order",prompt:"Put the story in the correct order.",items:["Wake up","Eat breakfast","Go to school","Go home"],answer:"Order"}
];
const ICONS:any={donut:"🍩",star:"⭐",lollipop:"🍭"};

export default function Classroom(){
 const params:any=useParams();
 const router=useRouter();
 const room=String(params?.room||"");
 const [me,setMe]=useState<any>(null),[lesson,setLesson]=useState<any>(null),[branding,setBranding]=useState<any>(null);
 const [materials,setMaterials]=useState<any[]>([]),[rewards,setRewards]=useState<any[]>([]);
 const [interactive,setInteractive]=useState(false),[game,setGame]=useState<any>(null),[score,setScore]=useState(0),[reward,setReward]=useState(""),[sortDrag,setSortDrag]=useState(""),[orderPick,setOrderPick]=useState<string[]>([]);
 const [connected,setConnected]=useState(false),[muted,setMuted]=useState(false),[camera,setCamera]=useState(true),[recording,setRecording]=useState(false),[recordTime,setRecordTime]=useState(0);
 const [showGames,setShowGames]=useState(false),[showLayout,setShowLayout]=useState(false),[openMaterial,setOpenMaterial]=useState<any>(null),[positions,setPositions]=useState<any>({teacher:{x:2,y:2,w:24},student:{x:74,y:2,w:24}});
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[status,setStatus]=useState("Starting classroom…"),[ending,setEnding]=useState(false);

 const localVideo=useRef<HTMLVideoElement|null>(null),remoteVideo=useRef<HTMLVideoElement|null>(null),localStream=useRef<MediaStream|null>(null),remoteStream=useRef<MediaStream|null>(null),peer=useRef<RTCPeerConnection|null>(null),after=useRef("1970-01-01T00:00:00.000Z"),seen=useRef<Set<string>>(new Set()),poller=useRef<any>(null),recorder=useRef<MediaRecorder|null>(null),recordChunks=useRef<Blob[]>([]),recordStarted=useRef<number>(0),canvas=useRef<HTMLCanvasElement|null>(null);

 const teacher=me?.role==="TEACHER",student=me?.role==="STUDENT";

 const signal=async(payload:any)=>{try{await fetch("/api/classroom-signals",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({roomCode:room,payload})});}catch{}};
 const broadcast=(extra:any={})=>{if(teacher)signal({type:"state",interactive,game,score,reward,positions,...extra});};

 const createPeer=()=>{
   if(peer.current)return peer.current;
   const p=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]});
   peer.current=p;
   if(localStream.current)localStream.current.getTracks().forEach(t=>p.addTrack(t,localStream.current as MediaStream));
   p.onicecandidate=e=>{if(e.candidate)signal({type:"ice",candidate:e.candidate});};
   p.ontrack=e=>{if(!remoteStream.current)remoteStream.current=new MediaStream();if(!remoteStream.current.getTracks().some(t=>t.id===e.track.id))remoteStream.current.addTrack(e.track);if(remoteVideo.current)remoteVideo.current.srcObject=remoteStream.current;};
   p.onconnectionstatechange=()=>{setConnected(p.connectionState==="connected");setStatus(p.connectionState==="connected"?"Connected":"Waiting for partner…");};
   return p;
 };

 const sendOffer=async()=>{if(!teacher)return;const p=createPeer();try{const o=await p.createOffer();await p.setLocalDescription(o);await signal({type:"offer",description:p.localDescription});}catch{}};

 const handleSignal=async(s:any)=>{
   if(seen.current.has(s.id))return;seen.current.add(s.id);const x=s.payload||{};
   if(x.type==="hello"){if(teacher)sendOffer();return;}
   if(x.type==="state"&&student){setInteractive(!!x.interactive);setGame(x.game||null);setScore(Number(x.score)||0);setReward(x.reward||"");if(x.positions)setPositions(x.positions);return;}
   if(x.type==="chat"){setChat(v=>v.concat([{name:x.name||"Classroom",text:x.text||""}]).slice(-80));return;}
   const p=createPeer();
   try{
     if(x.type==="offer"&&(student||me?.role==="ADMIN")){await p.setRemoteDescription(x.description);const a=await p.createAnswer();await p.setLocalDescription(a);await signal({type:"answer",description:p.localDescription});}
     else if(x.type==="answer"&&teacher)await p.setRemoteDescription(x.description);
     else if(x.type==="ice"&&x.candidate)await p.addIceCandidate(x.candidate);
   }catch{}
 };

 const poll=async()=>{
   try{
     const r=await fetch("/api/classroom-signals?roomCode="+encodeURIComponent(room)+"&after="+encodeURIComponent(after.current),{cache:"no-store"});
     if(!r.ok)return;
     const j=await r.json();
     for(const s of j.signals||[]){after.current=s.created_at;if(s.sender_id!==j.userId)await handleSignal(s);}
   }catch{}
 };

 useEffect(()=>{
   let alive=true;
   async function start(){
     try{
       const meRes=await fetch("/api/me").then(x=>x.json());if(!meRes.user){router.replace("/login");return;}
       setMe(meRes.user);
       const lessons=await fetch("/api/lessons",{cache:"no-store"}).then(x=>x.ok?x.json():[]);
       const found=(lessons||[]).find((x:any)=>x.room_code===room);
       if(!found){setError("Lesson not found.");setLoading(false);return;}
       if(meRes.user.role!=="ADMIN"&&Date.now()<new Date(found.starts_at).getTime()-600000){setError("The classroom opens 10 minutes before the lesson.");setLoading(false);return;}
       if(meRes.user.role==="TEACHER"){
         const gate=await fetch("/api/classroom/access?room="+encodeURIComponent(room),{cache:"no-store"});
         if(!gate.ok){const g=await gate.json().catch(()=>({}));setError(g.error||"Please complete the previous teaching report before entering.");setLoading(false);return;}
       }
       setLesson(found);
       const b=await fetch("/api/branding",{cache:"no-store"}).then(x=>x.ok?x.json():null).catch(()=>null);setBranding(b);
       if(meRes.user.role==="TEACHER"||meRes.user.role==="ADMIN"){const mm=await fetch("/api/lesson-materials?lessonId="+encodeURIComponent(found.id),{cache:"no-store"});if(mm.ok){const assigned=await mm.json();setMaterials(assigned);if(meRes.user.role==="TEACHER"&&assigned?.[0])setOpenMaterial(assigned[0]);}}
       const rr=await fetch("/api/rewards?lessonId="+encodeURIComponent(found.id),{cache:"no-store"});if(rr.ok)setRewards(await rr.json());
       if(meRes.user.role==="ADMIN"){setLesson(found);setStatus("Admin monitoring mode — camera and microphone are off");setLoading(false);signal({type:"hello"});return;}const stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});if(!alive)return;
       localStream.current=stream;if(localVideo.current)localVideo.current.srcObject=stream;
       createPeer();setStatus("Connected — classroom ready");signal({type:"hello"});setLoading(false);
       setTimeout(()=>startRecording(),400);
     }catch{setStatus("Camera and microphone permission required");setLoading(false);}
   }
   start();poll();poller.current=setInterval(poll,700);
   return()=>{alive=false;if(poller.current)clearInterval(poller.current);recorder.current?.stop();localStream.current?.getTracks().forEach(t=>t.stop());peer.current?.close();peer.current=null;};
 },[room,router]);


 useEffect(()=>{if(!lesson||!me||me.role==="ADMIN")return;const beat=()=>signal({type:"presence"});beat();const id=setInterval(beat,15000);return()=>clearInterval(id)},[lesson,me]);
 useEffect(()=>{if(!lesson||me?.role!=="TEACHER")return;const ms=new Date(lesson.ends_at).getTime()-Date.now();if(ms<=0)return;const id=setTimeout(()=>{fetch("/api/classroom-complete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lessonId:lesson.id})}).catch(()=>{})},ms+1000);return()=>clearTimeout(id)},[lesson,me]);
 useEffect(()=>{if(!recording)return;const t=setInterval(()=>{if(recordStarted.current)setRecordTime(Math.floor((Date.now()-recordStarted.current)/1000));},1000);return()=>clearInterval(t);},[recording]);

 const startRecording=()=>{
   if(recording||!lesson)return;
   try{
     if(!canvas.current)canvas.current=document.createElement("canvas");
     const c=canvas.current,ctx=c.getContext("2d");if(!ctx)return;c.width=1280;c.height=720;
     const draw=()=>{if(!recordStarted.current)return;ctx.fillStyle="#f4f7fb";ctx.fillRect(0,0,1280,720);ctx.fillStyle="#fff";ctx.fillRect(24,24,1232,672);ctx.fillStyle="#172033";ctx.font="bold 28px Arial";ctx.fillText(branding?.school_name||"Global English Academy",48,62);ctx.font="bold 34px Arial";ctx.fillText(game?.title||lesson.topic||"English Lesson",55,130);ctx.font="22px Arial";ctx.fillText(game?.prompt||"Live interactive English class",55,172);if(localVideo.current&&localVideo.current.readyState>=2)ctx.drawImage(localVideo.current,930,90,270,170);if(remoteVideo.current&&remoteVideo.current.readyState>=2)ctx.drawImage(remoteVideo.current,930,275,270,170);requestAnimationFrame(draw);};
     const stream=c.captureStream(10);if(localStream.current?.getAudioTracks()[0])stream.addTrack(localStream.current.getAudioTracks()[0]);
     const mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")?"video/webm;codecs=vp9,opus":"video/webm";
     const mr=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:800000});recordChunks.current=[];recordStarted.current=Date.now();
     mr.ondataavailable=e=>{if(e.data.size)recordChunks.current.push(e.data);};
     mr.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const reader=new FileReader();reader.onloadend=()=>{fetch("/api/recordings",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lessonId:lesson.id,roomCode:room,durationSeconds:recordTime,mimeType:mime,data:reader.result})}).then(r=>setStatus(r.ok?"Recording saved":"Recording could not be saved")).catch(()=>setStatus("Recording could not be saved"));};reader.readAsDataURL(new Blob(recordChunks.current,{type:mime}));};
     recorder.current=mr;setRecordTime(0);setRecording(true);mr.start(1000);draw();
   }catch{setStatus("Recording is not supported in this browser.");}
 };

 const stopRecording=()=>{if(recorder.current)recorder.current.stop();recorder.current=null;recordStarted.current=0;setRecording(false);};

 const endClass=async()=>{if(me?.role==="ADMIN")return;if(ending)return;setEnding(true);if(recording)stopRecording();try{await fetch("/api/classroom-complete",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lessonId:lesson?.id})});}catch{}router.replace("/dashboard");};

 const startGame=(g:any)=>{if(!teacher)return;setGame(g);setInteractive(true);setScore(0);setReward("");setSortDrag("");setOrderPick([]);setShowGames(false);broadcast({game:g,interactive:true,score:0,reward:""});};
 const answer=(item:string)=>{if(!student||!interactive||!game)return;let ok=false;if(game.id==="pick")ok=item===game.answer;if(game.id==="sort"){const parts=item.split("|");const land=parts[0].includes("Dog")||parts[0].includes("Cat");const water=parts[0].includes("Fish")||parts[0].includes("Shark");ok=(land&&parts[1]==="Land")||(water&&parts[1]==="Water");}if(game.id==="order"){const nextOrder=orderPick.concat([item]);setOrderPick(nextOrder);ok=nextOrder.join("|")===game.items.join("|");if(!ok&&nextOrder.length>=game.items.length){setOrderPick([]);setReward("Try the order again!");return;}}const next=ok?score+1:score;setScore(next);setReward(ok?"⭐ Great job!":"Try again!");signal({type:"state",interactive,game,score:next,reward:ok?"⭐ Great job!":"Try again!",positions});};
 const sendChat=()=>{const text=chatText.trim();if(!text)return;const name=me?.name||"User";setChat(v=>v.concat([{name,text}]).slice(-80));signal({type:"chat",name,text});setChatText("");};

 const moveVideo=(who:"teacher"|"student",e:any)=>{
   if(!teacher)return;
   const parent=e.currentTarget.parentElement.getBoundingClientRect(),box=e.currentTarget.getBoundingClientRect(),dx=e.clientX-box.left,dy=e.clientY-box.top;
   const move=(ev:any)=>{const x=clamp(((ev.clientX-parent.left-dx)/parent.width)*100,0,100-positions[who].w),y=clamp(((ev.clientY-parent.top-dy)/parent.height)*100,0,85);setPositions((v:any)=>({...v,[who]:{...v[who],x,y}}));};
   const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);if(teacher)broadcast();};
   window.addEventListener("pointermove",move);window.addEventListener("pointerup",up,{once:true});
 };
 const setLayout=(mode:string)=>{const p=mode==="roleplay"?{teacher:{x:4,y:62,w:27},student:{x:69,y:62,w:27}}:mode==="side"?{teacher:{x:3,y:3,w:21},student:{x:27,y:3,w:21}}:{teacher:{x:2,y:2,w:24},student:{x:74,y:2,w:24}};setPositions(p);if(teacher)broadcast({positions:p});setShowLayout(false);};
 const giveReward=async(type:string)=>{if(!lesson||rewards.length>=15)return;const r=await fetch("/api/rewards",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({lessonId:lesson.id,rewardType:type})});const j=await r.json();if(r.ok)setRewards(v=>v.concat([j]));};
 const time=String(Math.floor(recordTime/60)).padStart(2,"0")+":"+String(recordTime%60).padStart(2,"0");
 const material=materials[0];

 if(loading)return <main className="classroom-loading">Loading classroom…</main>;
 if(error)return <main className="classroom-error"><div><h2>{error}</h2><button onClick={()=>router.replace("/dashboard")}>Back to Dashboard</button></div></main>;

 return <main className="gea-classroom">
  <header className="gc-top">
   <div className="gc-brand">{branding?.logo_data?<img src={branding.logo_data} alt={branding.school_name}/>:<span className="gc-brand-icon">🎓</span>}<div><strong>{branding?.school_name||"Global English Academy"}</strong><small>{lesson.class_id||"Live Classroom"} • {lesson.student_name}</small></div></div>
   <div className="gc-status"><span className={connected?"gc-dot live":"gc-dot"}></span>{connected?"Connected":status}</div>
   <div className="gc-actions">
    {me?.role!=="ADMIN"&&<button className={muted?"active":""} onClick={()=>{const n=!muted;localStream.current?.getAudioTracks().forEach(t=>t.enabled=!n);setMuted(n);}}>🎙 {muted?"Unmute":"Mute"}</button>}
    {me?.role!=="ADMIN"&&<button className={!camera?"active":""} onClick={()=>{const n=!camera;localStream.current?.getVideoTracks().forEach(t=>t.enabled=n);setCamera(n);}}>📷 Camera</button>}
    {me?.role!=="ADMIN"&&<button className={recording?"active":""} onClick={recording?stopRecording:startRecording}>⏺ {recording?"Stop "+time:"Record"}</button>}
    <button disabled={!teacher} onClick={()=>setShowGames(true)}>🎮 Games</button><button disabled={!teacher} onClick={()=>setShowLayout(true)}>🎭 Role Play</button>{me?.role!=="ADMIN"&&<button className="danger" onClick={endClass}>{ending?"Ending…":"End Class"}</button>}
   </div>
  </header>

  <div className="gc-body">
   <section className="gc-main">
    <div className="gc-stage">
     <div className="gc-lessonbar"><strong>{lesson.topic||"English Lesson"}</strong><span>{interactive?"🟢 Interactive Mode ON":"Teaching Mode"} {recording?" • 🔴 Recording":""}</span></div>
     <div className="gc-material"><div className="gc-placeholder"><div>📚</div><h2>{lesson.topic||"Let's learn English!"}</h2><p>{teacher?(material?.title||"No workbook assigned to this class."):"Your teacher controls the lesson materials."}</p></div></div>
     <div className="gc-video" style={{left:positions.teacher.x+"%",top:(positions.teacher.y+5)+"%",width:positions.teacher.w+"%"}} onPointerDown={e=>moveVideo("teacher",e)}><video ref={teacher?localVideo:remoteVideo} autoPlay playsInline muted={teacher}/><div className="gc-video-label">👩‍🏫 {lesson.teacher_name}</div></div>
     <div className="gc-video" style={{left:positions.student.x+"%",top:(positions.student.y+5)+"%",width:positions.student.w+"%"}} onPointerDown={e=>moveVideo("student",e)}><video ref={teacher?remoteVideo:localVideo} autoPlay playsInline muted={student}/><div className="gc-video-label">🧒 {lesson.student_name}</div></div>
     {game&&interactive&&<div className="gc-game-overlay"><div className="gc-game-card"><h2>{game.title}</h2><p>{game.prompt}</p><div className="gc-game-grid">{game.id==="sort"?<><div className="gc-dragzone">{game.items.map((x:string)=><button className="gc-game-item" draggable={student} key={x} onDragStart={()=>setSortDrag(x)} onClick={()=>setSortDrag(x)}>{x}</button>)}</div><div className="gc-sort-targets"><div className="gc-sort-target" onDragOver={e=>e.preventDefault()} onDrop={()=>{if(sortDrag){answer(sortDrag+"|Land");setSortDrag("");}}}>LAND</div><div className="gc-sort-target" onDragOver={e=>e.preventDefault()} onDrop={()=>{if(sortDrag){answer(sortDrag+"|Water");setSortDrag("");}}}>WATER</div></div></>:game.id==="order"?<div className="gc-game-grid">{game.items.map((x:string)=><button className="gc-game-item" key={x} disabled={!student||orderPick.includes(x)} onClick={()=>answer(x)}>{x}</button>)}</div>:<div className="gc-game-grid">{game.items.map((x:string)=><button className="gc-game-item" key={x} disabled={!student} onClick={()=>answer(x)}>{x}</button>)}</div>}</div>{reward&&<div className="gc-reward">{reward} {score?"Score: "+score:""}</div>}{teacher&&<button className="gc-close-activity" onClick={()=>{setInteractive(false);setGame(null);setReward("");broadcast({interactive:false,game:null,reward:""});}}>Close Activity</button>}</div></div>}
     <div className="gc-stage-hint">Drag teacher/student cameras to reposition them during role-play.</div>
    </div>
    <div className="gc-tools"><button disabled={!teacher} onClick={()=>setShowGames(true)}>🎮 Games</button><button className={interactive?"active":""} disabled={!teacher} onClick={()=>{const n=!interactive;setInteractive(n);setReward("");broadcast({interactive:n});}}>🎯 {interactive?"Student Controls ON":"Student Controls OFF"}</button><button disabled={!teacher} onClick={()=>setShowLayout(true)}>🎭 Move Cameras</button><span className="tool-spacer"></span><button>‹</button><span className="page-count">Page 1</span><button>›</button></div>
   </section>

   <aside className="gc-right">
    <div className="gc-right-head"><strong>Classroom Controls</strong><span>51Talk-inspired 1-to-1 interactive teaching</span></div>
    <div className="gc-panel"><h3>Student Interaction</h3><div className="gc-control-row"><button className={interactive?"active":""} disabled={!teacher} onClick={()=>{const n=!interactive;setInteractive(n);setReward("");broadcast({interactive:n});}}>{interactive?"🟢 Student Controls ON":"⚪ Student Controls OFF"}</button><button onClick={()=>setShowGames(true)}>🎮 Games</button></div></div>
    <div className="gc-panel"><h3>Lesson</h3><strong>{lesson.topic||"English Lesson"}</strong><p>{lesson.student_name} • {lesson.student_level||"English"}{lesson.student_age?" • Age "+lesson.student_age:""}</p></div>
    {teacher&&<div className="gc-panel"><h3>Student Rewards</h3><div className="gc-control-row">{Object.entries(ICONS).map(([type,icon]:any)=><button key={type} disabled={rewards.length>=15} onClick={()=>giveReward(type)} style={{fontSize:18}}>{icon}</button>)}</div><p>{rewards.length}/15 rewards</p></div>}
    <div className="gc-chat-disabled"><strong>School-controlled classroom</strong><span>Teacher and student contact details and direct messaging are disabled. Communication is limited to the live lesson.</span></div>
   </aside>
  </div>

  {showGames&&<div className="gc-modal-backdrop" onClick={()=>setShowGames(false)}><div className="gc-modal" onClick={e=>e.stopPropagation()}><div className="gc-modal-head"><h2>Interactive Activities</h2><button onClick={()=>setShowGames(false)}>Close</button></div><p>Students can click and participate only when Interactive Mode is ON.</p><div className="gc-modal-grid">{GAMES.map(g=><button key={g.id} disabled={!teacher} onClick={()=>startGame(g)}><strong>{g.title}</strong><span>{g.prompt}</span></button>)}</div></div></div>}

  {showLayout&&<div className="gc-modal-backdrop" onClick={()=>setShowLayout(false)}><div className="gc-modal" onClick={e=>e.stopPropagation()}><div className="gc-modal-head"><h2>Role-play Camera Layout</h2><button onClick={()=>setShowLayout(false)}>Close</button></div><p>Use a preset or drag the camera windows directly on the lesson stage.</p><div className="gc-layout-buttons"><button onClick={()=>setLayout("normal")}>Normal Corners</button><button onClick={()=>setLayout("roleplay")}>Role Play</button><button onClick={()=>setLayout("side")}>Side by Side</button></div></div></div>}

  {teacher&&openMaterial&&<div className="gc-modal-backdrop" onContextMenu={e=>e.preventDefault()}><div className="gc-material-modal"><div className="gc-modal-head"><h2>📄 {openMaterial.title}</h2><button onClick={()=>setOpenMaterial(null)}>Close</button></div><div className="gc-material-frame"><PdfViewer src={"/api/lesson-materials/file?lessonId="+encodeURIComponent(lesson.id)+"&materialId="+encodeURIComponent(openMaterial.id)} title={openMaterial.title}/></div><p>View-only classroom material.</p></div></div>}
 </main>;
}
