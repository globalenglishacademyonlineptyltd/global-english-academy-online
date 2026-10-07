"use client";

import { useEffect } from "react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Dashboard client error:", error); }, [error]);
  return <main className="main"><div className="card" style={{maxWidth:620,margin:"60px auto",textAlign:"center"}}><h2>Something went wrong</h2><p className="muted">The dashboard could not load this section correctly.</p><div style={{display:"flex",gap:8,justifyContent:"center",marginTop:16}}><button type="button" onClick={()=>reset()}>Try Again</button><button type="button" className="primary" onClick={()=>location.href="/dashboard"}>Back to Dashboard</button></div></div></main>;
}