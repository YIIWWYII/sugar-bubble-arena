import { validateSocial } from './friendship.mjs';
import { freshProfile, publicProfile, ATTRIBUTES, SKILLS, COLLECTION, COLLECTION_MILESTONES } from './progression.mjs';
import { validateAppearance } from './appearance.mjs';

let unsavedProfile = null;
export const LOCAL_SAVE_KEY = 'sugar-bubble-local-v1';
export const localMode = typeof document !== 'undefined' && document.querySelector('meta[name="game-runtime"]')?.content === 'local';

// Only known, validated game fields enter the save. Invalid imports never replace it.
export function validateSave(value) {
  if (value?.game !== 'sugar-bubble-arena' || value.version !== 1 || !value.profile) throw Error('不是有效的糖泡对战存档');
  const source = value.profile, next = freshProfile();
  for (const key of ['coins', 'gems', 'xp', 'matches', 'wins']) {
    if (!Number.isSafeInteger(source[key]) || source[key] < 0) throw Error('存档数值无效');
    next[key] = source[key];
  }
  if (next.wins > next.matches) throw Error('存档对局记录无效');
  next.appearance = validateAppearance(source.appearance);
  if (typeof source.appearanceConfigured !== 'boolean') throw Error('存档角色设置无效');
  next.appearanceConfigured = source.appearanceConfigured;
  for (const [group, catalog] of [['attributes', ATTRIBUTES], ['skills', SKILLS]]) {
    for (const [key, config] of Object.entries(catalog)) {
      const level = source[group]?.[key];
      if (!Number.isInteger(level) || level < 0 || level > (config.max ?? 3)) throw Error('存档技能或属性无效');
      next[group][key] = level;
    }
  }
  if (!Object.hasOwn(SKILLS, source.equipped) || !next.skills[source.equipped]) throw Error('存档已装备技能无效');
  next.equipped = source.equipped;
  next.social = validateSocial(source.social);
  for (const key of ['collection', 'claimed', 'milestones']) {
    const allowed = key === 'milestones' ? COLLECTION_MILESTONES.map(m => m.count) : Object.keys(COLLECTION);
    if (!Array.isArray(source[key]) || source[key].length > allowed.length || source[key].some(v => !allowed.includes(v))) throw Error('存档图鉴数据无效');
    next[key] = [...new Set(source[key])];
  }
  if (next.claimed.some(key => !next.collection.includes(key))) throw Error('存档图鉴领取记录无效');
  return next;
}

export const saveEnvelope = profile => ({game:'sugar-bubble-arena', version:1, profile});
export function readLocalProfile(storage = localStorage) {
  if (typeof localStorage !== "undefined" && storage === localStorage && unsavedProfile) return structuredClone(unsavedProfile);
  const raw = storage.getItem(LOCAL_SAVE_KEY);
  return raw === null ? freshProfile() : validateSave(JSON.parse(raw));
}
export function writeLocalProfile(profile, storage = localStorage, rememberFailure = true) {
  const next = validateSave(saveEnvelope(profile));
  try {
    storage.setItem(LOCAL_SAVE_KEY, JSON.stringify(saveEnvelope(next)));
    if (typeof localStorage !== 'undefined' && storage === localStorage) unsavedProfile = null;
  } catch (error) {
    if (rememberFailure && typeof localStorage !== 'undefined' && storage === localStorage) unsavedProfile = next;
    throw error;
  }
  return publicProfile(next);
}
