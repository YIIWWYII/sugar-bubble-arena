// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
// HTTP account endpoints; secrets never appear in profile snapshots or logs.
export function accountAPI(profiles, publicOrigin, disconnect) {
  const attempts = new Map();
  const cookie = (name,value,age=2592000) => `${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${publicOrigin.startsWith('https:') ? '; Secure' : ''}`;
  return async (req,res,url) => {
    if (!url.pathname.startsWith('/api/account/')) return false;
    const reply=(status,data,cookies)=>{
      res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...(cookies?{'set-cookie':cookies}:{})});
      res.end(JSON.stringify(data));
    };
    if(req.method!=='POST'){reply(405,{error:'请使用 POST 请求'});return true;}
    // Browser mutations must originate from this game. No wildcard CORS.
    const allowed=publicOrigin || `http://${req.headers.host}`;
    const localOrigin=/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(req.headers.origin || '') && new URL(req.headers.origin).host===req.headers.host;
    if(req.headers.origin!==allowed && !localOrigin){reply(403,{error:'请求来源不允许'});return true;}
    if(!req.headers['content-type']?.startsWith('application/json')){reply(415,{error:'请求格式无效'});return true;}
    let ip=req.socket.remoteAddress || '';
    if(['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip))ip=req.headers['cf-connecting-ip'] || ip;
    const now=Date.now();
    for(const [key,value] of attempts)if(value.until<now)attempts.delete(key);
    const rate=attempts.get(ip)||{count:0,until:now+600000};
    if(++rate.count>20 || attempts.size>10000){reply(429,{error:'操作过于频繁，请十分钟后再试'});return true;}
    attempts.set(ip,rate);
    try{
      let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>4096)throw Error('请求内容过长');}
      const input=JSON.parse(text);
      const current=profiles.identify(req.headers.cookie);
      let result;
      switch(url.pathname){
        case '/api/account/register':result=await profiles.register(input.name,input.password,current);break;
        case '/api/account/login':result=await profiles.login(input.name,input.password);break;
        case '/api/account/recover':result=await profiles.recover(input.name,input.password,input.recovery);break;
        case '/api/account/logout':
          profiles.logout(req.headers.cookie);disconnect(current);
          reply(200,{ok:true},[cookie('qqt_session','',0),cookie('qqt_profile','',0)]);return true;
        default:reply(404,{error:'操作不存在'});return true;
      }
      disconnect(current);if(result.id!==current)disconnect(result.id);
      reply(200,{ok:true,account:profiles.view(result.id).accountName,...(result.recovery?{recovery:result.recovery}:{})},[cookie('qqt_session',result.token),cookie('qqt_profile','',0)]);
    }catch(error){
      reply(400,{error:error.code?'操作未保存，请稍后重试':error instanceof SyntaxError?'请求格式无效':error.message});
    }
    return true;
  };
}
