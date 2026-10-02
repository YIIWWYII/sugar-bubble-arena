import { FRIENDS, GIFTS, changeFriendship } from './friendship.mjs';
import { TOWN, stepTown, townPath, createTownNPCs, tickTownNPC, talkTownNPC } from "./town.mjs";
import { NPC_DESIGNS } from "./appearance.mjs";
import { RULES } from "./engine.mjs";
import { Match } from './engine.mjs';
import { ExpeditionMatch, validateBioOptions } from './expedition.mjs';
import { BioMatch } from './bio.mjs';
import { SurvivorMatch } from './survivor.mjs';
import { WaterMatch } from './water11.mjs';
import { BOT_LEVELS, addBot, tickBot } from './bots.mjs';
import { mapForMode } from './maps.mjs';
import { changeProfile, publicProfile, roundReward, COLLECTION } from './progression.mjs';

// Same message contract and engines as the hosted game, with one local player.
export class LocalSession {
  constructor(maps, profile, emit) {
    this.maps = maps;
    this.profile = profile;
    this.emit = emit;
    this.id = 'local-player';
    this.townChat = [];
    this.townNPCs = createTownNPCs(NPC_DESIGNS);
  }
  publish(full = false) {
    if (this.town) this.emit({type:'town-state', players:[{id:this.id,...this.town,motion:this.town.input}], npcs:this.townNPCs});
    if (!this.match) return;
    const packet = {type:'state', room:'单人', host:this.id, aiLevel:this.bot?.level, ...this.match.snapshot()};
    if (full) { packet.blocks = this.match.blocks; packet.trapDuration = this.match.trapDuration; }
    this.emit(packet);
  }
  addTownMessage(name,text,kind='player') {
    const packet={type:'chat',scope:'town',id:crypto.randomUUID(),thread:'town',kind,name,text,time:Date.now()};
    this.townChat.push(packet);this.townChat=this.townChat.slice(-30);this.emit(packet);
  }
  start() {
    this.settle();
    this.match.setLoadout(this.id, publicProfile(this.profile));
    this.match.start();
    this.rewarded = false;
    this.emit({type:'round-start'});
  }
  settle() {
    if (!this.match || this.rewarded || this.match.state !== 'finished') return;
    const player = this.match.players.find(p => p.id === this.id);
    const reward = roundReward(this.match, player, this.bot?.level);
    this.rewarded = true;
    if (!reward) return;
    const next = structuredClone(this.profile);
    for (const key of ['coins', 'gems', 'xp']) next[key] += reward[key];
    next.matches++;
    if (reward.won) next.wins++;
    const discoveries = [`map:${this.match.map.id}`, ...(player.discoveries || [])];
    if (this.bot && reward.won) discoveries.push('enemy:bot');
    for (const key of discoveries) if (Object.hasOwn(COLLECTION, key) && !next.collection.includes(key)) next.collection.push(key);
    this.profile = next;
    this.emit({type:'round-reward', reward, profile:publicProfile(next), save:next});
  }
  tick() {
    if (this.town) {
      stepTown(this.town, RULES.tick);
      for (const npc of this.townNPCs) tickTownNPC(npc,RULES.tick,Date.now());
    }
    if (!this.match) return;
    if (this.bot) tickBot(this.match, this.bot);
    this.match.tick();
    this.settle();
  }
  receive(msg) {
    try { this.handle(msg); }
    catch (error) { this.emit({type:'error', message:error.message}); }
  }
  handle(msg) {
    if (msg.type === 'friend-action') {
      if(this.match)throw Error('请先退出对局再进行交友操作');
      if(msg.requestId===this.lastFriendRequest)throw Error('该操作已经完成，请勿重复提交');
      if(this.pendingFriend)throw Error('上一项操作正在保存，请稍候');
      const action=msg.action || {},next=structuredClone(this.profile),entries=[],time=Date.now();
      if(action.type==='chat' && (typeof action.text!=='string' || !action.text.trim() || action.text.length>140))throw Error('消息请输入 1–140 个字符');
      changeFriendship(next,action,time);
      const name=FRIENDS[action.id]?.name;
      const entry=(kind,sender,text)=>entries.push({id:crypto.randomUUID(),thread:action.id,kind,sender,text,time:time+entries.length});
      if(action.type==='chat'){
        entry('player',next.social.nickname,action.text.trim());
        const npc=this.townNPCs.find(n=>n.id===action.id);
        if(talkTownNPC(this.townNPCs,npc,npc.id,time))entry('npc',name,npc.bubble);
        else entry('npc',name,'我在听，慢慢说。');
      }
      if(action.type==='gift'){
        entry('system','赠礼记录',`赠送${GIFTS[action.gift].name}，消耗 ${GIFTS[action.gift].coins} 糖币、${GIFTS[action.gift].gems} 技能星`);
        entry('npc',name,'谢谢你送来的礼物，我会好好收下。');
      }
      this.pendingFriend={requestId:msg.requestId,profile:next};
      return this.emit({type:'friend-proposal',requestId:msg.requestId,save:next,profile:publicProfile(next),entries});
    }
    if (msg.type === 'friend-commit') {
      if(this.pendingFriend?.requestId!==msg.requestId)return;
      if(msg.success){this.lastFriendRequest=msg.requestId;this.profile=this.pendingFriend.profile;if(this.town)this.town.name=this.profile.social.nickname;}
      this.pendingFriend=null;return;
    }
    if(this.pendingFriend && ['profile-change','create'].includes(msg.type))throw Error('正在保存交友操作，请稍候');
    if (msg.type === 'ping') return this.emit({type:'pong', sent:msg.sent});
    if (msg.type === 'lobby') return this.emit({type:'lobby', online:0, rooms:[]});
    if (msg.type === 'join' || (msg.type === 'chat' && !this.town)) throw Error('暂未开放，敬请等待');
    if (msg.type === 'chat' && this.town) {
      if(typeof msg.text!=='string')return;
      const text=Array.from(msg.text.replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,140).join('');
      if(!text)return;
      this.town.bubble=text;this.town.bubbleUntil=Date.now()+6000;
      this.addTownMessage(this.town.name,text);
      const npc=this.townNPCs.find(n=>Math.hypot(n.x-this.town.x,n.y-this.town.y)<105);
      if(npc && talkTownNPC(this.townNPCs,this.town,npc.id,Date.now()))this.addTownMessage(npc.name,npc.bubble,'npc');
      return this.publish();
    }
    if (msg.type === 'town-enter') {
      if (this.match) throw Error('请先退出对局');
      this.town = {...TOWN.spawn, name:this.profile.social?.nickname || String(msg.name || '糖友').slice(0,12), appearance:this.profile.appearance,dir:3,input:{x:0,y:0}};
      this.emit({type:'town-history',messages:this.townChat});
      return this.publish();
    }
    if (msg.type === 'town-leave') { this.town = null; return; }
    if (msg.type === 'town-move' && this.town && [-1,0,1].includes(msg.x) && [-1,0,1].includes(msg.y)) {
      this.town.path=[];this.town.command=msg.command;this.town.input={x:msg.x,y:msg.y};return;
    }
    if (msg.type === 'town-target' && this.town && Number.isFinite(msg.x) && Number.isFinite(msg.y)) {
      const route=townPath(this.town,msg);
      this.town.path=route || [];this.town.input={x:0,y:0};this.town.command=msg.command;
      this.emit({type:'town-target-result',command:msg.command,accepted:!!route});return this.publish();
    }
    if (msg.type === 'town-talk' && this.town) { if(talkTownNPC(this.townNPCs,this.town,msg.npcId,Date.now())) { const npc=this.townNPCs.find(n=>n.id===msg.npcId);this.addTownMessage(npc.name,npc.bubble,'npc'); } return this.publish(); }
    if (msg.type === 'town-emote' && this.town) {
      const near=this.townNPCs.find(n=>Math.hypot(n.x-this.town.x,n.y-this.town.y)<105);
      if(near)talkTownNPC(this.townNPCs,this.town,near.id,Date.now());
      this.town.bubble='你好！';this.town.bubbleUntil=Date.now()+3000;return this.publish();
    }
    if (msg.type === 'profile-change') {
      if (this.match) throw Error('请先退出对局再修改角色');
      const next = structuredClone(this.profile);
      changeProfile(next, msg.action || {});
      this.profile = next;
      return this.emit({type:'profile', profile:publicProfile(next), save:next});
    }
    if (msg.type === 'leave') {
      this.settle(); this.match = null; this.bot = null;
      return this.emit({type:'left'});
    }
    if (msg.type === 'create') {
      this.town = null;
      const source = this.maps.get(msg.mapId);
      if (!source) throw Error('没有找到这张地图');
      const selected = mapForMode(source, msg.mode ?? 'classic');
      if (msg.aiLevel !== undefined && (!Object.hasOwn(BOT_LEVELS, msg.aiLevel) || selected.mode !== 'classic' || msg.practice)) throw Error('请选择有效的经典人机难度');
      if (!msg.practice && !msg.aiLevel && !(msg.solo === true && selected.mode !== 'classic')) throw Error('暂未开放，敬请等待');
      const Engine = {classic:Match, boss:ExpeditionMatch, bio:BioMatch, survivor:SurvivorMatch, water11:WaterMatch}[selected.mode];
      if (!Engine) throw Error('模式不存在');
      this.settle();
      this.match = new Engine(selected, msg.practice === true, crypto.getRandomValues(new Uint32Array(1))[0], selected.mode === 'bio' ? validateBioOptions(msg.bioOptions) : {});
      this.bot = null;
      this.match.addPlayer(this.id, String(msg.name || '糖友').trim().slice(0,12) || '糖友', 0);
      this.match.setLoadout(this.id, publicProfile(this.profile));
      if (msg.aiLevel) this.bot = addBot(this.match, msg.aiLevel);
      this.emit({type:'joined', room:'单人', id:this.id, practice:this.match.practice});
      this.start();
      return this.publish(true);
    }
    const match = this.match;
    if (!match) return;
    if (msg.type === 'survivor-pick' || msg.type === 'survivor-reroll') {
      const ok = msg.type === 'survivor-pick' ? match.choose?.(this.id,msg.key,msg.offerId) : match.reroll?.(this.id,msg.offerId);
      if (!ok) throw Error('强化选择已更新，请选择当前选项');
      return this.publish();
    }
    if (msg.type === 'return' && match.state === 'finished') { this.start(); return this.publish(true); }
    if (match.paused?.()) return;
    switch (msg.type) {
      case 'input': match.setInput(this.id,msg); return;
      case 'bio-antidote': match.useAntidote?.(this.id); break;
      case 'cycle-bomb': match.cycleBomb?.(this.id); break;
      case 'detonate': match.detonate?.(this.id); break;
      case 'skill': if (!match.useSkill(this.id)) throw Error('技能冷却中，或当前状态无法使用'); break;
      case 'use-fork': match.useFork(this.id); break;
      case 'place-banana': match.placeBanana(this.id); break;
      case 'place-smile': match.placeTrap(this.id,'smile'); break;
      case 'training-mod': if (match.practice) match.setTrainingMod(this.id,msg.key,msg.enabled); break;
      case 'training-win': if (match.practice) match.beginTrainingWin(this.id); break;
      case 'drill': if (match.practice && ['map','phase','run','wall','wall3','pillar','house'].includes(msg.mode)) match.setupDrill(this.id,msg.mode); break;
      case 'emote': {
        const p = match.players.find(p => p.id === this.id);
        if (match.state === 'playing' && p.status === 'alive' && /^[tyuiop]$/.test(msg.key)) { p.emote = msg.key; p.emoteUntil = match.time + 3; }
        break;
      }
    }
    this.publish();
  }
}
