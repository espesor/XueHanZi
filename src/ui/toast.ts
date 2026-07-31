import { el } from "./dom";

let node: HTMLElement | null = null;
let timer: number | undefined;

export function toast(message: string): void {
  if (!node) {
    node = el("div", { class: "toast", role: "status", "aria-live": "polite" });
    document.body.appendChild(node);
  }
  node.textContent = message;
  node.classList.add("is-on");
  clearTimeout(timer);
  timer = window.setTimeout(() => node?.classList.remove("is-on"), 1800);
}
