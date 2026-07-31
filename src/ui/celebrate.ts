/** 升级 / 解锁名号的弹窗。 */
import type { Milestone } from "../progress";
import { confetti } from "./confetti";
import { el } from "./dom";
import { createModal, type Modal } from "./modal";

let modal: Modal | null = null;
let kicker: HTMLElement;
let seal: HTMLElement;
let title: HTMLElement;
let desc: HTMLElement;

function build(): Modal {
  const m = createModal({ closeButton: false });
  kicker = el("span", { class: "lvup-kicker" });
  seal = el("div", { class: "lvup-seal" });
  title = el("h2", { class: "lvup-title" });
  desc = el("p", { class: "lvup-desc" });
  m.body.appendChild(
    el(
      "div",
      { class: "lvup" },
      kicker,
      seal,
      title,
      desc,
      el("button", {
        class: "btn btn-primary btn-wide",
        type: "button",
        text: "继续",
        onclick: () => m.close(),
      }),
    ),
  );
  return m;
}

export interface Celebration {
  level: number;
  learned: number;
  milestone: Milestone | null;
  /** 距下一个名号还差几个字 */
  toNextMilestone: number;
  nextMilestoneName: string | null;
}

export function celebrate(c: Celebration, onClose: () => void): void {
  modal ??= build();

  if (c.milestone) {
    kicker.textContent = "解锁名号";
    seal.className = "lvup-seal";
    seal.textContent = c.milestone.name;
    title.textContent = `「${c.milestone.name}」达成`;
    desc.replaceChildren(
      document.createTextNode(c.milestone.desc),
      el("br"),
      document.createTextNode("常见书报的用字，你已经认得 "),
      el("b", { class: "lvup-cover", text: c.milestone.cover }),
      document.createTextNode("。"),
    );
    confetti("mix", 110);
  } else {
    kicker.textContent = "升级了";
    seal.className = "lvup-seal is-num";
    seal.textContent = String(c.level);
    title.textContent = `第 ${c.level} 级`;
    desc.textContent = c.nextMilestoneName
      ? `已经学过 ${c.learned} 个字。再学 ${c.toNextMilestone} 个，就能解锁「${c.nextMilestoneName}」。`
      : `已经学过 ${c.learned} 个字。`;
    confetti("mix", 60);
  }

  modal.open(onClose);
}
