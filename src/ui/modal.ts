/** 弹窗底座：焦点管理、Esc 关闭、点遮罩关闭。查看页和升级页共用。 */
import { el } from "./dom";

export interface Modal {
  root: HTMLElement;
  body: HTMLElement;
  open(onClose?: () => void): void;
  close(): void;
  readonly isOpen: boolean;
}

export function createModal(options: { closeButton?: boolean; label?: string } = {}): Modal {
  const body = el("div", { class: "sheet" });
  const root = el(
    "div",
    { class: "scrim", role: "dialog", "aria-modal": "true", hidden: true },
    body,
  );

  if (options.closeButton !== false) {
    body.appendChild(
      el(
        "div",
        { class: "sheet-top" },
        el("button", {
          class: "sheet-x",
          type: "button",
          "aria-label": options.label ?? "关闭",
          text: "✕",
          onclick: () => modal.close(),
        }),
      ),
    );
  }

  let lastFocus: Element | null = null;
  let onClose: (() => void) | undefined;

  root.addEventListener("click", (e) => {
    if (e.target === root) modal.close();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !root.hidden) {
      e.stopPropagation();
      modal.close();
    }
    // 焦点困在弹窗里
    if (e.key === "Tab" && !root.hidden) trapFocus(e, body);
  };

  const modal: Modal = {
    root,
    body,
    get isOpen() {
      return !root.hidden;
    },
    open(cb) {
      onClose = cb;
      lastFocus = document.activeElement;
      root.hidden = false;
      document.addEventListener("keydown", onKey, true);
      focusable(body)[0]?.focus();
    },
    close() {
      if (root.hidden) return;
      root.hidden = true;
      document.removeEventListener("keydown", onKey, true);
      if (lastFocus instanceof HTMLElement) lastFocus.focus();
      const cb = onClose;
      onClose = undefined;
      cb?.();
    },
  };

  document.body.appendChild(root);
  return modal;
}

function focusable(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((n) => !n.hasAttribute("disabled"));
}

function trapFocus(e: KeyboardEvent, root: HTMLElement): void {
  const items = focusable(root);
  if (items.length === 0) return;
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
