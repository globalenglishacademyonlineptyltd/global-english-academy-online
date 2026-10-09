import{NextRequest,NextResponse}from"next/server";
export function middleware(req:NextRequest){
 const host=req.headers.get("host")?.split(":")[0].toLowerCase();
 if(host==="gea-web-live-production.up.railway.app"){
   const url=req.nextUrl.clone();
   url.protocol="https:";
   url.host="school.globalenglishacademyonline.co.za";
   return NextResponse.redirect(url,308);
 }
 const hasSession=Boolean(req.cookies.get("gea_session")?.value);
 const path=req.nextUrl.pathname;
 if(path==="/login"&&hasSession){
   const url=req.nextUrl.clone();url.pathname="/dashboard";return NextResponse.redirect(url);
 }
 if((path==="/dashboard"||path.startsWith("/dashboard/")||path==="/change-password"||path.startsWith("/classroom/"))&&!hasSession){
   const url=req.nextUrl.clone();url.pathname="/login";url.searchParams.set("from",path);return NextResponse.redirect(url);
 }
 return NextResponse.next();
}
export const config={matcher:["/login","/dashboard/:path*","/change-password","/classroom/:path*"]};
