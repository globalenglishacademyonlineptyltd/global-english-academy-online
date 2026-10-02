"use client";import{useEffect,useState}from"react";import{usePathname}from"next/navigation";

export default function Materials(){
 const[rows,setRows]=useState<any[]>([]),[role,setRole]=useState(""),[title,setTitle]=useState(""),[description,setDescription]=useState(""),[url,setUrl]=useState(""),[level,setLevel]=useState(""),[file,setFile]=useState<File|null>(null),[message,setMessage]=useState("");
 async function load(){const me=await fetch("/api/me").then(r=>r.json());setRole(me.user?.role||"");const x=await fetch("/api/materials");if(x.ok)setRows(await x.json())}
 useEffect(()=>{load()},[]);
 async function add(){
  setMessage("Saving…");
  let contentData="",mimeType="";
  if(file){if(file.size>9*1024*1024){setMessage("Please choose a file smaller than 9 MB.");return}contentData=await new Promise<string>((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result));fr.onerror=reject;fr.readAsDataURL(file)});mimeType=file.type}
  const x=await fetch("/api/materials",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title,description,url,level,contentData,mimeType})});
  const j=await x.json();if(x.ok){setTitle("");setDescription("");setUrl("");setLevel("");setFile(null);setMessage("Material saved.");load()}else setMessage(j.error||"Could not save material.")
 }
 return <main className="main"><h1>Lesson Materials</h1><p className="muted">School-approved materials are shared here. Admin can upload PDFs directly; teachers and students can open approved files.</p>
 {role==="ADMIN"&&<div className="card"><input className="input" placeholder="Title" value={title} onChange={e=>setTitle(e.target.value)}/><input className="input" placeholder="Level (e.g. Beginner)" value={level} onChange={e=>setLevel(e.target.value)}/><input className="input" placeholder="Unit / lesson description" value={description} onChange={e=>setDescription(e.target.value)}/><label className="input">Upload PDF/lesson file <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><input className="input" placeholder="Optional external URL" value={url} onChange={e=>setUrl(e.target.value)}/><button className="primary" onClick={add}>Upload material</button>{message&&<div className="muted">{message}</div>}</div>}
 <div className="section">{rows.map(r=><div className="card" key={r.id} style={{marginBottom:12}}><h3>{r.title}</h3><p>{r.description}</p><div className="muted">{r.level||"Uncategorised"}</div>{r.content_data?<a href={r.content_data} target="_blank" rel="noreferrer">Open uploaded file →</a>:r.url?<a href={r.url} target="_blank" rel="noreferrer">Open material →</a>:<span className="muted">No file attached</span>}</div>)}</div></main>
}