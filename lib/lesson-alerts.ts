import {query} from "@/lib/db";
import {sendEmail} from "@/lib/email";

/**
 * Sends one low-balance or depleted-package notice per parent, per package.
 * The package version changes whenever Admin allocates a new paid package.
 */
export async function checkStudentLessonBalanceAlerts(studentId:string){
  const result=await query<any>(`
    SELECT u.full_name student_name,COALESCE(st.purchased_classes,0)::int purchased_classes,
      COALESCE(st.lesson_package_version,1)::int package_version,
      GREATEST(COALESCE(st.purchased_classes,0)
        - COUNT(l.id) FILTER(WHERE l.status<>'CANCELLED')
        - COUNT(l.id) FILTER(WHERE l.status='CANCELLED' AND l.student_cancelled_late=true),0)::int remaining
    FROM users u
    JOIN students st ON st.user_id=u.id
    LEFT JOIN lessons l ON l.student_id=u.id
    WHERE u.id=$1 AND u.role='STUDENT' AND u.deleted_at IS NULL
    GROUP BY u.id,st.purchased_classes,st.lesson_package_version
  `,[studentId]);
  const student=result.rows[0];
  if(!student)return;
  const remaining=Number(student.remaining);
  const alertType=remaining<=0?"DEPLETED":remaining<10?"LOW_BALANCE":null;
  if(!alertType)return;
  const contact=await query<any>("SELECT parent_emails FROM students WHERE user_id=$1",[studentId]);
  const parentEmails=String(contact.rows[0]?.parent_emails||"").split(/[;,\s]+/).map((v:string)=>v.trim().toLowerCase()).filter((v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
  const parents=[...new Set(parentEmails)].map(email=>({email,full_name:"Parent/Guardian"}));
  for(const parent of parents){
    const claim=await query<any>(`
      INSERT INTO student_lesson_alerts(student_id,package_version,alert_type,recipient_email)
      VALUES($1,$2,$3,$4) ON CONFLICT(student_id,package_version,alert_type,recipient_email) DO NOTHING
      RETURNING id
    `,[studentId,student.package_version,alertType,parent.email]);
    if(!claim.rowCount)continue;
    const subject=alertType==="DEPLETED"
      ?"Lesson package depleted — "+student.student_name
      :"Lesson balance running low — "+student.student_name;
    const message=alertType==="DEPLETED"
      :"Dear "+(parent.full_name||"Parent/Guardian")+",\n\nThis is to let you know that "+student.student_name+"'s lesson package has been depleted. The remaining lesson balance is 0. Please contact Global English Academy Online to arrange a new paid lesson package. The student will be able to book lessons again once the school has allocated the new package.\n\nKind regards,\nGlobal English Academy Online"
      :"Dear "+(parent.full_name||"Parent/Guardian")+",\n\nThis is a friendly reminder that "+student.student_name+" has "+remaining+" lesson"+(remaining===1?"":"s")+" remaining in the current lesson package. The balance is now below 10 lessons. Please contact Global English Academy Online to arrange the next package before the lessons run out.\n\nKind regards,\nGlobal English Academy Online";
    const sent=await sendEmail(parent.email,subject,message);
    if(!sent){
      await query("DELETE FROM student_lesson_alerts WHERE id=$1",[claim.rows[0].id]);
    }
  }
}
