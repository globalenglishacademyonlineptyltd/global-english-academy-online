import{NextRequest,NextResponse}from"next/server";
export function middleware(req:NextRequest){
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
