// 糖泡对战 | 二次开发与维护：王艺 | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { LocalSession } from './local-session.mjs';
import { RULES } from './engine.mjs';
let session, previous, accumulator = 0, frames = 0, suspended = false;
onmessage = ({data}) => {
  if (data.type === 'init') {
    session = new LocalSession(new Map(data.maps), data.profile, packet => postMessage(packet));
    postMessage({type:'hello', id:session.id});
    postMessage({type:'lobby', online:0, rooms:[]});
    previous = performance.now();
    setInterval(() => {
      const now = performance.now();
      if (!suspended) accumulator += Math.min(0.1, (now - previous) / 1000);
      previous = now;
      while (accumulator >= RULES.tick) {
        session.tick(); accumulator -= RULES.tick;
        if (++frames % 4 === 0) session.publish();
      }
    }, 8);
  } else if (data.type === 'visibility') {
    suspended = data.hidden;
    accumulator = 0; previous = performance.now();
  } else session?.receive(data);
};
