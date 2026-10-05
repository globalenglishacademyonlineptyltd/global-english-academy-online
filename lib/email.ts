const appUrl=()=>process.env.NEXT_PUBLIC_APP_URL||"";
const from=()=>process.env.RESEND_FROM||"Global English Academy <noreply@globalenglishacademyonline.co.za>";

export async function sendEmail(to:string,subject:string,text:string){
  if(!to)return false;
  const key=process.env.RESEND_API_KEY;
  if(!key){
    console.error("Email send skipped: RESEND_API_KEY is not configured.");
    return false;
  }
  try{
    const res=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        Authorization:"Bearer "+key,
      },
      body:JSON.stringify({
        from:from(),
        to:[to],
        subject,
        text,
      }),
      cache:"no-store",
    });
    const body=await res.text();
    if(!res.ok){
      console.error("Email send failed:",res.status,body);
      return false;
    }
    console.log("Email sent successfully to:",to,body);
    return true;
  }catch(error){
    console.error("Email send failed:",error instanceof Error?error.message:String(error));
    return false;
  }
}

export async function sendBookingEmails(d:{teacherEmail:string;teacherName:string;studentEmail:string;studentName:string;startsAt:string;roomCode:string}){
  const date=new Date(d.startsAt).toLocaleString("en-ZA",{dateStyle:"full",timeStyle:"short",timeZone:process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg"});
  const join=appUrl()?appUrl()+"/classroom/"+d.roomCode:"";
  await Promise.all([
    sendEmail(d.studentEmail,"Lesson booked — Global English Academy","Hello "+d.studentName+",\n\nYour English lesson has been booked with "+d.teacherName+".\nDate and time: "+date+"\nDuration: 30 minutes\n"+(join?"Join your lesson: "+join:"Please sign in to your school account to join.")+"\n\nGlobal English Academy"),
    sendEmail(d.teacherEmail,"New lesson booked — Global English Academy","Hello "+d.teacherName+",\n\nA new 30-minute English lesson has been booked with "+d.studentName+".\nDate and time: "+date+"\n"+(join?"Classroom: "+join:"Please sign in to your school account to view the lesson.")+"\n\nGlobal English Academy")
  ]);
}

export async function sendCancellationEmails(d:{teacherEmail:string;teacherName:string;studentEmail:string;studentName:string;startsAt:string}){
  const date=new Date(d.startsAt).toLocaleString("en-ZA",{dateStyle:"full",timeStyle:"short",timeZone:process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg"});
  await Promise.all([
    sendEmail(d.studentEmail,"Lesson cancelled — Global English Academy","Hello "+d.studentName+",\n\nYour English lesson with "+d.teacherName+" on "+date+" has been cancelled by the school after Admin approval.\n\nPlease sign in to your school account to choose another available lesson.\n\nGlobal English Academy"),
    sendEmail(d.teacherEmail,"Lesson cancelled — Global English Academy","Hello "+d.teacherName+",\n\nYour English lesson with "+d.studentName+" on "+date+" has been cancelled after Admin approval.\n\nGlobal English Academy")
  ]);
}
