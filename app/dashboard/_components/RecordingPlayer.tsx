"use client";
import {useState} from "react";

export default function RecordingPlayer({src,title="Class Recording"}:{src:string;title?:string}){
 const [error,setError]=useState("");
 const [key,setKey]=useState(0);
 if(!src)return <div role="status" style={{padding:18,color:"#64748b"}}>No recording file is available.</div>;
 return <div style={{width:"100%"}}>
  <video key={key} controls playsInline preload="metadata" onError={()=>setError("This recording could not be decoded by the browser. The saved video may be incomplete or in an unsupported format.")} onLoadedMetadata={()=>setError("")} style={{display:"block",width:"100%",maxHeight:"70vh",marginTop:12,borderRadius:10,background:"#111827"}} src={src}>
   Your browser cannot play this recording.
  </video>
  {error&&<div role="alert" style={{marginTop:10,padding:12,border:"1px solid #fecaca",borderRadius:8,background:"#fef2f2",color:"#991b1b",fontSize:13}}>
   <strong>Unable to play recording</strong><div style={{marginTop:4}}>{error}</div>
   <button type="button" style={{marginTop:8}} onClick={()=>{setError("");setKey(k=>k+1)}}>Try again</button>
  </div>}
 </div>;
}
