// NOAA fractional-year approximation, Seoul 37.5665 N / 126.978 E, fixed UTC+9.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
// This is a scene-data refresh policy, NOT a physical tower operating schedule.
const DAY=86400000,KST=9*60*60*1000;
export function seoulSolarTimes(year,month,day){
 const rad=Math.PI/180,lat=37.5665*rad,lon=126.978,offset=540;
 const start=Date.UTC(year,0,1),date=Date.UTC(year,month-1,day),days=(Date.UTC(year+1,0,1)-start)/DAY;
 const g=2*Math.PI/days*((date-start)/DAY);
 const eq=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
 const dec=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
 const noon=720-4*lon-eq+offset;
 const span=alt=>4/rad*Math.acos((Math.sin(alt*rad)-Math.sin(lat)*Math.sin(dec))/(Math.cos(lat)*Math.cos(dec)));
 return {dawn:noon-span(-6),sunset:noon+span(-.833)};
}
function dayBounds(localMidnight){
 const d=new Date(localMidnight),times=seoulSolarTimes(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate());
 return {dawn:localMidnight-KST+times.dawn*60000,sunset:localMidnight-KST+times.sunset*60000};
}
export function nightWindow(now){
 const d=new Date(now+KST),day=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()),today=dayBounds(day);
 if(now<today.dawn)return {start:dayBounds(day-DAY).sunset,end:today.dawn};
 if(now>=today.sunset)return {start:today.sunset,end:dayBounds(day+DAY).dawn};
 return null;
}
