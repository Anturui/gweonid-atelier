import { SKILLS, QUESTS, RECIPES, INGREDIENTS, LOOT } from "./data.js?v=10";

const KEY = "gweonid-atelier-v1";
const INSPIRE_MAX = 50;
const CHEST_COST = 50;

function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptySkills() {
  const skills = {};
  for (const s of SKILLS) skills[s.id] = { lv: 0, xp: 0 };
  return skills;
}

function emptyQuests() {
  const q = {};
  for (const quest of QUESTS) q[quest.id] = { done: false, note: "", claimed: false };
  return q;
}

export function defaultState() {
  return {
    name: "Ученик",
    level: 1,
    xp: 0,
    essences: 18,
    streak: 0,
    lastActive: today(),
    lastQuestDay: "",
    inspire: INSPIRE_MAX,
    skills: emptySkills(),
    quests: emptyQuests(),
    smelled: {},
    diary: [],
    crafts: [],
    analyses: [],
    cleanedOn: "",
    skinOn: "",
    letterOn: "",
    dealOn: "",
    bookOn: "",
    bookRead: false,
    coins: 6,
    zone: null,
    location: "hub",
    view: "splash"
  };
}

export function loadState() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    data = null;
  }
  const state = { ...defaultState(), ...(data || {}) };
  if (state.coins == null) state.coins = 0;
  if (!state.zone && state.zone !== null) state.zone = null;
  state.skills = { ...emptySkills(), ...(state.skills || {}) };
  state.quests = { ...emptyQuests(), ...(state.quests || {}) };
  rollDay(state);
  return state;
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(KEY);
  return defaultState();
}

export function dumpSave(state) {
  return JSON.stringify(state);
}

export function applySave(raw) {
  let data;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const next = { ...defaultState(), ...data };
  if (next.coins == null) next.coins = 0;
  if (typeof next.name !== "string") next.name = "Ученик";
  if (typeof next.level !== "number") return null;
  next.skills = { ...emptySkills(), ...(next.skills || {}) };
  next.quests = { ...emptyQuests(), ...(next.quests || {}) };
  next.smelled = next.smelled && typeof next.smelled === "object" ? next.smelled : {};
  next.diary = Array.isArray(next.diary) ? next.diary : [];
  next.crafts = Array.isArray(next.crafts) ? next.crafts : [];
  next.analyses = Array.isArray(next.analyses) ? next.analyses : [];
  rollDay(next);
  return next;
}

function yesterdayOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function anyQuestDone(state) {
  return QUESTS.some((q) => state.quests[q.id]?.claimed);
}

export function rollDay(state) {
  const t = today();
  if (state.lastActive !== t) {
    if (state.lastQuestDay === yesterdayOf(t) && anyQuestDone(state)) {
      state.streak += 1;
    } else if (state.lastActive !== yesterdayOf(t)) {
      state.streak = 0;
    }
    state.lastActive = t;
    state.inspire = INSPIRE_MAX;
    const kept = {};
    for (const quest of QUESTS) {
      if (quest.once && state.quests[quest.id]?.claimed) kept[quest.id] = state.quests[quest.id];
    }
    state.quests = { ...emptyQuests(), ...kept };
    state.cleanedOn = "";
    state.skinOn = "";
    state.letterOn = "";
    state.dealOn = "";
  }
}

export function xpForLevel(level) {
  return 80 + level * 20;
}

export function addXp(state, amount) {
  state.xp += amount;
  let need = xpForLevel(state.level);
  while (state.xp >= need) {
    state.xp -= need;
    state.level += 1;
    state.essences += 8;
    state.inspire = Math.min(INSPIRE_MAX, state.inspire + 10);
    need = xpForLevel(state.level);
  }
}

export function addSkill(state, skillId, amount) {
  const sk = state.skills[skillId];
  if (!sk) return;
  sk.xp += amount;
  while (sk.xp >= 100) {
    sk.xp -= 100;
    sk.lv += 1;
  }
}

export function smelledToday(state) {
  const t = today();
  return Object.values(state.smelled).filter((x) => x.date === t).length;
}

export function newNotesToday(state) {
  const t = today();
  return Object.values(state.smelled).filter((x) => x.date === t && x.first).length;
}

export function diaryToday(state) {
  const t = today();
  return state.diary.filter((x) => x.date === t).length;
}

export function craftsToday(state) {
  const t = today();
  return state.crafts.filter((x) => x.date === t).length;
}

export function groveSmelledToday(state) {
  const t = today();
  return INGREDIENTS.filter((i) => i.loc === "grove" && state.smelled[i.id]?.date === t).length;
}

export function freeCraftsToday(state, minNotes) {
  const t = today();
  return state.crafts.filter((c) => {
    if (c.date !== t || c.recipeId !== "free") return false;
    const n = c.notes || Object.values(c.mix || {}).filter((v) => v > 0).length;
    return n >= minNotes;
  }).length;
}

export function questProgress(state, quest) {
  const need = quest.need;
  if (need.smell) return Math.min(smelledToday(state), need.smell);
  if (need.diary) return Math.min(diaryToday(state), need.diary);
  if (need.diaryTag) {
    return state.diary.some((d) => d.date === today() && d.tag === need.diaryTag) ? 1 : 0;
  }
  if (need.craft) return Math.min(craftsToday(state), need.craft);
  if (need.newNote) return Math.min(newNotesToday(state), need.newNote);
  if (need.skin) return state.skinOn === today() ? 1 : 0;
  if (need.pyramid) return state.analyses.some((a) => a.date === today() && a.kind === "pyramid") ? 1 : 0;
  if (need.clean) return state.cleanedOn === today() ? 1 : 0;
  if (need.groveSmell) return Math.min(groveSmelledToday(state), need.groveSmell);
  if (need.letter) return state.letterOn === today() ? 1 : 0;
  if (need.deal) return state.dealOn === today() ? 1 : 0;
  if (need.freeCraft) return Math.min(freeCraftsToday(state, 2), need.freeCraft);
  if (need.complexCraft) return Math.min(freeCraftsToday(state, 5), need.complexCraft);
  if (need.decode) return state.analyses.some((a) => a.kind === "decode") ? 1 : 0;
  if (need.decodeOst) return state.analyses.some((a) => a.kind === "decodeOst") ? 1 : 0;
  if (need.book) return state.bookRead ? 1 : 0;
  if (need.write) return 0;
  return 0;
}

export function questReady(state, quest) {
  const need = quest.need;
  const key = Object.keys(need)[0];
  return questProgress(state, quest) >= need[key];
}

export function claimQuest(state, questId, note) {
  const quest = QUESTS.find((q) => q.id === questId);
  if (!quest || state.quests[questId].claimed) return { ok: false, reason: "это поручение уже сдано" };
  const ready = questReady(state, quest);
  const text = (note || "").trim();
  if (!ready && text.length < 2) return { ok: false, reason: "напиши ответ, чтобы сдать поручение" };
  state.quests[questId].claimed = true;
  state.quests[questId].done = true;
  state.quests[questId].note = text;
  state.lastQuestDay = today();
  addXp(state, quest.xp);
  addSkill(state, quest.skill, quest.skillXp);
  state.essences += quest.ess;
  state.coins += quest.coins || 0;
  if (text) addDiary(state, quest.title + ": " + text, quest.id);
  return { ok: true };
}

export function saveSmell(state, ingId, text) {
  const first = !state.smelled[ingId];
  state.smelled[ingId] = { text, date: today(), first, revealed: !first };
  return first;
}

export function revealHint(state, ingId) {
  if (!state.smelled[ingId]) return;
  state.smelled[ingId].revealed = true;
}

export function addDiary(state, text, tag) {
  state.diary.unshift({ id: Date.now(), text, date: today(), tag: tag || "" });
}

export function addLetter(state, text) {
  state.letterOn = today();
  state.diary.unshift({ id: Date.now(), text: "Консорциум: " + text, date: today() });
}

export function addDeal(state, text) {
  state.dealOn = today();
  state.diary.unshift({ id: Date.now(), text: "Ку-рара: " + text, date: today() });
}

export function addBook(state, text) {
  state.bookOn = today();
  state.bookRead = true;
  state.diary.unshift({ id: Date.now(), text: "Виндлоу: " + text, date: today() });
  addSkill(state, "notes", 20);
}

export function addCraft(state, recipeId, mix, note, match, notes) {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  const labor = recipe?.labor || 8;
  if (state.inspire < labor) return { ok: false, reason: "не хватает вдохновения" };
  state.inspire -= labor;
  const counted = notes || Object.values(mix || {}).filter((v) => v > 0).length;
  state.crafts.unshift({
    id: Date.now(),
    recipeId: recipeId || "free",
    mix,
    note,
    notes: counted,
    match: !!match,
    date: today()
  });
  addSkill(state, "mix", match ? 20 : 10);
  addXp(state, match ? 12 : 6);
  return { ok: true, match };
}

export function addAnalysis(state, kind, text) {
  state.analyses.unshift({ id: Date.now(), kind, text, date: today() });
  if (kind === "skin") state.skinOn = today();
  addSkill(state, "analysis", 12);
}

export function markClean(state) {
  state.cleanedOn = today();
  addSkill(state, "mix", 6);
}

export function mixMatches(recipe, mix) {
  const keys = new Set([...Object.keys(recipe.drops), ...Object.keys(mix)]);
  for (const k of keys) {
    if ((recipe.drops[k] || 0) !== (mix[k] || 0)) return false;
  }
  return true;
}

export function knownIngredient(state, id) {
  return !!state.smelled[id];
}

export function openChest(state) {
  if (state.essences < CHEST_COST) return { ok: false, reason: "для сундука нужно пятьдесят эссенций" };
  state.essences -= CHEST_COST;
  const drop = LOOT[Math.floor(Math.random() * LOOT.length)];
  if (drop.kind === "skill") addSkill(state, drop.skill, drop.amount);
  if (drop.kind === "xp") addXp(state, drop.amount);
  if (drop.kind === "ess") state.essences += drop.amount;
  if (drop.kind === "inspire") state.inspire = Math.min(INSPIRE_MAX, state.inspire + drop.amount);
  if (drop.kind === "coins") state.coins += drop.amount;
  return { ok: true, drop };
}

export function rename(state, name) {
  const n = name.trim().slice(0, 18);
  if (n) state.name = n;
}

export function ingredientById(id) {
  return INGREDIENTS.find((i) => i.id === id);
}

export { today, INSPIRE_MAX, CHEST_COST };
