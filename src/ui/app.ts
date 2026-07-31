/** 外壳：品牌条 + 两个 tab。启动停在「学习」。 */
import type { Store } from "../store";
import { el } from "./dom";
import { createLearnView } from "./learn";
import { createReviewView } from "./review";

type TabId = "learn" | "review";

export function mountApp(root: HTMLElement, store: Store): void {
  const learn = createLearnView(store);
  const review = createReviewView(store);

  const tabLearn = el("button", {
    class: "tab",
    type: "button",
    role: "tab",
    id: "tab-learn",
    "aria-controls": "view-learn",
    "aria-selected": "true",
    text: "学习",
    onclick: () => select("learn"),
  });
  const tabReview = el("button", {
    class: "tab",
    type: "button",
    role: "tab",
    id: "tab-review",
    "aria-controls": "view-review",
    "aria-selected": "false",
    text: "复习",
    onclick: () => select("review"),
  });

  learn.root.id = "view-learn";
  learn.root.setAttribute("role", "tabpanel");
  learn.root.setAttribute("aria-labelledby", "tab-learn");
  review.root.id = "view-review";
  review.root.setAttribute("role", "tabpanel");
  review.root.setAttribute("aria-labelledby", "tab-review");
  review.root.hidden = true;

  const frame = el(
    "div",
    { class: "frame" },
    el(
      "header",
      { class: "brand" },
      el("span", { class: "brand-mark", text: "識" }),
      el("span", { class: "brand-name", text: "识字" }),
      el("span", { class: "brand-sub", text: `${store.dict.chars.length} 字` }),
    ),
    el("div", { class: "tabs", role: "tablist", "aria-label": "主导航" }, tabLearn, tabReview),
    learn.root,
    review.root,
  );

  function select(which: TabId): void {
    const isLearn = which === "learn";
    tabLearn.setAttribute("aria-selected", String(isLearn));
    tabReview.setAttribute("aria-selected", String(!isLearn));
    learn.root.hidden = !isLearn;
    review.root.hidden = isLearn;
    if (isLearn) learn.refresh();
    else {
      learn.reset();
      review.refresh();
    }
  }

  // 左右方向键在 tab 之间移动，符合 tablist 的键盘习惯
  for (const [tab, other, id] of [
    [tabLearn, tabReview, "review"],
    [tabReview, tabLearn, "learn"],
  ] as const) {
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        select(id as TabId);
        other.focus();
      }
    });
  }

  store.subscribe(() => {
    learn.refresh();
    review.refresh();
  });

  root.replaceChildren(frame);
}
