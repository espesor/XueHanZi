/** 「复习老字」的选择弹窗：抽查复习 / 按级复习。见 DESIGN.md §4.6。 */
import { levelBuckets } from "../progress";
import { SPOT_CHECK_SIZE } from "../srs";
import type { Store } from "../store";
import type { ReviewScope } from "../types";
import { clear, el } from "./dom";
import { createModal, type Modal } from "./modal";

let modal: Modal | null = null;
let title: HTMLElement;
let backBtn: HTMLButtonElement;
let mainScreen: HTMLElement;
let levelScreen: HTMLElement;
let spotHint: HTMLElement;
let levelHint: HTMLElement;
let levelList: HTMLElement;

function build(): Modal {
  const m = createModal({ label: "关闭" });

  backBtn = el("button", {
    class: "linkish",
    type: "button",
    text: "‹ 返回",
    hidden: true,
    onclick: () => showMain(),
  });
  title = el("h2", { class: "picker-title" });

  spotHint = el("span", { class: "btn-hint" });
  levelHint = el("span", { class: "btn-hint" });
  const btnSpot = el(
    "button",
    { class: "btn", type: "button", onclick: () => pick({ kind: "spot" }) },
    el("span", { class: "btn-ch", text: "抽" }),
    "抽查复习",
    spotHint,
  );
  const btnLevel = el(
    "button",
    { class: "btn", type: "button", onclick: () => showLevels() },
    el("span", { class: "btn-ch", text: "级" }),
    "按级复习",
    levelHint,
  );

  mainScreen = el(
    "div",
    { class: "picker-screen" },
    btnSpot,
    btnLevel,
    el("p", {
      class: "note",
      text: "抽查会先出「继续学」的字，字数少的话基本等于全过一遍；字数多了也不会一次太长。按级复习只过某一级学过的字。",
    }),
  );

  levelList = el("div", { class: "level-list" });
  levelScreen = el("div", { class: "picker-screen", hidden: true }, levelList);

  // 返回键放进已有的 sheet-top，挤在关闭键左边
  m.body.querySelector(".sheet-top")?.prepend(backBtn);
  m.body.appendChild(el("div", { class: "sheet-body picker-body" }, title, mainScreen, levelScreen));
  return m;
}

function showMain(): void {
  title.textContent = "复习老字";
  backBtn.hidden = true;
  mainScreen.hidden = false;
  levelScreen.hidden = true;
}

function showLevels(): void {
  title.textContent = "按级复习";
  backBtn.hidden = false;
  mainScreen.hidden = true;
  levelScreen.hidden = false;
}

let pick: (scope: ReviewScope) => void = () => {};

export function openReviewPicker(store: Store, onPick: (scope: ReviewScope) => void): void {
  modal ??= build();
  pick = (scope) => {
    modal?.close();
    onPick(scope);
  };

  const learned = store.learned;
  spotHint.textContent = `过 ${Math.min(SPOT_CHECK_SIZE, learned)} 个字`;

  const buckets = levelBuckets(store.cards, store.dict.levelSize);
  const highest = buckets.at(-1)?.level ?? null;
  levelHint.textContent = highest !== null ? `已学到第 ${highest} 级` : "还没开始";

  clear(levelList);
  for (const b of [...buckets].reverse()) {
    levelList.appendChild(
      el(
        "button",
        { class: "level-row", type: "button", onclick: () => pick({ kind: "level", level: b.level }) },
        el("span", { class: "level-row-num", text: `第 ${b.level} 级` }),
        el("span", { class: "level-row-count", text: `${b.cards.length} 个字` }),
        b.amber > 0
          ? el("span", { class: "tag is-amber", text: `${b.amber} 继续学` })
          : el("span", { class: "tag is-green", text: "都学会了" }),
      ),
    );
  }

  showMain();
  modal.open();
}
