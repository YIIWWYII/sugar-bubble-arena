// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const directory = new URL('../public/assets/ui/',import.meta.url);
await mkdir(directory,{recursive:true});
const ink='#183b59',cyan='#75dbe9',white='#e8fbff',gold='#ffda68',red='#ed6974',purple='#c59af0',green='#94d99a';
const rect=(x,y,w,h,c)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const path=(d,c)=>`<path d="${d}" fill="${c}"/>`;
const cross=(x,y,c=white)=>rect(x+3,y,4,10,c)+rect(x,y+3,10,4,c);
const bubble=(x=6,y=6,c=cyan)=>path(`M${x+4} ${y}h12v2h4v4h2v12h-2v4h-4v2H${x+4}v-2H${x}v-4h-2V${y+6}h2v-4h4Z`,ink)+path(`M${x+4} ${y+2}h12v2h4v14h-4v4H${x+4}v-4H${x}V${y+6}h4Z`,c)+rect(x+4,y+4,4,3,white);
const shield=path('M6 5h20v15h-3v4h-3v3h-8v-3H9v-4H6Z',ink)+path('M9 8h14v11h-3v4h-8v-4H9Z',cyan);
const boot=path('M13 4h10v15h5v8H5v-8h8Z',ink)+path('M16 6h5v15h5v3H8v-3h8Z',gold)+rect(16,10,5,2,white);
const heart=path('M4 8h3V5h6v3h6V5h6v3h3v10h-3v4h-4v4h-4v3h-3v-3h-4v-4H7v-4H4Z',ink)+path('M7 9h5v3h8V9h5v8h-4v4h-4v4h-2v-4h-4v-4H7Z',red);
const bolt=path('M17 3h9l-9 11h8L10 30l3-13H6Z',gold)+path('M18 5h4l-9 11h4l-3 7 8-8h-8Z',white);
const snow=rect(14,4,4,24,cyan)+rect(4,14,24,4,cyan)+path('M5 7h4v3h3v3H9v-3H5Zm18 0h4v3h-4v3h-3v-3h3ZM5 22h4v-3h3v3H9v3H5Zm18 0v-3h-3v3h3v3h4v-3Z',white);
const magnet=path('M5 5h8v15h6V5h8v18h-3v4H8v-4H5Z',ink)+path('M8 7h3v15h10V7h3v15h-3v3H11v-3H8Z',red)+rect(8,6,3,6,white)+rect(21,6,3,6,white);
const kit=path('M10 5h12v5h6v17H4V10h6Z',ink)+rect(12,7,8,3,gold)+rect(6,12,20,13,red)+cross(11,13);
const bottle=rect(12,3,8,4,ink)+rect(13,5,6,5,white)+path('M10 10h12v4h3v14H7V14h3Z',ink)+rect(9,16,14,10,green)+rect(10,11,12,5,white);
const cell=bubble(6,4,purple)+rect(12,12,8,8,ink)+rect(14,14,4,4,green);
const crate=rect(4,9,24,19,ink)+rect(6,11,20,15,gold)+rect(14,11,4,15,ink)+rect(6,16,20,3,ink);
const clock=bubble(6,4,white)+rect(15,8,3,10,ink)+rect(16,16,7,3,ink);
const icons={
  sprint:boot+rect(2,7,7,2,cyan)+rect(4,11,6,2,cyan),
  shield:shield+`<g transform="translate(13 11) scale(.5)">${bubble(0,0,white)}</g>`,
  ward:shield+path('M1 8h5v4h4v3H5v-3H1Zm25 0h5v4h-4v3h-4v-3h3Z',gold),
  purify:cross(11,11)+path('M3 5h3v3h3v3H6v3H3v-3H0V8h3Zm23 16h3v3h3v3h-3v3h-3v-3h-3v-3h3Z',cyan)+rect(10,4,12,3,gold),
  rescue:bubble()+path('M18 4h5l-5 10h5L9 29l4-13H8Z',gold),
  magnet:magnet+rect(14,6,4,4,gold),
  vitality:shield+cross(11,10),
  boots:boot,
  pressure:bubble()+path('M13 24V12H9l7-8 7 8h-4v12Z',gold),
  pockets:crate+path('M5 4h9v3h-3v7H8V7H5Z',white)+rect(20,3,5,8,green),
  medicine:path('M19 2h8v3h-3v4h3v4H14v10h-3v4H8v3H5v-3h3v-4h3V12h3V9h7V5h-2Z',ink)+rect(14,11,10,4,white)+rect(13,16,5,7,green)+rect(18,6,4,4,cyan),
  capacity:`<g transform="scale(.75)">${bubble(3,3)+bubble(12,12,gold)}</g>`,
  recovery:kit,
  claws:path('M5 3h4v12l-4 9H2l3-10Zm9 0h4v15l-4 11h-3l3-12Zm9 0h4v12l-4 10h-3l3-11Z',purple)+rect(4,26,4,3,red),
  pursuit:boot+path('M4 3h5v4H4Zm-3 6h5v4H1Zm4 5h5v4H5Z',purple),
  carapace:path('M9 4h14v4h5v18H4V8h5Z',ink)+rect(11,6,10,5,purple)+rect(6,13,8,5,purple)+rect(18,13,8,5,purple)+rect(8,20,16,5,purple),
  tenacity:shield+path('M2 4h3v6h6v3H5v4H2Zm25 11h3v6h-6v3h-3v-6h6Z',purple),
  virulence:cell+rect(14,0,4,4,green)+rect(0,14,4,4,green)+rect(28,14,4,4,green)+rect(14,28,4,4,green),
  regeneration:cell+path('M3 5h6v3H6v4H3Zm20 17h6v6h-6v-3h3v-3Z',green),
  adrenaline:bottle+bolt,
  growth:cell+path('M24 1v7h-4l6 6 6-6h-4V1Z',green),
  renewal:cell+cross(11,11),
  force:bubble()+path('M14 3h4v8h8v4h-8v8h-4v-8H6v-4h8Z',gold),
  cadence:clock+path('M24 2h5v6h-3V5h-5V2Z',gold),
  reach:path('M3 13h19V8l9 8-9 8v-5H3Z',cyan)+rect(3,8,3,3,gold),
  burst:path('M14 2h4v7l6-5 3 3-5 6h8v5h-8l5 7-3 3-6-6v8h-4v-8l-7 5-3-3 5-6H2v-5h7L4 7l3-3 7 5Z',gold)+rect(12,12,8,8,white),
  frost:snow,
  chain:bolt+rect(1,6,6,6,cyan)+rect(25,23,6,6,cyan),
  supplies:crate+cross(11,11),
  health:heart,
  speed:boot+rect(3,5,3,3,gold),
  experience:magnet+path('M14 1h4v3h3v4h-3v3h-4V8h-3V4h3Z',gold),
  learning:path('M3 5h11l2 3 2-3h11v22H18l-2 2-2-2H3Z',ink)+rect(5,7,9,17,white)+rect(18,7,9,17,cyan)+rect(7,10,5,2,gold)+rect(7,15,5,2,gold),
  regen:bottle+cross(11,16),
  thorns:shield+path('M4 1l7 6H4Zm24 0v6h-7ZM1 18l8-2-4 8Zm30 0-4 6-4-8Z',gold),
  glacier:snow+path('M12 11h8v8h-8Z',purple)+path('M1 24h6v6H1Zm24-22h6v6h-6Z',cyan),
  storm:rect(3,3,26,2,cyan)+rect(3,3,2,26,cyan)+rect(27,3,2,26,cyan)+rect(3,27,26,2,cyan)+bolt,
  sustain:kit+rect(1,2,6,6,gold),
  overpower:bubble()+path('M3 8h4V4h4V1h4v7H9v4H3Zm17 16h4v-4h5v9h-9Z',gold),
  reservoir:heart+rect(21,20,10,10,ink)+cross(21,20,gold),
};
const manifestURL=new URL('../public/assets/manifest.json',import.meta.url);
const manifest=JSON.parse(await readFile(manifestURL,'utf8'));
for(const [name,art] of Object.entries(icons)) {
  await writeFile(new URL(`${name}.svg`,directory),`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">${art}</svg>\n`);
  manifest[`ui-${name}`]={src:`/assets/ui/${name}.svg`,w:32,h:32,frames:1};
}
await writeFile(manifestURL,JSON.stringify(manifest,null,2)+'\n');
console.log(`Generated ${Object.keys(icons).length} pixel-style SVG icons`);
