
"use client";

import {useEffect,useRef,useState} from "react";

type Props={src:string;title?:string};

export default function PdfViewer({src,title="PDF material"}:Props){
 const host=useRef<HTMLDivElement|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(""),[pages,setPages]=useState(0),[page,setPage]=useState(1);
 useEffect(()=>{
   let cancelled=false;
   async function render(){
     try{
       setLoading(true);setError("");setPage(1);setPages(0);
       const pdfjs:any=await import("pdfjs-dist/legacy/build/pdf.mjs");
       pdfjs.GlobalWorkerOptions.workerSrc=new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs",import.meta.url).toString();
       const task=pdfjs.getDocument({url:src,withCredentials:true});
       const pdf=await task.promise;
       if(cancelled)return;
       setPages(pdf.numPages);
       if(host.current)host.current.innerHTML="";
       for(let n=1;n<=pdf.numPages;n++){
         if(cancelled)break;
         const p=await pdf.getPage(n);
         const base=p.getViewport({scale:1});
         const width=host.current?.clientWidth||760;
         const scale=Math.max(.55,Math.min(2,width/base.width));
         const viewport=p.getViewport({scale});
         const wrap=document.createElement("div");
         wrap.className="gea-pdf-page";
         wrap.dataset.page=String(n);
         const canvas=document.createElement("canvas");
         canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
         canvas.style.width="100%";canvas.style.height="auto";canvas.setAttribute("aria-label",title+" page "+n);
         wrap.appendChild(canvas);host.current?.appendChild(wrap);
         await p.render({canvasContext:canvas.getContext("2d"),viewport}).promise;
       }
       setLoading(false);
     }catch(e){if(!cancelled){setError("This material could not be displayed. Please try opening it again.");setLoading(false);}}
   }
   render();
   return()=>{cancelled=true;if(host.current)host.current.innerHTML="";};
 },[src,title]);
 const jump=(n:number)=>{const target=host.current?.querySelector('[data-page="'+n+'"]') as HTMLElement|null;if(target){target.scrollIntoView({behavior:"smooth",block:"start"});setPage(n);}};
 useEffect(()=>{if(!host.current)return;const onScroll=()=>{const items=[...host.current!.querySelectorAll(".gea-pdf-page")] as HTMLElement[];let closest=1,best=Infinity;items.forEach((el,i)=>{const d=Math.abs(el.getBoundingClientRect().top-host.current!.getBoundingClientRect().top-12);if(d<best){best=d;closest=i+1;}});setPage(closest)};const el=host.current;el.addEventListener("scroll",onScroll);return()=>el.removeEventListener("scroll",onScroll)},[loading]);
 return <div className="gea-pdf-viewer" aria-label={title}>
   <div className="gea-pdf-toolbar"><button disabled={page<=1} onClick={()=>jump(page-1)}>‹</button><span>Page {page} of {pages||"…"}</span><button disabled={!pages||page>=pages} onClick={()=>jump(page+1)}>›</button></div>
   {loading&&<div className="gea-pdf-message">Loading material…</div>}
   {error&&<div className="gea-pdf-message">{error}</div>}
   <div ref={host} className="gea-pdf-pages" />
 </div>;
}
