"use client";
import{useEffect}from"react";
export default function GlobalError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error("Global client error:",error)},[error]);
 return <main className="main"><div className="card" style={{maxWidth:620,margin:"60px auto",textAlign:"center"}}><h2>Something went wrong</h2><p className="muted">The page could not load correctly. Your account is still signed in.</p><div style={{display:"flex",gap:8,justifyContent:"center",marginTop:16}}><button type="button" onClick={()=>reset()}>Try Again</button><button type="button" className="primary" onClick={()=>window.location.replace("/dashboard")}>Back to Dashboard</button></div></div></main>
}
