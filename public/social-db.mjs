// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
let database;
function open() {
  if(!database)database=new Promise((resolve,reject)=>{
    const request=indexedDB.open('sugar-bubble-social',1);
    request.onupgradeneeded=()=>{const store=request.result.createObjectStore('messages',{keyPath:'id'});store.createIndex('thread','thread');};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>{database=null;reject(request.error);};
  });
  return database;
}
export async function saveMessages(messages) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('messages','readwrite');for(const message of messages)tx.objectStore('messages').put(message);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
export async function readMessages(thread) {
  const db=await open();
  return new Promise((resolve,reject)=>{
    const request=db.transaction('messages').objectStore('messages').index('thread').getAll(thread);
    request.onsuccess=()=>resolve(request.result.sort((a,b)=>a.time-b.time || a.id.localeCompare(b.id)));
    request.onerror=()=>reject(request.error);
  });
}
