// Terrain is deliberate: hard cover blocks blasts, soft gates can be demolished.
// Existing map IDs and original maps remain stable for saved collections.
export function designTacticalMap(map) {
  if(!map.theme)return map;
  const mode=map.mode || 'classic';
  if(mode==='water11') {
    map.description=map.id==='water-reef'?'双礁交叉火线 · 洞口隐蔽绕后 · 侧翼补给':'冰堤单格缺口 · 两岸远路包抄 · 洞口转移';
    map.strategy=map.id==='water-reef'?'礁石阻挡十字爆炸。争夺两侧补给后从洞口换线，避免与水手在中央交叉口硬拼。':'中央缺口路线最短，也最容易被封泡。两侧堤端可以绕行，提前在对岸布泡截击水手。';
    map.supplyNodes=[{x:2,y:6,kind:'guard',interval:30,first:15},{x:12,y:6,kind:'haste',interval:30,first:15}];
    return map;
  }
  if(mode==='bio' && (map.width || 15)<25){map.width=31;map.height=25;map.spawns=[[3,3],[4,3],[3,4],[4,4],[5,3],[3,5],[5,4],[4,5]];}
  const w=map.width || 15,h=map.height || 13,cx=Math.floor(w/2),cy=Math.floor(h/2);
  map.width=w;map.height=h;map.blocks=Array(w*h).fill(0);map.ground=Array(w*h).fill(8011);
  map.structures=mode==='classic'?map.structures:Array(w*h).fill(0);
  map.temporarySpawns=[];map.supplyNodes=[];map.tacticalZones=[];
  const put=(x,y,v=8005)=>{if(x>=0&&y>=0&&x<w&&y<h)map.blocks[y*w+x]=v;};
  const rect=(x,y,rw,rh,v=8005)=>{for(let yy=y;yy<y+rh;yy++)for(let xx=x;xx<x+rw;xx++)put(xx,yy,v);};
  const zone=(x,y,rw,rh,label,type='route')=>map.tacticalZones.push({x,y,w:rw,h:rh,label,type});
  const supply=(x,y,kind,interval=30,first=15)=>{put(x,y,0);map.supplyNodes.push({x,y,kind,interval,first});};
  rect(0,0,w,1);rect(0,h-1,w,1);rect(0,0,1,h);rect(w-1,0,1,h);
  if(mode==='classic'){
    rect(7,1,1,4);
    // Every layout is horizontally symmetric, including resources.
    if(map.id==='garden'){
      for(const y of [6,9]){rect(3,y,3,1);rect(9,y,3,1);}
      rect(6,6,3,1,8001);rect(6,9,3,1,8002);
      zone(6,5,3,6,'可破中路','risk');supply(7,7,'guard',26);supply(2,10,'haste',35);supply(12,10,'haste',35);
      map.description='三路交锋 · 中庭破墙近路 · 对称侧翼加速';map.strategy='上路适合快速抢包；中央两道可破墙炸开后形成近路，也暴露回家线路。下路较远，可拿加速后绕开正面封锁。';
    }else if(map.id==='harbor'){
      rect(1,6,13,1);rect(1,9,13,1);for(const x of [2,7,12]){put(x,6,0);put(x,9,0);}
      put(7,6,8001);put(7,9,8001);zone(6,6,3,4,'中央栈桥','risk');
      supply(4,8,'surge');supply(10,8,'surge');supply(7,11,'guard',36);
      map.description='三桥双堤 · 中桥可炸开 · 岸线包抄';map.strategy='左右桥口是撤退通道。炸开中桥可缩短转线，但在一格桥口停留容易被夹击；两岸补给对称，争夺后可封桥截包。';
    }else if(map.id==='frost'){
      for(const x of [4,10]){rect(x,5,1,6);put(x,7,0);put(x,10,0);put(x,5,8001);}
      rect(6,7,3,1);zone(5,8,5,3,'后侧回廊');supply(2,9,'haste');supply(12,9,'haste');supply(7,5,'guard',26);
      map.description='双门回廊 · 外环撤退 · 破墙侧袭';map.strategy='中央护盾吸引正面争夺，外环距离更远却可绕到包房侧面。两面墙各有双门，放泡封一门后仍需观察另一门。';
    }else if(map.id==='forest-crossing'){
      for(const x of [3,5,9,11]){rect(x,6,1,2);rect(x,10,1,1);}
      rect(6,8,3,1,8001);zone(6,5,3,6,'林间主道');supply(7,6,'guard',28);supply(2,9,'surge');supply(12,9,'surge');
      map.description='林带遮挡 · 主道争盾 · 两翼伏击';map.strategy='成组林柱切断爆炸直线，适合短距离伏击。中央主道更快，两翼强力补给则适合回头拆防线。';
    }else{
      for(const x of [4,10]){rect(x,6,1,5);put(x,8,0);put(x,10,8001);}
      rect(6,6,3,1,8002);rect(6,10,3,1,8002);zone(5,7,5,2,'集市横街');supply(7,8,'guard',25);supply(2,11,'haste',32);supply(12,11,'haste',32);
      map.description='双纵街与横巷 · 摊位可破 · 争夺转线点';map.strategy='横街连接两条纵向路线。封锁中央可拦截回包，炸开南侧摊位则能形成第二条转线通道。';
    }
    for(const b of map.bases)rect(b.x,b.y,b.w,b.h+1,0);
  } else if(mode==='boss'){
    map.supportedModes=['boss'];
    if(map.id==='boss-court'){
      for(const [x,y] of [[4,4],[10,4],[4,8],[10,8]])rect(x,y,1,2);
      zone(5,4,5,5,'开放输出区','risk');map.description='四柱转角躲爆 · 中央输出 · 对角补给';map.strategy='利用四根长柱切断爆炸方向，首领逼近时绕柱换边。中央输出空间最大，但缺少掩体；补给位于相反角落，需安排撤退路线。';
    }else if(map.id==='boss-foundry'){
      for(const y of [4,8]){rect(2,y,5,1);rect(8,y,5,1);put(4,y,8001);put(10,y,8001);}
      zone(6,3,3,7,'十字火线','risk');map.description='三段分区 · 可破侧门 · 十字走廊';map.strategy='硬墙挡住首领泡泡，中央走廊供快速转移。提前炸开侧门可以避免被逼入同一出口，保留墙体则利于遮挡。';
    }else if(map.id==='boss-ring'){
      rect(cx-6,cy-5,13,1);rect(cx-6,cy+5,13,1);rect(cx-6,cy-4,1,9);rect(cx+6,cy-4,1,9);
      for(const x of [cx-1,cx,cx+1]){put(x,cy-5,0);put(x,cy+5,0);}
      rect(cx-6,cy-1,1,3,8001);rect(cx+6,cy-1,1,3,8001);zone(cx-4,cy-3,9,7,'内环决战','risk');
      map.description='内外双环 · 双主门 · 可破侧门';map.strategy='内环便于集中输出，外环适合绕行补给。南北主门是关键转移点；炸开东西侧门能增加逃生口，同时削弱遮挡。';
    }else if(map.id==='boss-caldera'){
      for(const dx of [-5,3])for(const dy of [-4,2])rect(cx+dx,cy+dy,3,3);
      zone(cx-1,2,3,h-4,'锻炉直道','risk');map.description='四炉双向绕行 · 中央交叉火力 · 角落补给';map.strategy='四组锻炉形成绕行闭环。保持顺时针或逆时针移动，利用炉角躲爆；不要在中央十字口停留。';
    }else{
      for(const y of [cy-5,cy+5])for(const x of [cx-8,cx-2,cx+4])rect(x,y,4,1);
      rect(cx-6,cy-2,1,5);rect(cx+6,cy-2,1,5);zone(cx-4,cy-3,9,7,'遗迹空庭','risk');
      map.description='断墙斜向换位 · 双侧支路 · 开阔空庭';map.strategy='断墙之间留有错开的缺口，撤退时需要折线移动。空庭适合布泡，外侧路线适合脱离首领追击。';
    }
    supply(2,h-3,'guard',28,12);supply(w-3,2,'surge',28,12);supply(w-3,h-3,'haste',35,20);
  } else if(mode==='bio'){
    if(map.id==='bio-lab'){
      for(const y of [8,14,20]){rect(1,y,w-2,1);for(const x of [4,15,26]){rect(x,y,2,1,0);}put(10,y,8001);put(21,y,8001);}
      zone(13,7,5,15,'中轴转移');map.description='三段隔离带 · 三处通口 · 可破应急门';map.strategy='隔离带可以阻挡追击，但固定通口也容易被夹击。开局炸开应急门建立横向撤退路线，再选择一段防线布置香蕉和笑脸。';
    }else if(map.id==='bio-maze'){
      for(const x of [9,15,21]){rect(x,2,1,h-4);for(const y of [5,11,19])rect(x,y,1,2,0);put(x,15,8001);}
      for(const [x,y] of [[10,8],[16,14],[22,8]])rect(x,y,4,1);
      zone(10,18,15,3,'长环撤退');map.description='多出口迷宫 · 交错支路 · 炸墙短接';map.strategy='长环适合拖延感染者，交错侧巷适合设陷阱。可破墙是应急近路，不要把所有逃生方向都用泡泡封住。';
    }else if(map.id==='bio-district'){
      for(const x of [10,22,32])for(const y of [8,19]){rect(x,y,6,6);rect(x+1,y+1,4,4,0);put(x+2,y,0);put(x+3,y+5,0);put(x+5,y+2,8001);}
      zone(17,7,3,h-10,'城区干道');map.description='双门街区据点 · 三纵街 · 可破侧墙';map.strategy='每个街区有前后出口，适合短时驻守与撤离。侧墙炸开后可突围，但感染者也能从新缺口进入；主干道更快，却暴露在追击中。';
    }else if(map.id==='bio-forest'){
      for(const x of [10,17,24])for(const y of [5,12,19])rect(x,y,2,3);
      for(const y of [9,16])rect(12,y,10,1,8001);
      zone(8,2,3,h-4,'西侧撤离线');map.description='林柱转角 · 灌木破口 · 宽侧翼撤离';map.strategy='林柱提供转角躲避，灌木带可以炸开形成横向退路。援助物资全图随机出现，离开掩体取物前应确认撤退路线。';
    }else{
      for(const y of [9,17]){rect(1,y,w-2,1);for(const x of [4,16,w-6])rect(x,y,2,1,0);rect(10,y,2,1,8001);}
      rect(13,10,1,6);rect(23,18,1,5);zone(14,3,5,h-6,'矿井换线区');map.description='三层矿道 · 多口封锁 · 支路脱离';map.strategy='分层矿道适合延缓感染者，但必须保留至少一个后撤出口。中央换线区连接各层，适合离开被突破的防线。';
    }
    // A fort with two independent open exits, never a sealed immunity room.
    map.defenseZone={x:1,y:1,w:5,h:5};rect(1,1,5,5,0);rect(6,1,1,6);rect(1,6,6,1);put(6,3,0);put(3,6,0);
    zone(1,1,5,5,'双口防守区','defense');
  }else if(mode==='survivor'){
    if(map.id==='survivor-grove'){
      for(const x of [cx-5,cx+4])for(const y of [cy-4,cy+3])rect(x,y,2,2);
      rect(cx-7,cy,3,1,8001);rect(cx+5,cy,3,1,8001);zone(cx-3,cy-2,7,5,'集结空地');
      map.description='四林柱绕圈 · 可破侧路 · 对角补给轮转';map.strategy='绕四组林柱拖住怪潮，利用转角布泡。中央便于收集经验，但被多方向包围时应转向外圈；补给促使你定期改变路线。';
    }else if(map.id==='survivor-ruins'){
      rect(cx-7,cy-5,15,1);rect(cx-7,cy+5,15,1);rect(cx-7,cy-4,1,9);rect(cx+7,cy-4,1,9);
      rect(cx-1,cy-5,3,1,0);rect(cx-1,cy+5,3,1,0);rect(cx-7,cy-1,1,3,8001);rect(cx+7,cy-1,1,3,8001);
      zone(cx-4,cy-3,9,7,'内庭经验区','risk');map.description='内庭聚怪 · 外环补给 · 破墙突围';map.strategy='在内庭集中击杀便于收经验，但两条主门会形成怪物入口。提前打开侧门能突围，外环补给需要冒险离开内庭。';
    }else{
      for(const y of [cy-5,cy,cy+5]){rect(4,y,w-8,1);for(const x of [7,cx,w-8])rect(x,y,2,1,0);put(4,y,8001);put(w-5,y,8001);}
      zone(1,2,3,h-4,'外围绕行');map.description='三段沙脊 · 交错隘口 · 远侧取补给';map.strategy='沙脊能把怪潮分流，但隘口不宜久守。两端外圈可切换战线，补给分布在不同角落，取物前应避开怪潮汇合的缺口。';
    }
    supply(3,3,'guard',32,12);supply(w-4,h-4,'surge',32,28);supply(w-4,3,'magnet',40,20);supply(3,h-4,'haste',40,36);
  }
  // Spawn areas always have room to move away from a newly placed bubble.
  for(const [x,y] of map.spawns)for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])if(x+dx>0&&x+dx<w-1&&y+dy>0&&y+dy<h-1)put(x+dx,y+dy,0);
  return map;
}
