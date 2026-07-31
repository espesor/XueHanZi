/** 「查看」弹窗：拼音、组词、朗读。学习页和复习页共用。 */
import { cancel, isSupported, speak } from "../speech";
import type { CharEntry } from "../types";
import { clear, el } from "./dom";
import { createModal, type Modal } from "./modal";
import { toast } from "./toast";

let modal: Modal | null = null;
let hanNode: HTMLElement;
let pinyinNode: HTMLElement;
let playNode: HTMLButtonElement;
let playLabel: HTMLElement;
let wordsLabel: HTMLElement;
let wordsNode: HTMLElement;

function build(): Modal {
  const m = createModal({ label: "关闭" });

  hanNode = el("div", { class: "sheet-han" });
  pinyinNode = el("div", { class: "sheet-pinyin" });
  playLabel = el("span", { text: "读一遍（字 + 全部组词）" });
  playNode = el(
    "button",
    { class: "btn btn-wide", type: "button" },
    el("span", { class: "btn-ch", text: "🔊" }),
    playLabel,
  );
  wordsLabel = el("span", { class: "sheet-label", text: "常见组词" });
  wordsNode = el("div", { class: "words" });

  m.body.appendChild(
    el("div", { class: "sheet-body" }, hanNode, pinyinNode, playNode, wordsLabel, wordsNode),
  );
  return m;
}

export function openSheet(entry: CharEntry, onClose?: () => void): void {
  modal ??= build();

  hanNode.textContent = entry.c;
  pinyinNode.textContent = entry.p.join(" / ");

  clear(wordsNode);
  const hasWords = entry.w.length > 0;
  wordsLabel.hidden = !hasWords;
  playLabel.textContent = hasWords ? "读一遍（字 + 全部组词）" : "读一遍";

  if (hasWords) {
    for (const [word, pinyin] of entry.w) {
      wordsNode.appendChild(
        el(
          "div",
          { class: "word" },
          el("span", { class: "word-w", text: word }),
          el("span", { class: "word-p", text: pinyin }),
          el("button", {
            class: "word-play",
            type: "button",
            "aria-label": `读「${word}」`,
            text: "🔊",
            onclick: () => play([word]),
          }),
        ),
      );
    }
  } else {
    wordsNode.appendChild(el("p", { class: "sheet-nowords", text: "这个字很少单独组词。" }));
  }

  playNode.onclick = () => play([entry.c, ...entry.w.map(([w]) => w)]);

  modal.open(() => {
    cancel();
    onClose?.();
  });
}

function play(texts: string[]): void {
  if (!isSupported()) {
    toast("这个浏览器不支持朗读");
    return;
  }
  speak(texts);
}
