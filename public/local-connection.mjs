// 糖泡对战 | 二次开发与维护：王艺 | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { saveMessages, readMessages } from './social-db.mjs';
import { readLocalProfile, writeLocalProfile } from './local-profile.mjs';

export class LocalConnection extends EventTarget {
  readyState = 0;
  constructor(maps) {
    super();
    this.worker = new Worker(new URL('./local-worker.mjs', import.meta.url), {type:'module'});
    const deliver = data => this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(data)}));
    this.worker.onmessage = async ({data}) => {
      if(data.type==='friend-proposal'){
        try { writeLocalProfile(data.save,localStorage,false); }
        catch {this.worker.postMessage({type:'friend-commit',requestId:data.requestId,success:false});deliver({type:'friend-result',requestId:data.requestId,error:'存档写入失败，赠礼及关系修改未生效，请检查浏览器存储权限。'});return;}
        this.worker.postMessage({type:'friend-commit',requestId:data.requestId,success:true});
        deliver({type:'profile',profile:data.profile});
        let warning='';
        try {if(data.entries.length)await saveMessages(data.entries);}
        catch {warning='操作已生效，但聊天数据库写入失败。本次消息仅在当前页面显示，请勿重复赠礼。';}
        deliver({type:'friend-result',requestId:data.requestId,profile:data.profile,entries:data.entries,warning});return;
      }
      if(data.type==='chat' && data.scope==='town'){
        try {await saveMessages([{...data,sender:data.name}]);}
        catch {deliver({type:'error',message:'小镇聊天记录保存失败，当前消息仍可查看。'});}
      }
      if(data.type==='town-history'){
        try {data.messages=await readMessages('town');}
        catch {deliver({type:'error',message:'无法读取本地聊天数据库，请检查浏览器存储权限。'});}
      }
      if (data.type === 'hello') {
        this.readyState = 1;
        this.dispatchEvent(new Event('open'));
      }
      if (data.save) {
        try { writeLocalProfile(data.save); delete data.save; }
        catch { if (data.reward) data.reward.saved = false; this.dispatchEvent(new MessageEvent('message', {data:JSON.stringify({type:'error', message:'本地存档写入失败，请勿刷新；当前进度可退出对局后在存档页面导出'})})); }
        delete data.save;
      }
      this.dispatchEvent(new MessageEvent('message', {data:JSON.stringify(data)}));
    };
    this.worker.onerror = () => {
      this.dispatchEvent(new MessageEvent('message', {data:JSON.stringify({type:'error',message:'单人引擎加载失败，请刷新页面重试'})}));
    };
    this.visibility = () => this.worker.postMessage({type:'visibility', hidden:document.hidden});
    document.addEventListener('visibilitychange',this.visibility);
    this.worker.postMessage({type:'init', maps:[...maps], profile:readLocalProfile()});
    this.visibility();
  }
  send(data) { this.worker.postMessage(JSON.parse(data)); }
  close() {
    this.readyState = 3; this.worker.terminate();
    document.removeEventListener('visibilitychange',this.visibility);
  }
}
