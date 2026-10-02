import { readLocalProfile, writeLocalProfile } from './local-profile.mjs';

export class LocalConnection extends EventTarget {
  readyState = 0;
  constructor(maps) {
    super();
    this.worker = new Worker(new URL('./local-worker.mjs', import.meta.url), {type:'module'});
    this.worker.onmessage = ({data}) => {
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
