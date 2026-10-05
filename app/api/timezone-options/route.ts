import {NextResponse} from "next/server";
import {allCountryOptions,countryTimezones} from "@/lib/timezones";
const languages=[["en","English"],["zh-CN","Chinese (Simplified)"],["zh-TW","Chinese (Traditional)"],["es","Spanish"],["fr","French"],["de","German"],["pt","Portuguese"],["ja","Japanese"],["ko","Korean"],["ar","Arabic"],["hi","Hindi"],["it","Italian"],["ru","Russian"],["nl","Dutch"],["tr","Turkish"],["pl","Polish"],["vi","Vietnamese"],["th","Thai"],["id","Indonesian"],["ms","Malay"],["he","Hebrew"],["uk","Ukrainian"],["sv","Swedish"],["da","Danish"],["no","Norwegian"],["fi","Finnish"],["cs","Czech"],["el","Greek"],["hu","Hungarian"],["ro","Romanian"],["sk","Slovak"],["bg","Bulgarian"],["sr","Serbian"],["hr","Croatian"],["sw","Swahili"],["af","Afrikaans"]];
export async function GET(){
 const countries=allCountryOptions().map((c:any)=>({...c,timezones:countryTimezones(c.id)}));
 return NextResponse.json({
  canonical:{name:"Chinese Time",timezone:"Asia/Shanghai",utcOffset:"+08:00"},
  countries,
  languages:languages.map(([code,name])=>({code,name}))
 });
}
