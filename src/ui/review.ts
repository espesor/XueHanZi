/** 「复习」tab：学过的字，小字卡网格 + 翻页。 */
import { charLevel } from "../progress";
import { sortForDisplay } from "../srs";
import type { Store } from "../store";
import { clear, el } from "./dom";
import { openSheet } from "./sheet";

const PAGE_SIZE = 20;

export function createReviewView(store: Store) {
  let page = 0;

  const grid = el("div", { class: "cards" });
  const body = el("div", { class: "review-body" }, grid);

  const pageIdx = el("span", { class: "pager-idx" });
  const first = el("button", { class: "pager-btn", type: "button", "aria-label": "第一页", text: "«", onclick: () => go(0) });
  const prev = el("button", { class: "pager-btn", type: "button", "aria-label": "上一页", text: "‹", onclick: () => go(page - 1) });
  const next = el("button", { class: "pager-btn", type: "button", "aria-label": "下一页", text: "›", onclick: () => go(page + 1) });
  const last = el("button", { class: "pager-btn", type: "button", "aria-label": "最后一页", text: "»", onclick: () => go(pageCount() - 1) });
  const pager = el("nav", { class: "pager", "aria-label": "翻页" }, first, prev, pageIdx, next, last);

  const root = el(
    "div",
    { class: "view" },
    el(
      "div",
      { class: "rev-head" },
      el("h2", { text: "学过的字" }),
      el(
        "div",
        { class: "legend" },
        el("span", {}, el("i", { class: "swatch is-amber" }), "继续学"),
        el("span", {}, el("i", { class: "swatch is-green" }), "已学会"),
      ),
    ),
    body,
    pager,
    el("p", {
      class: "note",
      text:
        "点字卡看拼音、组词和读音，左上角是这个字所在的级数。橙色（继续学）排在前面，" +
        "同色里新学的排在前面 —— 「抽查复习」「按级复习」也是按这个顺序出字。",
    }),
  );

  function pageCount(): number {
    return Math.max(1, Math.ceil(store.learned / PAGE_SIZE));
  }

  function go(p: number): void {
    page = Math.min(Math.max(p, 0), pageCount() - 1);
    render();
  }

  function render(): void {
    const list = sortForDisplay(store.cards);
    clear(grid);

    if (list.length === 0) {
      body.replaceChildren(
        el(
          "div",
          { class: "empty" },
          el("span", { class: "empty-big", text: "空" }),
          el("p", { text: "还没有学过的字。" }),
          el("p", { text: "去「学习」里按「学习新字」开始吧。" }),
        ),
      );
      pager.hidden = true;
      return;
    }

    const pages = pageCount();
    if (page > pages - 1) page = pages - 1;

    for (const card of list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
      const entry = store.entry(card.i);
      const level = charLevel(card.i, store.dict.levelSize);
      grid.appendChild(
        el(
          "button",
          {
            class: `card is-${card.lv}`,
            type: "button",
            "aria-label": `${entry.c} ${entry.p.join(" ")}，第 ${level} 级`,
            onclick: () => openSheet(entry),
          },
          el("i", { class: "card-lv", "aria-hidden": "true", text: String(level) }),
          el("span", { text: entry.c }),
        ),
      );
    }

    body.replaceChildren(grid);
    pager.hidden = pages <= 1;
    pageIdx.textContent = `${page + 1} / ${pages}`;
    first.disabled = prev.disabled = page === 0;
    next.disabled = last.disabled = page >= pages - 1;
  }

  render();

  return { root, refresh: render };
}
