import {
  SKILLS,
  ZONES,
  LOCATIONS,
  INGREDIENTS,
  RECIPES,
  QUESTS,
  CHAPTERS,
  RECIPE_CHAPTERS
} from "./data.js?v=9";
import * as S from "./state.js?v=9";

const app = document.getElementById("app");
const bg = document.getElementById("bg");
const bgNext = document.getElementById("bg-next");

let state = S.loadState();
let ui = {
  questId: QUESTS[0].id,
  recipeId: RECIPES[0].id,
  ingId: INGREDIENTS[0].id,
  mix: {},
  toast: "",
  modal: null,
  allIng: false,
  drafts: {},
  winPos: {}
};

let toastTimer = 0;

function loc() {
  return LOCATIONS.find((l) => l.id === state.location) || LOCATIONS[0];
}

function setBg(src) {
  if (bg.dataset.src === src) return;
  bgNext.style.backgroundImage = `url("${src}")`;
  bgNext.style.opacity = "1";
  window.setTimeout(() => {
    bg.style.backgroundImage = `url("${src}")`;
    bg.dataset.src = src;
    bgNext.style.opacity = "0";
  }, 700);
}

function toast(text) {
  ui.toast = text;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    ui.toast = "";
    draw();
  }, 2600);
  draw();
}

function persist() {
  S.saveState(state);
}

function downloadSave() {
  persist();
  const blob = new Blob([S.dumpSave(state)], { type: "application/json" });
  const a = document.createElement("a");
  const who = String(state.name || "uchenik").replace(/[^\w\u0400-\u04FF-]+/g, "_");
  a.href = URL.createObjectURL(blob);
  a.download = `atelier-${who}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function pickSave() {
  document.getElementById("save-file")?.click();
}

function readSaveFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const next = S.applySave(String(reader.result || ""));
    if (!next) {
      toast("Этот файл не похож на сохранение ателье.");
      return;
    }
    state = next;
    ui = { ...ui, mix: {}, modal: null, questId: QUESTS[0].id, recipeId: RECIPES[0].id };
    persist();
    if (state.view === "splash") go("world");
    else draw();
    toast("Прогресс загружен. Можно играть с любой ссылки loca.lt.");
  };
  reader.readAsText(file);
}

function claimReadyCraftQuests() {
  const ids = ["mix-one", "artisan-mix", "simple-own", "complex-own", "own-simple-table", "own-complex-jars"];
  const done = [];
  for (const id of ids) {
    const q = QUESTS.find((x) => x.id === id);
    if (!q || state.quests[id]?.claimed) continue;
    if (!S.questReady(state, q)) continue;
    const res = S.claimQuest(state, id);
    if (res.ok) done.push(q.title);
  }
  return done;
}

function questPrompt(q) {
  const key = Object.keys(q.need)[0];
  if (key === "letter") return "Чем пахнет лагерь, каких масел нет, почему эссенции разбавляют.";
  if (key === "deal") return "За сколько Ку-рара отдаст мешок.";
  if (key === "craft" || key === "freeCraft" || key === "complexCraft" || key === "write") return "Название смеси и чем она пахнет.";
  if (key === "pyramid" || key === "decode" || key === "decodeOst") return "Верх, сердце, база.";
  if (key === "book") return "Три мысли из тома.";
  if (key === "skin") return "Что осталось на коже.";
  if (key === "clean") return "Стол прибран, что убрал.";
  if (key === "smell" || key === "groveSmell" || key === "newNote") return "Чем пахнет и что слышишь первым.";
  return "Что видишь, чем пахнет, что запомнил.";
}

function ruCount(n, one, few, many) {
  const m = Math.abs(n) % 100;
  const d = m % 10;
  if (m > 10 && m < 20) return `${n} ${many}`;
  if (d === 1) return `${n} ${one}`;
  if (d > 1 && d < 5) return `${n} ${few}`;
  return `${n} ${many}`;
}

function go(view, locationId) {
  if (locationId) state.location = locationId;
  state.view = view;
  persist();
  draw();
}

function skillBarClass(id) {
  if (id === "nose") return "";
  if (id === "mix") return "red";
  if (id === "notes") return "green";
  return "purple";
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function hud() {
  const need = S.xpForLevel(state.level);
  const pct = Math.min(100, (state.xp / need) * 100);
  const ipct = Math.min(100, (state.inspire / S.INSPIRE_MAX) * 100);
  return `
    <header class="hud">
      <div class="hud-left">
        <div class="plate who">
          <div class="sigil">${esc(state.name.slice(0, 1))}</div>
          <div>
            <h1>${esc(state.name)}</h1>
            <div class="meta">уровень ${state.level} · ${esc(loc().name)} · серия ${state.streak} дн.</div>
          </div>
        </div>
        <div class="plate xpwrap">
          <div class="lbl"><span>опыт</span><span>${state.xp} / ${need}</span></div>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>
      </div>
      <div class="hud-right">
        <div class="coins">
          <div class="plate pill"><span class="dot"></span>${state.essences} эссенций</div>
          <div class="plate pill"><span class="dot copper"></span>${state.coins} монет</div>
          <div class="plate pill"><span class="dot teal"></span>вдохн. ${state.inspire}</div>
        </div>
        <div class="plate xpwrap" style="width:220px">
          <div class="lbl"><span>вдохновение</span><span>${state.inspire} / ${S.INSPIRE_MAX}</span></div>
          <div class="bar gold"><i style="width:${ipct}%"></i></div>
        </div>
        <nav class="nav">
          <button data-act="view" data-view="world" class="${state.view === "world" ? "active" : ""}">Карта</button>
          <button data-act="view" data-view="journal" class="${state.view === "journal" ? "active" : ""}">Задания</button>
          <button data-act="view" data-view="craft" class="${state.view === "craft" ? "active" : ""}">Создать</button>
          <button data-act="view" data-view="nose" class="${state.view === "nose" ? "active" : ""}">Нос</button>
          <button data-act="view" data-view="diary" class="${state.view === "diary" ? "active" : ""}">Дневник</button>
          <button data-act="view" data-view="analysis" class="${state.view === "analysis" ? "active" : ""}">Разбор</button>
          <button data-act="view" data-view="character" class="${state.view === "character" ? "active" : ""}">Лист</button>
          <button data-act="view" data-view="chest" class="${state.view === "chest" ? "active" : ""}">Сундук</button>
        </nav>
      </div>
    </header>
  `;
}

function splash() {
  setBg("assets/world/portal.jpg");
  return `
    <section class="splash">
      <div class="plate banner">
        <div class="kicker">Консорциум Синей Соли</div>
        <h1>Ателье Гвинедаля</h1>
        <p>Ремесло алхимии в землях Гвинедаля. Поручения настоящие: нюхать сырьё, вести дневник, собирать пробники. Окна гильдии напоминают старые окна Архейджа.</p>
        <label class="meta">имя ученика</label>
        <input class="field short" id="name-in" value="${esc(state.name)}" maxlength="18" />
        <div class="foot">
          <button class="ghost" data-act="import-save">Загрузить сохранение</button>
          <button class="gold" data-act="enter">Войти в ателье</button>
        </div>
        <div class="foot">
          <button class="ghost" data-act="export-save">Скачать сохранение</button>
          <span></span>
        </div>
      </div>
    </section>
  `;
}

function openQuests() {
  return QUESTS.filter((q) => !state.quests[q.id]?.claimed);
}

function questPin(q, x, y) {
  return `
    <button class="pin qpin" style="left:${x}%;top:${y}%" data-act="quest-go" data-id="${q.id}">
      <div class="bang">!</div>
      <small>${esc(q.title)}</small>
    </button>
  `;
}

function mapBoard(src, pinsHtml) {
  return `
    <div class="mapwrap">
      <div class="mapstage">
        <img src="${src}" alt="">
        ${pinsHtml}
      </div>
    </div>
  `;
}

function continentPins() {
  const ring = {
    gweonid: [
      [-4, -4],
      [4, -3],
      [0, 5]
    ],
    lilyut: [
      [-3, -5],
      [3, 4]
    ],
    solzreed: [
      [-4, -3],
      [-2, 4],
      [2, -2]
    ]
  };
  const byZone = {};
  for (const q of openQuests()) {
    const loc = LOCATIONS.find((l) => l.id === q.loc);
    if (!loc) continue;
    (byZone[loc.zone] ||= []).push(q);
  }
  const zones = ZONES.map((z) => {
    const n = (byZone[z.id] || []).length;
    return `
      <button class="pin zpin" style="left:${z.x}%;top:${z.y}%" data-act="zone" data-id="${z.id}">
        <small>${esc(z.name)} · ${n}!</small>
        <div class="gate"></div>
      </button>
    `;
  }).join("");
  const quests = ZONES.flatMap((z) =>
    (byZone[z.id] || []).slice(0, (ring[z.id] || []).length).map((q, i) => {
      const [dx, dy] = ring[z.id][i];
      return questPin(q, z.x + dx, z.y + dy);
    })
  ).join("");
  return zones + quests;
}

function zonePins(zoneId) {
  const ring = [
    [0, -11],
    [8, -7],
    [-8, -7],
    [10, 2],
    [-10, 2]
  ];
  const places = LOCATIONS.filter((l) => l.zone === zoneId)
    .map((l) => {
      const on = l.id === state.location ? "on" : "";
      return `
        <button class="pin zpin ${on}" style="left:${l.x}%;top:${l.y}%" data-act="travel" data-id="${l.id}">
          <small>${esc(l.name)}</small>
          <div class="gate"></div>
        </button>
      `;
    })
    .join("");
  const counts = {};
  const quests = openQuests()
    .filter((q) => LOCATIONS.find((l) => l.id === q.loc)?.zone === zoneId)
    .map((q) => {
      const loc = LOCATIONS.find((l) => l.id === q.loc);
      const n = counts[loc.id] || 0;
      counts[loc.id] = n + 1;
      const [dx, dy] = ring[n % ring.length];
      return questPin(q, loc.x + dx, loc.y + dy);
    })
    .join("");
  return places + quests;
}

function worldView() {
  if (!state.zone) {
    setBg("assets/maps/nuia.png");
    return `
    <div class="stage">
      <section class="window">
        <div class="whead">
          <div></div>
          <h2>Западный материк</h2>
          <button class="x" data-act="view" data-view="journal">✕</button>
        </div>
        <div class="wbody one">
          ${mapBoard("assets/maps/nuia.png", continentPins())}
        </div>
      </section>
    </div>
  `;
  }
  const zone = ZONES.find((z) => z.id === state.zone) || ZONES[0];
  setBg(zone.bg);
  return `
    <div class="stage">
      <section class="window">
        <div class="whead">
          <div class="tabs"><button class="ghost" data-act="continent">Материк</button></div>
          <h2>${esc(zone.name)}</h2>
          <button class="x" data-act="view" data-view="journal">✕</button>
        </div>
        <div class="wbody one">
          ${mapBoard(zone.map, zonePins(zone.id))}
        </div>
      </section>
    </div>
  `;
}

function journalView() {
  const q = QUESTS.find((x) => x.id === ui.questId) || QUESTS[0];
  const groups = CHAPTERS.map((ch) => {
    const items = QUESTS.filter((x) => x.chapter === ch)
      .map((x) => {
        const st = state.quests[x.id];
        const ready = S.questReady(state, x);
        const mark = st.claimed ? "ok" : "";
        const pay = [
          `<em class="xp">+${x.xp} опыта</em>`,
          `<em class="ess">+${ruCount(x.ess, "эссенция", "эссенции", "эссенций")}</em>`,
          x.coins ? `<em class="coin">+${ruCount(x.coins, "монета", "монеты", "монет")}</em>` : ""
        ].join("");
        return `
          <button class="row ${x.id === q.id ? "on" : ""}" data-act="quest" data-id="${x.id}">
            <i class="mark ${mark}"></i>
            ${x.img ? `<span class="qmini"><img src="${x.img}" alt=""></span>` : ""}
            <span class="qcopy">
              <span>${esc(x.title)}</span>
              <span class="qpay">${pay}</span>
            </span>
            ${ready && !st.claimed ? "<span class='chip'>готово</span>" : ""}
          </button>
        `;
      })
      .join("");
    return `<div class="ch">${esc(ch)}</div>${items}`;
  }).join("");
  const needKey = Object.keys(q.need)[0];
  const have = S.questProgress(state, q);
  const want = q.need[needKey];
  const ready = S.questReady(state, q);
  const claimed = state.quests[q.id].claimed;
  const loc = LOCATIONS.find((l) => l.id === q.loc);
  const locName = loc?.name || "";
  return `
    <div class="stage">
      <section class="window">
        <div class="whead">
          <div class="tabs">
            <button class="tab active">Общие</button>
            <button class="tab" disabled>Сюжет</button>
          </div>
          <h2>Журнал заданий</h2>
          <button class="x" data-act="view" data-view="world">✕</button>
        </div>
        <div class="wbody">
          <div class="list">${groups}<div class="ch">Число заданий: ${QUESTS.length}</div></div>
          <article class="scroll">
            ${q.img ? `<figure class="qhero"><img src="${q.img}" alt=""></figure>` : loc ? `<figure class="qhero"><img src="${loc.bg}" alt=""></figure>` : ""}
            <h3>${esc(q.title)}</h3>
            <div class="reward">
              <span>Награда</span>
              <span class="xp">+${q.xp} опыта</span>
              <span class="ess">+${ruCount(q.ess, "эссенция", "эссенции", "эссенций")}</span>
              ${q.coins ? `<span class="coin">+${ruCount(q.coins, "монета", "монеты", "монет")}</span>` : ""}
              <span>${SKILLS.find((s) => s.id === q.skill).name} +${q.skillXp}</span>
            </div>
            <p class="npc"><b>${esc(q.npc)}:</b> ${esc(q.text)}</p>
            <p class="hint">Напиши ответ и нажми «Сдать задание». Ходить, нюхать и ставить капли не нужно — награда придёт сразу.</p>
            <p class="need">Место: ${esc(locName)} · ${claimed ? "сдано" : ready ? `ход: ${have} / ${want}` : "можно сдать записью"}</p>
            ${
              claimed
                ? state.quests[q.id].note
                  ? `<p class="hint">${esc(state.quests[q.id].note)}</p>`
                  : ""
                : `
            <label class="meta">ответ гильдии</label>
            <textarea class="field" id="quest-note" placeholder="${esc(questPrompt(q))}">${esc(ui.drafts["quest-note"] || "")}</textarea>
                `
            }
            <div class="foot">
              <button class="ghost" data-act="travel" data-id="${q.loc}">Идти к месту</button>
              <button class="gold" data-act="claim" data-id="${q.id}" ${claimed ? "disabled" : ""}>
                ${claimed ? "Сдано" : "Сдать задание"}
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  `;
}

function craftView() {
  const r = RECIPES.find((x) => x.id === ui.recipeId) || RECIPES[0];
  const groups = RECIPE_CHAPTERS.map((ch) => {
    const items = RECIPES.filter((x) => x.chapter === ch)
      .map((x) => {
        return `
          <button class="row ${x.id === r.id ? "on" : ""}" data-act="recipe" data-id="${x.id}">
            <i class="mark ${state.crafts.some((c) => c.recipeId === x.id && c.match) ? "ok" : ""}"></i>
            <span>${esc(x.name)}</span>
          </button>
        `;
      })
      .join("");
    return `<div class="ch">${esc(ch)}</div>${items}`;
  }).join("");
  const keys = r.drops ? Object.keys(r.drops) : [];
  const slots = Object.entries(r.drops || {})
    .map(([id, n]) => {
      const ing = S.ingredientById(id);
      const put = ui.mix[id] || 0;
      const ok = put === n;
      return `
        <div class="slot">
          <div class="ico">${esc(ing.name.slice(0, 2))}</div>
          <div>${esc(ing.name)}</div>
          <div class="frac ${ok ? "ok" : "bad"}">${put}/${n}</div>
        </div>
      `;
    })
    .join("");
  const mixRows = keys
    .map((id) => {
      const ing = S.ingredientById(id);
      return `
        <div class="mixrow">
          <span>${esc(ing.name)}</span>
          <button data-act="drop" data-id="${id}" data-d="-1">-</button>
          <b>${ui.mix[id] || 0}</b>
          <button data-act="drop" data-id="${id}" data-d="1">+</button>
        </div>
      `;
    })
    .join("");
  const total = Object.values(ui.mix).reduce((a, b) => a + b, 0);
  const named = !r.drops;
  return `
    <div class="stage">
      <section class="window">
        <div class="whead">
          <div></div>
          <h2>Создать</h2>
          <button class="x" data-act="view" data-view="world">✕</button>
        </div>
        <div class="wbody">
          <div class="list">${groups}</div>
          <article class="scroll">
            <h3>${esc(r.name)}</h3>
            <p class="npc">${esc(r.lore)}</p>
            ${
              named
                ? `
            <p class="hint">Напиши название смеси и нажми «Записать смесь». Плюсы и капли не нужны — поручение сдастся сразу.</p>
            <div class="need">Вдохновение ${r.labor}</div>
            <label class="meta">название смеси</label>
            <textarea class="field" id="craft-note" placeholder="Например: вербена и мелисса">${esc(ui.drafts["craft-note"] || "")}</textarea>
            <label class="tick"><input type="checkbox" id="craft-complex"> Это сложный этюд — пять нот и больше</label>
            <div class="foot">
              <span></span>
              <button class="gold" data-act="craft">Записать смесь</button>
            </div>
                `
                : `
            <p class="hint">Плюсами расставь капли или нажми «Поставить по рецепту». Потом «Записать смесь» — поручение Энота засчитается сразу.</p>
            <div class="need">Вдохновение ${r.labor} · капель ${total} / 10</div>
            <div class="slots">${slots}</div>
            <div class="mixer">${mixRows}</div>
            <label class="meta">как пахнет смесь</label>
            <textarea class="field" id="craft-note" placeholder="Необязательно: чем пахнет бумага.">${esc(ui.drafts["craft-note"] || "")}</textarea>
            <div class="foot">
              <button class="ghost" data-act="fill-recipe">Поставить по рецепту</button>
              <button class="gold" data-act="craft">Записать смесь</button>
            </div>
            <div class="foot"><button class="ghost" data-act="clear-mix">Начать смесь заново</button><span></span></div>
                `
            }
          </article>
        </div>
      </section>
    </div>
  `;
}

function noseView() {
  const here = ui.allIng ? INGREDIENTS : INGREDIENTS.filter((i) => i.loc === state.location);
  const pool = here.length ? here : INGREDIENTS;
  const ing = INGREDIENTS.find((x) => x.id === ui.ingId) || pool[0];
  ui.ingId = ing.id;
  const rec = state.smelled[ing.id];
  const list = pool
    .map((x) => {
      return `
        <button class="row ${x.id === ing.id ? "on" : ""}" data-act="ing" data-id="${x.id}">
          <i class="mark ${state.smelled[x.id] ? "ok" : ""}"></i>
          <span>${esc(x.name)}</span>
        </button>
      `;
    })
    .join("");
  return `
    <div class="stage">
      <section class="window">
        <div class="whead">
          <div></div>
          <h2>Стол алхимика</h2>
          <button class="x" data-act="view" data-view="world">✕</button>
        </div>
        <div class="wbody">
          <div class="list">
            <div class="ch">${ui.allIng || !INGREDIENTS.some((i) => i.loc === state.location) ? "весь каталог" : esc(loc().name)}</div>
            ${list}
            ${ui.allIng ? "" : `<button class="row" data-act="all-ing">Показать весь каталог</button>`}
          </div>
          <article class="scroll">
            <h3>${esc(ing.name)}</h3>
            <div class="chips">
              <span class="chip">${esc(ing.family)}</span>
              <span class="chip">${esc(ing.layer)}</span>
            </div>
            <p class="npc">Открой флакон или каплю на бумаге и пиши своими словами. Запись гильдии откроется после первой пробы.</p>
            <textarea class="field" id="smell-note" placeholder="На бумаге: ... На коже: ... Ассоциация: ...">${esc(ui.drafts["smell-note"] && ui.ingId === ing.id ? ui.drafts["smell-note"] : rec?.text || "")}</textarea>
            ${
              rec?.revealed
                ? `<div class="hint"><b>Запись гильдии.</b> ${esc(ing.hint)}</div>`
                : rec
                  ? `<button class="ghost" data-act="reveal" data-id="${ing.id}">Открыть запись гильдии</button>`
                  : ""
            }
            <div class="foot">
              <span class="need">сегодня проб: ${S.smelledToday(state)}</span>
              <button class="gold" data-act="smell" data-id="${ing.id}">Записать ощущение</button>
            </div>
          </article>
        </div>
      </section>
    </div>
  `;
}

function diaryView() {
  const items = state.diary.length
    ? state.diary
        .map((d) => `<div class="diary-item"><time>${esc(d.date)}</time><p>${esc(d.text)}</p></div>`)
        .join("")
    : `<p class="need">Страницы ещё пусты. Одна честная запись дороже десяти чужих формул.</p>`;
  return `
    <div class="stage">
      <section class="window mid">
        <div class="whead">
          <div></div>
          <h2>Парфюмерный дневник</h2>
          <button class="x" data-act="view" data-view="world">✕</button>
        </div>
        <div class="wbody one">
          <article class="scroll">
            <textarea class="field" id="diary-note" placeholder="Что нюхал, где стоял и как запах изменился. Для письма: чем пахнет лагерь, каких масел нет, почему Ку-рара думает, что эссенции разбавляют.">${esc(ui.drafts["diary-note"] || "")}</textarea>
            <div class="foot">
              <span class="need">записей сегодня: ${S.diaryToday(state)}</span>
              <button class="gold" data-act="diary">Внести наблюдение</button>
            </div>
            <div class="foot">
              <button class="ghost" data-act="letter">Письмо Консорциуму</button>
              <button class="ghost" data-act="deal">Торг с Ку-рара</button>
            </div>
            ${items}
          </article>
        </div>
      </section>
    </div>
  `;
}

function bookView() {
  return `
    <div class="stage">
      <section class="window mid">
        <div class="whead">
          <div></div>
          <h2>Книга Виндлоу</h2>
          <button class="x" data-act="view" data-view="world">✕</button>
        </div>
        <div class="wbody one">
          <article class="scroll">
            <p class="npc"><b>Хранитель пюпитра:</b> Прочти вживую главу о нотах, пирамиде или истории духов и законспектируй её своими словами. Том Виндлоу не покидает.</p>
            <textarea class="field" id="book-note" placeholder="Какую книгу открыл, какие три мысли унёс, с чем не согласен.">${esc(ui.drafts["book-note"] || "")}</textarea>
            <div class="foot">
              <span class="need">${state.bookRead ? "конспект уже сдан" : "большое поручение, сдаётся однажды"}</span>
              <button class="gold" data-act="book" ${state.bookRead ? "disabled" : ""}>Законспектировать</button>
            </div>
          </article>
        </div>
      </section>
    </div>
  `;
}

function analysisView() {
  return `
    <div class="stage">
      <section class="window mid">
        <div class="whead">
          <div></div>
          <h2>Разбор аромата</h2>
          <button class="x" data-act="view" data-view="world">✕</button>
        </div>
        <div class="wbody one">
          <article class="scroll">
            <p class="npc"><b>Энот:</b> Кожа и время — для своего пробника. Пирамида — для любого флакона. Ниже — чужие города: Марианополь и Ост-Терра.</p>
            <label class="meta">проба на коже — через два часа допиши шлейф</label>
            <textarea class="field" id="skin-note" placeholder="Нанёс в 00:00. Сейчас: ... Через 2 часа: ...">${esc(ui.drafts["skin-note"] || "")}</textarea>
            <div class="foot">
              <span class="need">${state.skinOn === S.today() ? "кожа отмечена сегодня" : "ещё не сдано"}</span>
              <button class="gold" data-act="skin">Записать кожу</button>
            </div>
            <label class="meta">чужой аромат — пирамида</label>
            <textarea class="field" id="pyr-note" placeholder="Верх: ... Сердце: ... База: ... Что угадал / не угадал.">${esc(ui.drafts["pyr-note"] || "")}</textarea>
            <div class="foot">
              <span></span>
              <button class="gold" data-act="pyramid">Разобрать пирамиду</button>
            </div>
            <label class="meta">рецептура из Марианополя</label>
            <textarea class="field" id="dec-note" placeholder="Флакон: ... Верх: ... Сердце: ... База: ... чего больше.">${esc(ui.drafts["dec-note"] || "")}</textarea>
            <div class="foot">
              <span></span>
              <button class="gold" data-act="decode">Раскрыть Марианополь</button>
            </div>
            <label class="meta">рецептура из Ост-Терры</label>
            <textarea class="field" id="ost-note" placeholder="Чем не похож на марианопольский. Верх / сердце / база.">${esc(ui.drafts["ost-note"] || "")}</textarea>
            <div class="foot">
              <span></span>
              <button class="gold" data-act="decode-ost">Раскрыть Ост-Терру</button>
            </div>
            <div class="foot">
              <span class="need">стол после смены</span>
              <button class="ghost" data-act="clean">${state.cleanedOn === S.today() ? "Стол уже прибран" : "Стол прибран"}</button>
            </div>
          </article>
        </div>
      </section>
    </div>
  `;
}

function characterView() {
  const skills = SKILLS.map((s) => {
    const sk = state.skills[s.id];
    return `
      <div class="plate skill">
        <div class="top"><span>${esc(s.name)}</span><span>ур. ${sk.lv}</span></div>
        <div class="bar ${skillBarClass(s.id)}"><i style="width:${sk.xp}%"></i></div>
      </div>
    `;
  }).join("");
  return `
    <div class="stage">
      <section class="window narrow">
        <div class="whead">
          <div></div>
          <h2>Характеристики</h2>
          <button class="x" data-act="view" data-view="world">✕</button>
        </div>
        <div class="wbody one">
          <article class="scroll">
            <div class="statline"><span>Имя</span><span>${esc(state.name)}</span></div>
            <div class="statline"><span>Уровень</span><span class="num">${state.level}</span></div>
            <div class="statline"><span>Класс</span><span>Алхимик Консорциума</span></div>
            <div class="statline"><span>Эссенции</span><span class="num">${state.essences}</span></div>
            <div class="statline"><span>Монеты</span><span class="num">${state.coins}</span></div>
            <div class="statline"><span>Вдохновение</span><span class="num">${state.inspire} / ${S.INSPIRE_MAX}</span></div>
            <div class="statline"><span>Серия дней</span><span class="num">${state.streak}</span></div>
            <div class="statline"><span>Изучено нот</span><span class="num">${Object.keys(state.smelled).length}</span></div>
            <div class="statline"><span>Собрано пробников</span><span class="num">${state.crafts.length}</span></div>
            <div class="ch">Навыки</div>
            <div class="grid2">${skills}</div>
          </article>
        </div>
      </section>
    </div>
  `;
}

function chestView() {
  return `
    <div class="stage">
      <section class="window narrow">
        <div class="whead">
          <div></div>
          <h2>Алхимический сундук</h2>
          <button class="x" data-act="view" data-view="world">✕</button>
        </div>
        <div class="wbody one">
          <article class="scroll">
            <p class="npc"><b>Ку-рара:</b> Пятьдесят эссенций — и я открою сундук. Внутри случайный подарок: опыт, навык, вдохновение или монеты. Формулу отсюда не жди, только удачу. Я дару: улыбаюсь всегда, торгуюсь отдельно.</p>
            <div class="foot">
              <span class="need">у тебя ${state.essences} эсс.</span>
              <button class="gold" data-act="chest" ${state.essences < S.CHEST_COST ? "disabled" : ""}>Открыть за 50 эссенций</button>
            </div>
          </article>
        </div>
      </section>
    </div>
  `;
}

function modalHtml() {
  if (!ui.modal) return "";
  return `
    <div class="modal">
      <section class="window narrow">
        <div class="whead"><div></div><h2>${esc(ui.modal.title)}</h2><button class="x" data-act="close-modal">✕</button></div>
        <div class="wbody one"><article class="scroll"><p class="npc">${esc(ui.modal.text)}</p>
          <div class="foot"><span></span><button class="gold" data-act="close-modal">Закрыть</button></div>
        </article></div>
      </section>
    </div>
  `;
}

function draw() {
  S.rollDay(state);
  if (state.view !== "splash" && state.view !== "world") {
    setBg(loc().bg);
  }
  if (state.view === "splash") {
    app.innerHTML = splash();
    return;
  }
  const views = {
    world: worldView,
    journal: journalView,
    craft: craftView,
    nose: noseView,
    diary: diaryView,
    book: bookView,
    analysis: analysisView,
    character: characterView,
    chest: chestView
  };
  const body = (views[state.view] || worldView)();
  app.innerHTML = `
    ${hud()}
    ${body}
    ${ui.toast ? `<div class="plate toast">${esc(ui.toast)}</div>` : ""}
    ${modalHtml()}
    <div class="saves">
      <button class="reset" data-act="export-save">Скачать сохранение</button>
      <button class="reset" data-act="import-save">Загрузить сохранение</button>
      <button class="reset" data-act="reset">Сбросить прогресс</button>
    </div>
  `;
  bindWindows();
}

function val(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function snapDrafts() {
  for (const id of ["craft-note", "smell-note", "diary-note", "skin-note", "pyr-note", "dec-note", "ost-note", "book-note", "name-in", "quest-note"]) {
    const el = document.getElementById(id);
    if (el) ui.drafts[id] = el.value;
  }
}

function bindWindows() {
  const wins = app.querySelectorAll(".window");
  wins.forEach((win, idx) => {
    const key = state.view + (win.closest(".modal") ? "-modal" : "") + idx;
    const saved = ui.winPos[key];
    if (saved) {
      win.classList.add("moved");
      win.style.left = saved.x + "px";
      win.style.top = saved.y + "px";
    }
    const head = win.querySelector(".whead");
    if (!head) return;
    head.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button")) return;
      const r = win.getBoundingClientRect();
      win.classList.add("moved", "dragging");
      win.style.left = r.left + "px";
      win.style.top = r.top + "px";
      win.style.width = r.width + "px";
      const ox = e.clientX - r.left;
      const oy = e.clientY - r.top;
      const move = (ev) => {
        const x = Math.max(8, ev.clientX - ox);
        const y = Math.max(8, ev.clientY - oy);
        win.style.left = x + "px";
        win.style.top = y + "px";
        ui.winPos[key] = { x, y };
      };
      const up = () => {
        win.classList.remove("dragging");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  });
}

app.addEventListener("click", (e) => {
  snapDrafts();
  const t = e.target.closest("[data-act]");
  if (!t) return;
  const act = t.dataset.act;
  if (act === "enter") {
    const n = document.getElementById("name-in")?.value || state.name;
    S.rename(state, n);
    state.zone = null;
    go("world");
    toast("Врата открыты. Консорциум Синей Соли ждёт своего алхимика.");
    return;
  }
  if (act === "view") {
    go(t.dataset.view);
    return;
  }
  if (act === "zone") {
    state.zone = t.dataset.id;
    persist();
    draw();
    const z = ZONES.find((x) => x.id === t.dataset.id);
    toast(z.blurb);
    return;
  }
  if (act === "continent") {
    state.zone = null;
    persist();
    draw();
    return;
  }
  if (act === "travel") {
    const place = LOCATIONS.find((l) => l.id === t.dataset.id);
    ui.allIng = false;
    state.location = place.id;
    state.zone = place.zone;
    const next = place.views[0] || "journal";
    persist();
    go(next);
    toast(`${place.name}. ${place.blurb}`);
    return;
  }
  if (act === "quest") {
    if (ui.questId !== t.dataset.id) ui.drafts["quest-note"] = "";
    ui.questId = t.dataset.id;
    draw();
    return;
  }
  if (act === "quest-go") {
    const q = QUESTS.find((x) => x.id === t.dataset.id);
    const place = LOCATIONS.find((l) => l.id === q.loc);
    ui.questId = q.id;
    state.location = place.id;
    state.zone = place.zone;
    persist();
    go("journal");
    toast(`${place.name}. ${q.title}`);
    return;
  }
  if (act === "claim") {
    const note = val("quest-note");
    const q = QUESTS.find((x) => x.id === t.dataset.id);
    const res = S.claimQuest(state, t.dataset.id, note);
    persist();
    if (!res.ok) {
      toast(res.reason);
      draw();
      return;
    }
    ui.drafts["quest-note"] = "";
    ui.modal = {
      title: "Поручение сдано",
      text: `${q.title}. Опыт, эссенции и монеты уже на листе.`
    };
    draw();
    return;
  }
  if (act === "recipe") {
    ui.recipeId = t.dataset.id;
    ui.mix = {};
    draw();
    return;
  }
  if (act === "drop") {
    const id = t.dataset.id;
    const d = Number(t.dataset.d);
    const now = ui.mix[id] || 0;
    const total = Object.values(ui.mix).reduce((a, b) => a + b, 0);
    const rec = RECIPES.find((x) => x.id === ui.recipeId);
    const cap = rec?.drops ? 10 : 16;
    if (d > 0 && total >= cap) return;
    ui.mix[id] = Math.max(0, now + d);
    draw();
    return;
  }
  if (act === "clear-mix") {
    ui.mix = {};
    draw();
    return;
  }
  if (act === "fill-recipe") {
    const rec = RECIPES.find((x) => x.id === ui.recipeId);
    if (!rec?.drops) return;
    ui.mix = { ...rec.drops };
    draw();
    return;
  }
  if (act === "craft") {
    const r = RECIPES.find((x) => x.id === ui.recipeId);
    const note = (val("craft-note") || "").trim();
    if (!r.drops) {
      if (note.length < 2) {
        toast("Напиши название смеси — этого достаточно, чтобы сдать этюд.");
        return;
      }
      const complex = !!document.getElementById("craft-complex")?.checked;
      const res = S.addCraft(state, "free", {}, note, false, complex ? 5 : 2);
      if (!res.ok) {
        toast(res.reason);
        return;
      }
      const done = claimReadyCraftQuests();
      persist();
      ui.drafts["craft-note"] = "";
      ui.modal = {
        title: complex ? "Сложный этюд записан" : "Смесь записана",
        text: done.length
          ? `Поручение сдано: ${done.join(", ")}.`
          : complex
            ? "Сложный этюд записан. Если есть отдельное поручение — оно уже готово."
            : "Свой этюд записан по названию."
      };
      draw();
      return;
    }
    const craftNote = note || "Смешал по формуле, понюхал с бумаги.";
    const total = Object.values(ui.mix).reduce((a, b) => a + b, 0);
    if (total < 1) {
      toast("Поставь капли плюсами или нажми «Поставить по рецепту».");
      return;
    }
    const match = S.mixMatches(r, ui.mix);
    const res = S.addCraft(state, r.id, { ...ui.mix }, craftNote, match);
    if (!res.ok) {
      toast(res.reason);
      return;
    }
    const done = claimReadyCraftQuests();
    persist();
    ui.modal = {
      title: match ? "Смесь записана" : "Смесь записана иначе",
      text: done.length
        ? `Поручение сдано: ${done.join(", ")}.`
        : match
          ? `${r.name} совпал с каплями гильдии.`
          : "Капли не совпали с рецептом, но смесь всё равно записана."
    };
    draw();
    return;
  }
  if (act === "ing") {
    ui.drafts["smell-note"] = "";
    ui.ingId = t.dataset.id;
    draw();
    return;
  }
  if (act === "all-ing") {
    ui.allIng = true;
    draw();
    return;
  }
  if (act === "smell") {
    const text = val("smell-note");
    if (text.length < 8) {
      toast("Напиши ощущение своими словами, хотя бы одну строку.");
      return;
    }
    const first = S.saveSmell(state, t.dataset.id, text);
    persist();
    toast(first ? "Новая нота внесена в каталог." : "Запись обновлена.");
    draw();
    return;
  }
  if (act === "reveal") {
    S.revealHint(state, t.dataset.id);
    persist();
    draw();
    return;
  }
  if (act === "letter") {
    const text = val("diary-note");
    if (text.length < 8) {
      toast("Напиши отчёт Консорциуму в поле дневника.");
      return;
    }
    S.addLetter(state, text);
    persist();
    toast("Письмо ушло в Консорциум Синей Соли.");
    draw();
    return;
  }
  if (act === "deal") {
    const text = val("diary-note");
    if (text.length < 8) {
      toast("Запиши условия торга с Ку-рара.");
      return;
    }
    S.addDeal(state, text);
    persist();
      toast("Ку-рара кивнул. Сделка записана в журнале.");
    draw();
    return;
  }
  if (act === "book") {
    const text = val("book-note");
    if (text.length < 20) {
      toast("Конспект короче главы. Напиши своими словами.");
      return;
    }
    S.addBook(state, text);
    persist();
    toast("Том закрыт. Виндлоу засчитал чтение.");
    draw();
    return;
  }
  if (act === "decode") {
    const text = val("dec-note");
    if (text.length < 8) {
      toast("Разложи чужой марианопольский флакон.");
      return;
    }
    S.addAnalysis(state, "decode", text);
    persist();
    toast("Рецептура из Марианополя внесена в журнал.");
    draw();
    return;
  }
  if (act === "decode-ost") {
    const text = val("ost-note");
    if (text.length < 8) {
      toast("Разложи флакон Ост-Терры.");
      return;
    }
    S.addAnalysis(state, "decodeOst", text);
    persist();
    toast("Рецептура из Ост-Терры внесена в журнал.");
    draw();
    return;
  }
  if (act === "diary") {
    const text = val("diary-note");
    if (text.length < 8) {
      toast("Нужна хотя бы одна живая фраза.");
      return;
    }
    S.addDiary(state, text, state.location);
    persist();
    toast("Страница дневника закрыта.");
    draw();
    return;
  }
  if (act === "skin") {
    const text = val("skin-note");
    if (text.length < 8) {
      toast("Напиши, что осталось на коже.");
      return;
    }
    S.addAnalysis(state, "skin", text);
    persist();
    toast("Кожа записана. Если два часа ещё не прошли — допиши шлейф позже в дневнике.");
    draw();
    return;
  }
  if (act === "pyramid") {
    const text = val("pyr-note");
    if (text.length < 8) {
      toast("Разложи аромат на верх, сердце и базу.");
      return;
    }
    S.addAnalysis(state, "pyramid", text);
    persist();
    toast("Пирамида внесена в журнал.");
    draw();
    return;
  }
  if (act === "clean") {
    S.markClean(state);
    persist();
    toast("Стол снова нейтрален. Нос может верить себе.");
    draw();
    return;
  }
  if (act === "chest") {
    const res = S.openChest(state);
    persist();
    if (!res.ok) toast(res.reason);
    else {
      ui.modal = { title: "Сундук Ку-рара", text: res.drop.label };
      draw();
    }
    return;
  }
  if (act === "close-modal") {
    ui.modal = null;
    draw();
    return;
  }
  if (act === "export-save") {
    downloadSave();
    toast("Файл сохранения скачан. Держи его у себя, туннель его не хранит.");
    return;
  }
  if (act === "import-save") {
    pickSave();
    return;
  }
  if (act === "reset") {
    state = S.resetState();
    ui = { ...ui, mix: {}, modal: null, questId: QUESTS[0].id, recipeId: RECIPES[0].id };
    persist();
    go("splash");
    return;
  }
});

document.getElementById("save-file")?.addEventListener("change", (ev) => {
  const file = ev.target.files?.[0];
  ev.target.value = "";
  readSaveFile(file);
});

draw();
