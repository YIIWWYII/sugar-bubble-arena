import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage();
try {
 await page.goto(process.env.AUDIT_URL || 'http://127.0.0.1:8892/sugar-bubble-arena/');
 const wardrobeFailures=await page.evaluate(async()=>{
  const {APPEARANCE_OPTIONS,DEFAULT_APPEARANCE,appearanceSheet,setAppearanceAssets}=await import('./appearance.mjs');
  const manifest=await fetch('./assets/manifest.json').then(r=>r.json()),images=new Map(),failures=[];
  await Promise.all(Object.entries(manifest).filter(([key])=>key.startsWith('wardrobe-')||/^prince-red-(stand|walk)-/.test(key)).map(async([key,meta])=>{
   const image=new Image();image.src=meta.src;await image.decode();images.set(key,image);
  }));
  setAppearanceAssets(images);
  // SVG source and its PNG fallback must decode to the same native pixels.
  for(const [key,image] of images){
   if(!key.startsWith('wardrobe-'))continue;
   const fallback=new Image();fallback.src=manifest[key].src.replace(/\.svg$/,'.png');await fallback.decode();
   const pixels=im=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,c.width,c.height).data;};
   const a=pixels(image),b=pixels(fallback);
   if(a.length!==b.length||a.some((v,i)=>v!==b[i]))failures.push(`SVG/PNG mismatch ${key}`);
  }
  for(const slot of ['accessory','wings','back','held','shoes','mount','aura'])for(let value=1;value<APPEARANCE_OPTIONS[slot].values.length;value++){
   if(!images.has(`wardrobe-${slot}-${value}`))failures.push(`missing ${slot}:${value}`);
   for(const motion of ['stand','walk'])for(const direction of [0,1,2,3]){
    const key=`prince-red-${motion}-${direction}`,source=images.get(key);
    const plain=appearanceSheet(source,key,DEFAULT_APPEARANCE),decorated=appearanceSheet(source,key,{...DEFAULT_APPEARANCE,[slot]:value});
    const a=plain.getContext('2d').getImageData(0,0,plain.width,plain.height).data,b=decorated.getContext('2d').getImageData(0,0,decorated.width,decorated.height).data;
    for(let f=0;f<plain.width/100;f++){
     let changed=0;
     for(let y=0;y<100;y++)for(let x=f*100;x<(f+1)*100;x++){
      const i=(y*plain.width+x)*4;if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]||a[i+3]!==b[i+3])changed++;
     }
     if(changed<12)failures.push(`invisible ${slot}:${value} ${key} frame ${f}`);
    }
   }
  }
  // Verify layering contracts with controlled pixels, independent of item artwork.
  const {EQUIPMENT_LAYOUT}=await import('./appearance.mjs');
  const mock=new Map();
  const swatches={aura:'#111111',mount:'#222222',wings:'#333333',back:'#444444',shoes:'#555555',accessory:'#666666',held:'#777777'};
  for(const [slot,color] of Object.entries(swatches)){
   const sheet=document.createElement('canvas');sheet.width=2800;sheet.height=100;
   const ctx=sheet.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,2800,100);mock.set(`wardrobe-${slot}-1`,sheet);
  }
  setAppearanceAssets(mock);
  const pixel=(canvas,x,y)=>Array.from(canvas.getContext('2d').getImageData(x,y,1,1).data);
  for(const direction of [0,1,2,3]){
   const body=document.createElement('canvas');body.width=body.height=100;
   const ctx=body.getContext('2d');ctx.fillStyle='#eeeeee';ctx.fillRect(0,0,100,100);
   const key=`prince-red-stand-${direction}`;
   const face=EQUIPMENT_LAYOUT.face[direction];
   const plain=appearanceSheet(body,key,DEFAULT_APPEARANCE);
   const all=appearanceSheet(body,key,{...DEFAULT_APPEARANCE,...Object.fromEntries(Object.keys(swatches).map(s=>[s,1]))});
   if(face&&JSON.stringify(pixel(all,face[0]+2,face[1]+2-8))!==JSON.stringify(pixel(plain,face[0]+2,face[1]+2)))failures.push(`face protection ${direction}`);
   const riding=appearanceSheet(body,key,{...DEFAULT_APPEARANCE,mount:1,shoes:1});
   if(pixel(riding,50,70)[0]!==85)failures.push(`riding footwear ${direction}`);
   const back=appearanceSheet(body,key,{...DEFAULT_APPEARANCE,back:1});
   const actual=pixel(back,50,65),expected=direction===1?[68,68,68,255]:pixel(plain,50,65);
   if(JSON.stringify(actual)!==JSON.stringify(expected))failures.push(`back depth ${direction}`);
  }
  setAppearanceAssets(images);
  return failures;
 });
 assert.deepEqual(wardrobeFailures,[]);

 const music=await page.evaluate(async()=>{
  const {MODE_MUSIC}=await import('./music.mjs');
  const ctx=new AudioContext();const decoded=[];
  for(const [mode,track] of Object.entries(MODE_MUSIC)){
   const r=await fetch('./assets/'+track.file);if(!r.ok)throw Error(track.file);
   const sound=await ctx.decodeAudioData(await r.arrayBuffer());if(sound.duration<1)throw Error('Empty audio '+mode);decoded.push({mode,seconds:sound.duration});
  }await ctx.close();return decoded;
 });
 console.log('PASS wardrobe: all named accessories, four directions, idle/walk frames, SVG/PNG equivalence and layering');
 console.log('PASS music decoding',JSON.stringify(music));
}finally{await browser.close();}
