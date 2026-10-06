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


async function resendRequest(body:any){
  const key=process.env.RESEND_API_KEY;if(!key)return null;
  try{const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},body:JSON.stringify(body),cache:"no-store"});const j=await res.json().catch(()=>({}));if(!res.ok){console.error("Resend email request failed:",res.status,j);return null}return j.id||null}catch(e){console.error("Resend request failed:",e);return null}
}
export async function scheduleEmail(to:string,subject:string,text:string,scheduledAt:string){
  if(!to||new Date(scheduledAt).getTime()<=Date.now())return null;
  return resendRequest({from:from(),to:[to],subject,text,scheduled_at:scheduledAt,tags:[{name:"category",value:"class_reminder"}]});
}
export async function cancelScheduledEmail(id:string|null){
  if(!id||!process.env.RESEND_API_KEY)return;
  try{await fetch("https://api.resend.com/emails/"+encodeURIComponent(id)+"/cancel",{method:"POST",headers:{Authorization:"Bearer "+process.env.RESEND_API_KEY},cache:"no-store"});}catch{}
}

export async function sendBookingEmails(d:{teacherEmail:string;teacherName:string;studentEmail:string;studentName:string;startsAt:string;roomCode:string;classId?:string;lessonTitle?:string;lessonType?:string}){
  const tz=process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg";
  const date=new Date(d.startsAt).toLocaleString("en-ZA",{dateStyle:"full",timeStyle:"short",timeZone:tz});
  const shortDate=new Date(d.startsAt).toLocaleDateString("en-CA",{timeZone:tz});
  const time=new Date(d.startsAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:tz});
  const classLabel=d.lessonType==="DEMO"?"Demo":d.lessonType==="FERRIS_WHEEL"?"Ferris Wheel":"Reg";
  const lesson=d.lessonTitle||"English Lesson";
  const subject="[Booking] ["+classLabel+"] "+shortDate+" "+time+"(GMT+02) - "+d.studentName+" - "+lesson;
  const body="[Class] : "+classLabel+"\n[Date, Time] : "+shortDate+" "+time+":00(GMT+02)\n[Student] : "+d.studentName+"\n[Lesson] : "+lesson;
  const join=appUrl()?appUrl()+"/classroom/"+d.roomCode:"";
  await Promise.all([
    sendEmail(d.studentEmail,subject,body+"\n\nGlobal English Academy"),
    sendEmail(d.teacherEmail,subject,body+"\n\nGlobal English Academy")
  ]);
  const reminderText="NOTICE: You have a class on "+shortDate+" "+time+":00(in your timezone GMT+02)! Please start the class on time. Thanks!\n\n[Class] : "+classLabel+"\n[Student] : "+d.studentName+"\n[Lesson] : "+lesson+(join?"\n\nPlease sign in to enter the classroom.":"");
  const oneDay=new Date(new Date(d.startsAt).getTime()-24*60*60*1000).toISOString();
  const oneHour=new Date(new Date(d.startsAt).getTime()-60*60*1000).toISOString();
  const pairs=await Promise.all([d.teacherEmail,d.studentEmail].map(async email=>({d1:await scheduleEmail(email,"NOTICE: Class on "+shortDate+" (1 day reminder)",reminderText,oneDay),h1:await scheduleEmail(email,"NOTICE: Class on "+shortDate+" "+time+" (1 hour reminder)",reminderText,oneHour)})));
  return {reminder24hIds:pairs.map(x=>x.d1).filter(Boolean),reminder1hIds:pairs.map(x=>x.h1).filter(Boolean)};
}

export async function sendCancellationEmails(d:{teacherEmail:string;teacherName:string;studentEmail:string;studentName:string;startsAt:string}){
  const date=new Date(d.startsAt).toLocaleString("en-ZA",{dateStyle:"full",timeStyle:"short",timeZone:process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg"});
  await Promise.all([
    sendEmail(d.studentEmail,"Lesson cancelled — Global English Academy","Hello "+d.studentName+",\n\nYour English lesson with "+d.teacherName+" on "+date+" has been cancelled by the school after Admin approval.\n\nPlease sign in to your school account to choose another available lesson.\n\nGlobal English Academy"),
    sendEmail(d.teacherEmail,"Lesson cancelled — Global English Academy","Hello "+d.teacherName+",\n\nYour English lesson with "+d.studentName+" on "+date+" has been cancelled after Admin approval.\n\nGlobal English Academy")
  ]);
}

export async function sendStudentCancellationTeacherEmail(d:{teacherEmail:string;teacherName:string;studentName:string;startsAt:string;lessonTitle?:string;lessonType?:string}){
  const tz=process.env.SCHOOL_TIMEZONE||"Africa/Johannesburg";
  const date=new Date(d.startsAt).toLocaleDateString("en-CA",{timeZone:tz});
  const time=new Date(d.startsAt).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:tz});
  const type=d.lessonType==="DEMO"?"Demo":d.lessonType==="FERRIS_WHEEL"?"Ferris Wheel":"Reg";
  const subject="[Cancel] ["+type+"] "+date+" "+time+"(GMT+02) - "+d.studentName;
  const text="[Class] : "+type+"\n[Date, Time] : "+date+" "+time+":00(GMT+02)\n[Student] : "+d.studentName+"\n[Lesson] : "+(d.lessonTitle||"English Lesson")+"\n\nThe student cancelled this lesson through Global English Academy.";
  return sendEmail(d.teacherEmail,subject,text);
}
