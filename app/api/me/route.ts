export const dynamic="force-dynamic";export const revalidate=0;
import{NextResponse}from"next/server";import{getSession,userExists}from"@/lib/auth";
export async function GET(){
 if(process.env.NEXT_PHASE==="phase-production-build") return NextResponse.json({setup:true,user:null});
 return NextResponse.json({setup:!(await userExists()),user:await getSession()});
}
