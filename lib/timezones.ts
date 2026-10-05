import ct from "countries-and-timezones";
export const CANONICAL_TIMEZONE="Asia/Shanghai";
export const CANONICAL_LABEL="Chinese Time";
export function allCountryOptions(){const all=ct.getAllCountries();return Object.values(all).map((c:any)=>({id:c.id,name:c.name,timezones:c.timezones})).sort((a:any,b:any)=>a.name.localeCompare(b.name))}
export function countryTimezones(id:string){return ct.getTimezonesForCountry(id).map((z:any)=>({name:z.name,offset:z.utcOffsetStr,dstOffset:z.dstOffsetStr}))}
