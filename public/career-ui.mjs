// 糖泡对战 | 二次开发与维护：WY | 官方项目：https://github.com/YIIWWYII/sugar-bubble-arena | 第三方权利见 NOTICE.md
import { CHARACTERS, characterOf, PROFESSION_TREES, professionRanks } from './characters.mjs';
import {
  APPEARANCE_OPTIONS,
  APPEARANCE_PRESETS,
  hasLargeDecor,
  DEFAULT_APPEARANCE,
  NPC_DESIGNS,
  portraitURL,
} from "./appearance.mjs";
import {
  ATTRIBUTES,
  SKILLS,
  TEMP_ITEMS,
  upgradeCost,
  COLLECTION,
  COLLECTION_MILESTONES,
} from "./progression.mjs";

const lobbyPages = [
  "career-dialog",
  "maps-dialog",
  "rooms-dialog",
  "guide-dialog",
  "appearance-dialog",
  "town-dialog",
  "tea-dialog",
  "account-dialog",
  "manual-dialog",
];
let pageOpener = null;
let sharedNav;
function syncNavigation(active) {
  if (!sharedNav) return;
  const selection = active === 'manual-dialog' ? 'manual-open' : active === 'guide-dialog' ? 'guide-open' : ['town-dialog','tea-dialog'].includes(active) ? 'town-open' : ['career-dialog','appearance-dialog'].includes(active) ? 'career-open' : 'battle-open';
  for (const button of sharedNav.querySelectorAll('button')) {
    button.classList.toggle('nav-current',button.id===selection);
    if(button.id===selection)button.setAttribute('aria-current','page');
    else button.removeAttribute('aria-current');
  }
  sharedNav.hidden = firstDesignRequired;
  if (active) document.getElementById(active).prepend(sharedNav);
  else document.getElementById('home-panel').prepend(sharedNav);
}

let firstDesignRequired = false;
function renderLobbyPage(id) {
  if (id === "friends-dialog") id = "town-dialog";
  if (firstDesignRequired) id = "appearance-dialog";
  const active =
    lobbyPages.includes(id) && document.body.dataset.screen === "home"
      ? id
      : null;
  for (const page of lobbyPages)
    document.getElementById(page).hidden = page !== active;
  if (active) {
    document.body.dataset.lobbyPage = active;
    document.getElementById(active).querySelector("button")?.focus();
  } else {
    delete document.body.dataset.lobbyPage;
    if (document.body.dataset.screen === "home") pageOpener?.focus();
  }
  syncNavigation(active);
  window.dispatchEvent(
    new CustomEvent("lobby-page-change", { detail: active }),
  );
  window.scrollTo(0, 0);
}
export function openLobbyPage(id) {
  if (id === "friends-dialog") id = "town-dialog";
  if (!lobbyPages.includes(id)) return;
  pageOpener = document.activeElement;
  history.pushState(
    { lobbyPage: id, lobbyReturn: true },
    "",
    `#${id.replace("-dialog", "")}`,
  );
  renderLobbyPage(id);
}
export function closeLobbyPage(reset = false) {
  if (!reset && history.state?.lobbyReturn) {
    history.back();
    return;
  }
  history.replaceState(null, "", location.pathname + location.search);
  renderLobbyPage(null);
}
window.addEventListener("popstate", () =>
  renderLobbyPage(history.state?.lobbyPage),
);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.dataset.lobbyPage)
    closeLobbyPage();
});

export function careerUI(manifest, send, images, mapThumbnail) {
  sharedNav = document.querySelector('.lobby-nav');
  document.getElementById('battle-open').onclick = () => closeLobbyPage(true);

  const $ = (id) => document.getElementById(id);
  const initialPage = location.hash === "#friends" ? "town-dialog" : `${location.hash.slice(1)}-dialog`;
  if (lobbyPages.includes(initialPage)) {
    history.replaceState(
      {
        lobbyPage: initialPage,
        lobbyReturn: Boolean(history.state?.lobbyReturn),
      },
      "",
      location.href,
    );
  }
  let profile = null,
    busy = false,
    inRoom = false,
    entryDesign = false,
    savingAppearance = false,
    outfitSaved = false,
    draft = { ...DEFAULT_APPEARANCE };
  let draftCharacter = "sea";
  const portrait = (recipe) =>
    portraitURL(images.get("prince-red-stand-3"), recipe);
  let previewDirection = 3;
  function syncDraft() {
    for (const select of document.querySelectorAll("[data-appearance]"))
      select.value = draft[select.dataset.appearance];
    previewAppearance();
    syncAppearanceSummary();
  }
  function syncAppearanceSummary() {
    const hero = characterOf(draftCharacter);
    $("appearance-selected-character").textContent = hero?.name || "未选择";
    $("appearance-selected-look").textContent = outfitSaved ? "已设置" : "未保存";
  }
  function previewAppearance() {
    const key = `prince-red-stand-${previewDirection}`;
    const image = images.get(key);
    if (!image) {
      console.error('[外观预览] 错误: 图片未找到!');
      return;
    }

    try {
      const url = portraitURL(image, draft, key);
      $("appearance-preview").src = url;
      $("appearance-preview").classList.toggle("decorated", hasLargeDecor(draft));
    } catch (e) {
      console.error('[外观预览] 生成失败:', e.message, e.stack);
    }
  }
  function renderTemplates(){
    $('character-templates').replaceChildren();
    for(const [id,hero] of Object.entries(CHARACTERS)){
      const button=document.createElement('button');button.type='button';button.className='character-template';button.setAttribute('aria-pressed',String(id===draftCharacter));
      button.innerHTML=`<img src="${portrait({...DEFAULT_APPEARANCE,...hero.look})}" alt=""><div><strong>${hero.name}</strong><small>${hero.role}</small><p>速度 ${5+hero.speed} · 泡数 ${2+hero.capacity} · 威力 ${1+hero.power} · 生命 ${5+hero.hp}</p><p>${hero.trait}</p><p>F ${hero.skill} · ${hero.cooldown} 秒冷却<br>${hero.description}</p><span>${hero.bubble}</span></div><b class="character-selected">${id===draftCharacter ? "已选定职业" : "选择职业"}</b>`;
      button.onclick=()=>{draftCharacter=id;draft={...draft,...hero.look};renderTemplates();syncDraft();};$('character-templates').append(button);
    }
  }
  for(const [id,template] of [['template-tab',true],['outfit-tab',false]])$(id).onclick=()=>{
    $('character-templates').hidden=!template;$('outfit-panel').hidden=template;
    $('template-tab').setAttribute('aria-pressed',String(template));$('outfit-tab').setAttribute('aria-pressed',String(!template));
  };
  renderTemplates();
  $("appearance-presets").innerHTML = Object.entries(APPEARANCE_PRESETS)
    .map(
      ([key, preset]) =>
        `<button class="blue-button" data-preset="${key}">${preset.name}</button>`,
    )
    .join("");
  for (const button of document.querySelectorAll("[data-preset]"))
    button.onclick = () => {
      draft = {
        ...DEFAULT_APPEARANCE,
        ...APPEARANCE_PRESETS[button.dataset.preset].value,
      };
      outfitSaved = false;
      syncDraft();
    };
  for (const button of document.querySelectorAll("[data-preview-dir]"))
    button.onclick = () => {
      previewDirection = Number(button.dataset.previewDir);
      for (const other of document.querySelectorAll("[data-preview-dir]"))
        other.setAttribute("aria-pressed", String(other === button));
      previewAppearance();
    };
  $("appearance-random").onclick = () => {
    draft = Object.fromEntries(
      Object.entries(APPEARANCE_OPTIONS).map(([key, option]) => [
        key,
        Math.floor(Math.random() * option.values.length),
      ]),
    );
    outfitSaved = false;
    syncDraft();
  };
  function editAppearance() {
    draftCharacter=profile?.character || "sea"; outfitSaved = Boolean(profile?.appearanceConfigured); renderTemplates();
    draft = entryDesign && !profile?.accountName
      ? { ...DEFAULT_APPEARANCE }
      : { ...DEFAULT_APPEARANCE, ...profile?.appearance };
    previewDirection = 3;
    for (const button of document.querySelectorAll("[data-preview-dir]"))
      button.setAttribute("aria-pressed", String(button.dataset.previewDir === "3"));
    for (const select of document.querySelectorAll("[data-appearance]"))
      select.value = draft[select.dataset.appearance];
    $("appearance-status").textContent = "";
    previewAppearance();
    syncAppearanceSummary();
    openLobbyPage("appearance-dialog");
  }

  // 历史导航返回编辑器时保留当前草稿并恢复预览。
  window.addEventListener("lobby-page-change", (e) => {
    if (e.detail === "appearance-dialog") {
      previewAppearance();
    }
  });
  $("appearance-fields").innerHTML = [
    ["基础造型", ["gender", "hair", "skin", "outfit", "style", "eyes", "mouth"]],
    ["服饰与装备", ["accessory", "back", "held", "shoes"]],
    ["翅膀与坐骑", ["wings", "mount", "aura"]],
  ]
    .map(
      ([name, keys]) =>
        `<fieldset class="appearance-group"><legend>${name}</legend>${keys
          .map((key) => {
            const option = APPEARANCE_OPTIONS[key];
            return `<label>${option.label}<select data-appearance="${key}">${option.values.map((name, index) => `<option value="${index}">${name}</option>`).join("")}</select></label>`;
          })
          .join("")}</fieldset>`,
    )
    .join("");
  for (const select of document.querySelectorAll("[data-appearance]"))
    select.onchange = () => {
      draft[select.dataset.appearance] = Number(select.value);
      outfitSaved = false;
      previewAppearance();
      syncAppearanceSummary();
    };
  $("npc-gallery").innerHTML = Object.values(NPC_DESIGNS)
    .map(
      (recipe) =>
        `<figure><img src="${portrait(recipe)}" alt="${recipe.name}"><figcaption>${recipe.name}</figcaption></figure>`,
    )
    .join("");
  $("appearance-open").onclick = () => {
    entryDesign = false;
    $("close-appearance").textContent = "返回";
    editAppearance();
  };
  $("close-appearance").onclick = () => {
    if (entryDesign) {
      $("appearance-status").textContent = "请点击“保存角色设置”完成首次配置。";
      return;
    }
    else closeLobbyPage();
  };
  function saveAppearance(value) {
    if (
      send({ type: "profile-change", action: { type: "appearance", value, character:draftCharacter } })
    ) {
      savingAppearance = true;
      busy = true;
      $("appearance-role-save").disabled = true;
      $("appearance-status").textContent = "正在保存角色配置…";
    }
  }
  function saveRoleSettings() {
    outfitSaved = true;
    syncAppearanceSummary();
    saveAppearance(draft);
  }
  $("appearance-role-save").onclick = saveRoleSettings;
  $("appearance-save").onclick = () => {
    outfitSaved = true;
    $("appearance-status").textContent = "外观已设置";
    syncAppearanceSummary();
  };
  $("appearance-skip").onclick = () => {
    draft = { ...DEFAULT_APPEARANCE };
    outfitSaved = true;
    syncDraft();
    $("appearance-status").textContent = "已使用默认外观";
  };
  const icon = (key) => {
    const m = manifest[key],
      scale = Math.min(1, 40 / m.w, 46 / m.h);
    return `<span class="career-icon" style="width:${m.w * scale}px;height:${m.h * scale}px;background-image:url('${m.src}');background-size:${m.w * m.frames * scale}px ${m.h * scale}px" aria-hidden="true"></span>`;
  };
  const collectionArt = Object.fromEntries(
    Object.keys(COLLECTION).map((key) => {
      const [kind, id] = key.split(":");
      return [
        key,
        kind === "map"
          ? `<img class="collection-map" src="${mapThumbnail(id)}" alt="">`
          : kind === "enemy"
            ? `<img class="collection-enemy" src="${portrait(NPC_DESIGNS[id === "bot" ? "normal" : id])}" alt="">`
            : icon(TEMP_ITEMS[id].icon),
      ];
    }),
  );
  let collectionFilter = "all";
  for (const button of document.querySelectorAll("[data-collection-filter]"))
    button.onclick = () => {
      collectionFilter = button.dataset.collectionFilter;
      for (const tab of document.querySelectorAll("[data-collection-filter]"))
        tab.setAttribute("aria-pressed", String(tab === button));
      render();
    };
  function render() {
    $("career-summary").textContent = profile
      ? `${profile.matches} 场对局 · ${profile.wins} 场胜利`
      : "正在读取角色档案…";
    $("career-open").disabled = !profile;
    if (!profile) return;
    const hero=characterOf(profile.character),nickname=profile.social?.nickname || '糖友';
    $('hero-player-name').textContent=nickname;$('hero-character-name').textContent=hero.name;
    $('account-open').textContent=`${nickname} · 个人资料`;
    $('town-profile-open').textContent=`${nickname} · 资料`;
    $('nickname').value=nickname;
    document.querySelector('.hero-world').setAttribute('aria-label',hero.name+'角色展示');
    document.querySelector('.hero-character').alt=hero.name;
    const avatar = portrait(profile.appearance);
    document.querySelector(".hero-character").src = avatar;
    document
      .querySelector(".hero-character")
      .classList.toggle("decorated", hasLargeDecor(profile.appearance));
    document.querySelector(".career-hero>img").src = avatar;
    $("appearance-role-save").disabled = busy || inRoom;
    $("appearance-save").disabled = busy || inRoom;
    $("appearance-skip").disabled = busy || inRoom;
    $("collection-summary").textContent =
      `已收集 ${profile.collection.length} / ${Object.keys(COLLECTION).length}`;
    $("collection-milestones").innerHTML = COLLECTION_MILESTONES.map((m) => {
      const claimed = profile.milestones.includes(m.count),
        available = profile.collection.length >= m.count;
      return `<article class="growth-card"><b>${m.count} 项收集 · ${SKILLS[m.skill].name}</b><p>${m.coins} 糖币 / ${m.gems} 技能星 / 限定技能</p><button class="blue-button" data-milestone="${m.count}" ${claimed || !available || busy || inRoom ? "disabled" : ""}>${claimed ? "已领取" : available ? "领取并解锁" : "收集数量不足"}</button></article>`;
    }).join("");
    $("collection-entries").innerHTML = Object.entries(COLLECTION)
      .filter(
        ([key]) =>
          collectionFilter === "all" || key.startsWith(collectionFilter + ":"),
      )
      .map(([key, entry]) => {
        const discovered = profile.collection.includes(key),
          claimed = profile.claimed.includes(key);
        return `<article class="growth-card ${discovered ? "collected" : ""}"><div class="collection-heading">${collectionArt[key]}<b>${entry.name}</b></div><p>${entry.condition}</p><small>${entry.coins} 糖币 / ${entry.gems} 技能星</small><button class="blue-button" data-claim="${key}" ${!discovered || claimed || busy || inRoom ? "disabled" : ""}>${claimed ? "已领取" : discovered ? "领取奖励" : "尚未收集"}</button></article>`;
      })
      .join("");
    $("lobby-wallet").replaceChildren(
      ...[
        ["●", `${profile.coins} 糖币`],
        ["✦", `${profile.gems} 技能星`],
      ].map(([symbol, label]) => {
        const span = document.createElement("span");
        span.className = "wallet-currency";
        const icon = document.createElement("i");
        icon.textContent = symbol;
        span.append(icon, document.createTextNode(label));
        return span;
      }),
    );
    $("hero-level").textContent = `Lv.${profile.level}`;
    $("hero-skill").textContent =
      `${hero.skill} · ${SKILLS[profile.equipped].name}`;
    $("hero-speed").textContent = (5 + hero.speed + profile.attributes.speed * 0.25)
      .toFixed(2)
      .replace(/0$/, "");
    $("hero-capacity").textContent = 2 + hero.capacity + profile.attributes.capacity;
    $("hero-power").textContent = 1 + hero.power + profile.attributes.power;
    $("career-level").textContent = `Lv.${profile.level}`;
    $("career-record").textContent =
      `已完成 ${profile.matches} 局 · 获胜 ${profile.wins} 局`;
    $("career-wallet").textContent =
      `糖币 ${profile.coins}　技能星 ${profile.gems}`;
    $("career-xp").value = profile.xp % 100;
    $("career-xp-label").textContent = `经验 ${profile.xp % 100} / 100`;
    $("career-equipped").textContent =
      `已装备：${SKILLS[profile.equipped].name} Lv.${profile.skills[profile.equipped]}`;
    $("attribute-cards").innerHTML = Object.entries(ATTRIBUTES)
      .map(([key, value]) => {
        const level = profile.attributes[key],
          cost = upgradeCost("attribute", level),
          max = level >= value.max;
        return `<article class="growth-card"><div class="growth-heading">${icon(value.icon)}<div><b>${value.name}</b><span>等级 ${level} / ${value.max}</span></div></div><p>${value.description}</p><button class="blue-button small" data-upgrade="${key}" data-kind="attribute" ${max || inRoom || busy || profile.coins < cost.coins || profile.gems < cost.gems ? "disabled" : ""}>${max ? "已满级" : `升级 · ${cost.coins} 糖币${cost.gems ? ` + ${cost.gems} 星` : ""}`}</button></article>`;
      })
      .join("");
    const ranks=professionRanks(profile);
    $('profession-cards').innerHTML=PROFESSION_TREES[profile.character || 'sea'].map((node,i)=>{
      const level=ranks[i],cost=upgradeCost('skill',level),locked=i>0&&!ranks[i-1];
      return `<article class="growth-card"><b>${i+1}. ${node.name} · Lv.${level}/3</b><p>${node.description}</p><small>${i ? '前置：'+PROFESSION_TREES[profile.character || 'sea'][i-1].name+' Lv.1' : '职业起始节点'}</small><button class="blue-button" data-profession="${i}" ${level>=3||locked||busy||inRoom||profile.coins<cost.coins||profile.gems<cost.gems?'disabled':''}>${level>=3?'已满级':locked?'前置未解锁':cost.coins+' 糖币 + '+cost.gems+' 星'}</button></article>`;
    }).join('');
    $('profession-title').textContent=hero.name+' · '+hero.skill+'技能树（F）';
    $("skill-cards").innerHTML = Object.entries(SKILLS)
      .map(([key, value]) => {
        const level = profile.skills[key],
          cost = upgradeCost("skill", level),
          max = level >= 3,
          equipped = profile.equipped === key;
        return `<article class="growth-card ${equipped ? "equipped" : ""}"><div class="growth-heading">${icon(value.icon)}<div><b>${value.name}</b><span>${level ? `Lv.${level} / 3` : "尚未解锁"}${equipped ? " · 已装备" : ""}</span></div></div><p>${value.description}</p><small>持续 ${value.duration[Math.max(0, level - 1)]} 秒 · 冷却 ${value.cooldown[Math.max(0, level - 1)]} 秒${level && level < 3 ? `<br>下一级：${value.duration[level]} 秒 / 冷却 ${value.cooldown[level]} 秒` : ""}</small><div class="growth-actions"><button class="blue-button small" data-upgrade="${key}" data-kind="skill" ${max || inRoom || busy || (value.limited && !level) || profile.coins < cost.coins || profile.gems < cost.gems ? "disabled" : ""}>${value.limited && !level ? "图鉴限定" : max ? "已满级" : `${level ? "升级" : "解锁"} · ${cost.coins} 币 + ${cost.gems} 星`}</button><button class="practice-button" data-equip="${key}" ${!level || equipped || inRoom || busy ? "disabled" : ""}>${equipped ? "已装备" : "装备"}</button></div></article>`;
      })
      .join("");
    $("career-lock-note").textContent = inRoom
      ? "对局中不能更改养成，请退出房间后操作。"
      : "每次装备一个技能；按 Q 或点击技能按钮使用。升级从下一局生效。";
  }
  $("career-open").onclick = () => {
    openLobbyPage("career-dialog");
    render();
  };
  $("close-career").onclick = () => closeLobbyPage();
  for (const button of document.querySelectorAll("[data-career-tab]"))
    button.onclick = () => {
      for (const tab of document.querySelectorAll("[data-career-tab]"))
        tab.setAttribute("aria-pressed", String(tab === button));
      $("career-attributes").hidden = button.dataset.careerTab !== "attributes";
      $("career-skills").hidden = button.dataset.careerTab !== "skills";
    };
  $("career-dialog").addEventListener("click", (e) => {
    const button = e.target.closest("[data-upgrade],[data-equip],[data-profession]");
    if (!button || button.disabled) return;
    const action = button.hasAttribute("data-profession") ? {type:"profession-upgrade",node:Number(button.dataset.profession)} : button.dataset.equip
      ? { type: "equip", key: button.dataset.equip }
      : {
          type: "upgrade",
          key: button.dataset.upgrade,
          kind: button.dataset.kind,
        };
    if (send({ type: "profile-change", action })) {
      busy = true;
      render();
    }
  });
  $("item-guide").innerHTML = Object.values(TEMP_ITEMS)
    .map(
      (item) =>
        `<article class="growth-card"><div class="growth-heading">${icon(item.icon)}<b>${item.name}</b></div><p>${item.description}。拾取立即生效，重复拾取刷新时间。</p></article>`,
    )
    .join("");
  $("guide-dialog").addEventListener("click", (e) => {
    const button = e.target.closest("[data-claim],[data-milestone]");
    if (!button || button.disabled) return;
    const action = button.dataset.claim
      ? { type: "claim", key: button.dataset.claim }
      : { type: "milestone", count: Number(button.dataset.milestone) };
    if (send({ type: "profile-change", action })) {
      busy = true;
      render();
    }
  });
  $("guide-open").onclick = () => openLobbyPage("guide-dialog");
  $("close-guide").onclick = () => closeLobbyPage();
  $("character-skill-use").onclick = () => send({type:"character-skill"});
  $("skill-use").onclick = () => send({ type: "skill" });
  // 控件与预览监听器就绪后再恢复地址栏指定的页面。
  if (lobbyPages.includes(initialPage)) renderLobbyPage(initialPage);
  return {
    profile(value) {
      const firstProfile = profile === null;
      profile = value;
      busy = false;
      render();
      if (savingAppearance) {
        firstDesignRequired = false;
        savingAppearance = false;
        $("appearance-status").textContent = "外观已保存";
        closeLobbyPage(true);
      } else if (firstProfile && !profile.appearanceConfigured) {
        firstDesignRequired = true;
        entryDesign = true;
        $("close-appearance").textContent = "返回";
        $("appearance-role-save").textContent = "保存角色设置并进入大厅";
        editAppearance();
      }
    },
    error() {
      busy = false;
      if (savingAppearance) {
        savingAppearance = false;
        $("appearance-status").textContent = "保存未完成，请重试";
      }
      render();
    },
    room(value) {
      inRoom = value;
      render();
    },
    reward(value) {
      $("round-reward").textContent = value
        ? `本局获得：${value.coins} 糖币 · ${value.gems} 技能星 · ${value.xp} 经验（${value.saved === false ? "尚未保存，请导出备份" : "已保存"}）`
        : "本局不发放养成资源：练习、提前离开或不足 15 秒的对局不计入。";
    },
    resetReward() {
      $("round-reward").textContent = "对局结束后自动结算资源";
    },
    combat(state, id) {
      const p = state.players.find((p) => p.id === id),
        skill = p && SKILLS[p.skill];
      $("combat-tools").hidden = state.state !== "playing";
      if (!p) return;
      const hero=characterOf(p.character),characterCooldown=Math.max(0,Math.ceil((p.characterReadyAt || 0)-state.time));
      const run=p.run || p.bioBuild;
      const hp=state.mode==='survivor' ? (run?.hp ?? p.hp ?? 0) : (p.hp ?? p.maxHp ?? 0);
      const maxHp=state.mode==='survivor' ? (run?.maxHp ?? p.maxHp ?? 1) : (p.maxHp ?? 0);
      const faction=p.faction==='zombie'?'丧尸':state.mode==='classic'?'无生命值':'人类';
      $("hud-role-mark").textContent=hero.name.slice(0,1);
      $("hud-role-mark").style.background=hero.color;
      $("hud-character-name").textContent=hero.name;
      $("hud-character-role").textContent=hero.role;
      $("hud-character-trait").textContent=`${hero.bubble} · ${hero.trait.split('；')[0]}`;
      $("hud-faction").textContent=faction;
      $("hud-hp-label").textContent=maxHp ? `生命 ${Math.max(0,hp)}/${maxHp}` : '经典 · 无生命值';
      $("hud-hp-fill").style.width=maxHp ? `${Math.max(0,Math.min(100,hp/maxHp*100))}%` : '0%';
      $("hud-hp-fill").style.background=p.faction==='zombie'?'linear-gradient(90deg,#e9536f,#ff9a8f)':maxHp&&hp/maxHp<.35?'linear-gradient(90deg,#f05c65,#ffc261)':'linear-gradient(90deg,#45d890,#b9ef74)';
      $("hud-speed").textContent=`速度 ${(p.speed ?? 5).toFixed(1)}`;
      $("hud-capacity").textContent=`泡泡 ${p.capacity ?? 0}`;
      $("hud-power").textContent=`威力 ${p.power ?? 0}`;
      $("hud-objective-text").textContent=state.objective || '完成当前目标';
      $('character-skill-use').hidden=p.faction==='zombie';
      $('character-skill-use').textContent=`F ${hero.skill} ${characterCooldown ? characterCooldown+'s' : '可用'}`;
      $('character-skill-use').disabled=characterCooldown>0 || p.status!=='alive';
      const cooldown = Math.max(
        0,
        Math.ceil((p.skillReadyAt || 0) - state.time),
      );
      const label =
        p.faction === "zombie"
          ? `Q　突进　${cooldown ? `${cooldown}s` : "可用"}`
          : skill
            ? `Q　${skill.name} Lv.${p.skillLevel}　${cooldown ? `${cooldown}s` : "可用"}`
            : "未装备技能";
      if ($("skill-use").textContent !== label)
        $("skill-use").textContent = label;
      $("skill-use").disabled =
        (p.faction !== "zombie" && !skill) ||
        cooldown > 0 ||
        p.status === "dead" ||
        (p.faction !== "zombie" && p.skill === "rescue" && !["bio", "survivor"].includes(state.mode)
          ? p.status !== "trapped"
          : p.status !== "alive");
      const buffs = [
        ["hasteUntil", "疾风"],
        ["shieldUntil", "护盾"],
        ["surgeUntil", "强力"],
        ["magnetUntil", "磁吸"],
      ]
        .filter(([key]) => p[key] > state.time)
        .map(([key, name]) => `${name} ${Math.ceil(p[key] - state.time)}s`);
      $("buff-status").textContent =
        p.lastAid?.until > state.time
          ? `获得 ${p.lastAid.name}`
          : buffs.join(" · ") ||
            (state.mode === "bio" ? "" : "拾取道具后显示临时增益");
      const record = $("hud-run-record"), recordText = $("hud-run-record-text");
      const acquired = state.mode === "survivor" ? (run?.acquired || []) : [];
      record.hidden = !acquired.length;
      recordText.textContent = acquired.slice(-4).join(" · ");
      $("hud-buff").dataset.empty=String(!$('buff-status').textContent && !acquired.length);
    },
  };
}
