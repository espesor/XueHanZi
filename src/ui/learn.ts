/** 「学习」tab：首页 / 学字 / 复习小结。 */
import { crossing, levelInfo, milestones } from "../progress";
import type { Store } from "../store";
import { exportFile, importFile } from "../storage";
import type { Answer, Outcome, ReviewScope } from "../types";
import { celebrate } from "./celebrate";
import { confetti } from "./confetti";
import { el } from "./dom";
import { openReviewPicker } from "./reviewPicker";
import { openSheet } from "./sheet";
import { toast } from "./toast";

/** 答完一个字停留多久再出下一个 */
const PAUSE_MS = { good: 950, plain: 800 } as const;

type Panel = "home" | "study" | "summary";

export function createLearnView(store: Store) {
  const dict = store.dict;
  const allMilestones = milestones(dict.milestoneEvery);

  // ---------- 首页 ----------
  const lvNum = el("span", { class: "lv-num" });
  const lvBadge = el("span", { class: "lv-badge", hidden: true });
  const lvCount = el("span", { class: "lv-count" });
  const lvBar = el("i");
  const lvFoot = el("p", { class: "lv-foot" });
  const seals = el("div", { class: "seals" });
  for (const m of allMilestones) {
    seals.appendChild(el("div", { class: "seal", title: m.name, text: m.name.charAt(0) }));
  }

  const nGreen = el("span", { class: "stat-n is-green" });
  const nAmber = el("span", { class: "stat-n is-amber" });
  const hintNew = el("span", { class: "btn-hint" });
  const hintOld = el("span", { class: "btn-hint" });

  const btnNew = el(
    "button",
    { class: "btn btn-primary", type: "button", onclick: () => startNew() },
    el("span", { class: "btn-ch", text: "新" }),
    "学习新字",
    hintNew,
  );
  const btnOld = el(
    "button",
    { class: "btn", type: "button", onclick: () => openReviewPicker(store, startReview) },
    el("span", { class: "btn-ch", text: "复" }),
    "复习老字",
    hintOld,
  );

  const fileInput = el("input", {
    type: "file",
    accept: "application/json",
    hidden: true,
    onchange: onImport,
  }) as HTMLInputElement;

  const home = el(
    "div",
    { class: "panel" },
    el(
      "section",
      { class: "level", "aria-label": "等级进度" },
      el("div", { class: "lv-top" }, lvNum, lvBadge, lvCount),
      el("div", { class: "bar" }, lvBar),
      seals,
      lvFoot,
    ),
    el(
      "section",
      { class: "ledger" },
      el(
        "div",
        { class: "stat" },
        el("span", { class: "stat-lead", text: "你已学会" }),
        nGreen,
        el("span", { class: "stat-unit", text: "个字" }),
        el("span", { class: "tag is-green", text: "连着两次都认识" }),
      ),
      el(
        "div",
        { class: "stat" },
        el("span", { class: "stat-lead", text: "正在继续学" }),
        nAmber,
        el("span", { class: "stat-unit", text: "个字" }),
        el("span", { class: "tag is-amber", text: "还要再见几面" }),
      ),
    ),
    el("div", { class: "actions" }, btnNew, btnOld),
    el("p", {
      class: "note",
      text:
        "新字按常用度从易到难出现。连着两次不看解释就认识，字才转绿。" +
        "复习可以抽查一小部分，也可以挑一级来练，橙色的字总是先出。",
    }),
    el(
      "div",
      { class: "filerow" },
      el("button", {
        class: "linkish",
        type: "button",
        text: "导出进度",
        onclick: () => {
          exportFile(store.progress);
          toast("进度已导出");
        },
      }),
      el("button", {
        class: "linkish",
        type: "button",
        text: "导入进度",
        onclick: () => fileInput.click(),
      }),
      el("span", { class: "filerow-note", text: "进度存在这台设备上" }),
      fileInput,
    ),
  );

  // ---------- 学字页 ----------
  const modeTag = el("span", { class: "study-mode" });
  const studyProgress = el("span");
  const han = el("span", { class: "han" });
  const gridBox = el("div", { class: "grid-box" }, han);
  const feedback = el("p", { class: "feedback", "aria-live": "polite" });

  const btnYes = el("button", {
    class: "jbtn is-yes",
    type: "button",
    text: "认识",
    onclick: () => answer("known"),
  });
  const btnNo = el("button", {
    class: "jbtn is-no",
    type: "button",
    text: "不认识",
    onclick: () => answer("unknown"),
  });
  const btnLook = el("button", {
    class: "sbtn",
    type: "button",
    text: "查看",
    onclick: () => look(),
  });
  const btnStop = el("button", {
    class: "sbtn",
    type: "button",
    text: "停止",
    onclick: () => stop(),
  });

  const study = el(
    "div",
    { class: "panel study", hidden: true },
    el("div", { class: "study-head" }, modeTag, studyProgress),
    gridBox,
    feedback,
    el("div", { class: "judge" }, btnYes, btnNo),
    el("div", { class: "minor" }, btnLook, btnStop),
    el("p", { class: "note kbd-hint", text: "键盘：1 认识 · 2 不认识 · 空格 查看 · Esc 停止" }),
  );

  // ---------- 小结 ----------
  const sumPromoted = el("b");
  const sumPending = el("b");
  const sumNote = el("p", { class: "note" });
  const summary = el(
    "div",
    { class: "panel summary", hidden: true },
    el("h2", { class: "summary-title", text: "这一轮复习完成" }),
    el(
      "div",
      { class: "sum-grid" },
      el(
        "div",
        { class: "sum-cell is-green" },
        sumPromoted,
        el("span", { text: "转成「已学会」" }),
      ),
      el("div", { class: "sum-cell is-amber" }, sumPending, el("span", { text: "还要再练" })),
    ),
    sumNote,
    el("button", {
      class: "btn btn-primary btn-wide",
      type: "button",
      text: "回到学习页",
      onclick: () => panel("home"),
    }),
  );

  const root = el("div", { class: "view" }, home, study, summary);

  // ---------- 逻辑 ----------
  let mode: "new" | "review" = "new";
  let current: number | null = null;
  let viewed = false;
  let locked = false; // 反馈动画期间不接受输入
  let timer: number | undefined;

  function panel(which: Panel): void {
    home.hidden = which !== "home";
    study.hidden = which !== "study";
    summary.hidden = which !== "summary";
    if (which === "home") {
      store.endSession();
      renderHome();
    }
  }

  function renderHome(): void {
    const learned = store.learned;
    const info = levelInfo(learned, dict.levelSize, dict.milestoneEvery);

    nGreen.textContent = String(store.greenCount);
    nAmber.textContent = String(store.amberCount);

    lvNum.textContent = `第 ${info.level} 级`;
    lvCount.textContent = `${info.inLevel} / ${info.size}`;
    lvBar.style.width = `${(info.inLevel / info.size) * 100}%`;
    lvBadge.hidden = info.current === null;
    if (info.current) lvBadge.textContent = info.current.name;

    [...seals.children].forEach((node, k) => node.classList.toggle("is-on", k < info.earned));

    lvFoot.textContent = info.next
      ? `再学 ${info.toNextLevel} 个字升第 ${info.level + 1} 级 · 还差 ${info.toNextMilestone} 字解锁「${info.next.name}」`
      : `全部 ${dict.chars.length} 字都学过了。`;

    hintNew.textContent = `字库还剩 ${store.remaining} 个`;
    hintOld.textContent = learned > 0 ? `学过 ${learned} 个字` : "还没有学过的字";
    btnNew.disabled = store.remaining === 0;
    btnOld.disabled = learned === 0;
  }

  function startNew(): void {
    mode = "new";
    modeTag.textContent = "学习新字";
    panel("study");
    nextChar();
  }

  function startReview(scope: ReviewScope): void {
    mode = "review";
    if (!store.startReview(scope)) {
      toast(scope.kind === "level" ? "这一级还没有学过的字" : "还没有学过的字");
      return;
    }
    modeTag.textContent = scope.kind === "level" ? `复习 · 第 ${scope.level} 级` : "抽查复习";
    panel("study");
    nextChar();
  }

  function stop(): void {
    clearTimeout(timer);
    locked = false;
    panel("home");
  }

  function nextChar(): void {
    viewed = false;
    locked = false;
    btnLook.classList.remove("is-done");
    gridBox.className = "grid-box";
    feedback.textContent = "这个字你认识吗？";
    feedback.className = "feedback";

    if (mode === "new") {
      const next = store.nextNew();
      if (next === null) {
        toast("字库学完啦！");
        panel("home");
        return;
      }
      current = next;
      studyProgress.textContent = `第 ${next + 1} 个 / 共 ${dict.chars.length}`;
    } else {
      const s = store.session;
      if (!s) return;
      if (s.pos >= s.queue.length) {
        finishSession();
        return;
      }
      current = s.queue[s.pos]!;
      studyProgress.textContent = `${s.pos + 1} / ${s.queue.length}`;
    }
    han.textContent = store.entry(current).c;
  }

  function look(): void {
    if (locked || current === null) return;
    viewed = true;
    btnLook.classList.add("is-done");
    openSheet(store.entry(current));
  }

  function answer(a: Answer): void {
    if (locked || current === null) return;
    if (a === "unknown" && !viewed) {
      // 「不认识」直接把解释推到眼前 —— 那一刻正是学习发生的时候
      viewed = true;
      btnLook.classList.add("is-done");
      openSheet(store.entry(current), () => commit("unknown"));
      return;
    }
    commit(a);
  }

  function commit(a: Answer): void {
    if (current === null) return;
    locked = true;
    const learnedBefore = store.learned;
    const outcome = store.answer(current, a, viewed);
    if (store.session) store.session.pos++;

    gridBox.className = `grid-box is-${outcome.card.lv}`;
    feedback.textContent = message(outcome, a);
    feedback.className = `feedback ${outcome.verdict === "reset" || outcome.verdict === "progress" ? "is-warm" : "is-ok"}`;

    const good = outcome.verdict === "promoted" || outcome.verdict === "reinforced";
    if (good) confetti("green");

    const cross = outcome.isNew
      ? crossing(learnedBefore + 1, dict.levelSize, dict.milestoneEvery)
      : { level: false, milestone: null };

    timer = window.setTimeout(
      () => {
        if (cross.level || cross.milestone) {
          const info = levelInfo(store.learned, dict.levelSize, dict.milestoneEvery);
          celebrate(
            {
              level: info.level,
              learned: store.learned,
              milestone: cross.milestone,
              toNextMilestone: info.toNextMilestone,
              nextMilestoneName: info.next?.name ?? null,
            },
            nextChar,
          );
        } else {
          nextChar();
        }
      },
      good ? PAUSE_MS.good : PAUSE_MS.plain,
    );
  }

  function message(o: Outcome, a: Answer): string {
    switch (o.verdict) {
      case "promoted":
        return "连着两次都认识 —— 转绿，归入「已学会」";
      case "reinforced":
        return `还是认识！这个字已经巩固 ${o.card.rep + 1} 次了`;
      case "progress":
        return "认对了！再直接认对一次就转绿";
      case "reset":
        // 「不认识」和「查看过才说认识」都会归零，但话得说得不一样
        if (a === "unknown") {
          return o.wasGreen ? "这个字还没真记住，退回「继续学」" : "放进「继续学」，下次还会见到它";
        }
        return o.wasGreen ? "需要看一眼才认出来，退回「继续学」" : "看过才认出来，先放「继续学」";
    }
  }

  function finishSession(): void {
    const s = store.session;
    if (!s) return;
    sumPromoted.textContent = String(s.promoted);
    sumPending.textContent = String(s.pending);
    const left = store.amberCount;

    // 抽查如果字数少，会自然覆盖全部学过的字，这时说法要跟「全过一遍」一致
    const scopeText =
      s.scope.kind === "level"
        ? `第 ${s.scope.level} 级的 ${s.queue.length} 个字`
        : s.queue.length >= store.learned
          ? `学过的 ${s.queue.length} 个字`
          : `抽查的 ${s.queue.length} 个字`;

    sumNote.textContent =
      left > 0
        ? `${scopeText}都过了一遍。还有 ${left} 个停在「继续学」，可以再抽查一轮，或者按级挑着复习。`
        : `${scopeText}都过了一遍，而且全是绿的。去学点新字吧。`;
    store.endSession();
    summary.hidden = false;
    study.hidden = true;
    home.hidden = true;
    renderHome();
  }

  async function onImport(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const progress = await importFile(file, dict.chars.length);
      store.replace(progress);
      toast(`已导入 ${progress.cards.length} 个字`);
    } catch {
      toast("这个文件读不出来，请选导出的进度文件");
    }
  }

  // 键盘快捷键，只在学字页生效
  function onKey(e: KeyboardEvent): void {
    if (study.hidden || locked) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector(".scrim:not([hidden])")) return;
    switch (e.key) {
      case "1":
        e.preventDefault();
        answer("known");
        break;
      case "2":
        e.preventDefault();
        answer("unknown");
        break;
      case " ":
        e.preventDefault();
        look();
        break;
      case "Escape":
        e.preventDefault();
        stop();
        break;
    }
  }
  document.addEventListener("keydown", onKey);

  renderHome();

  return {
    root,
    refresh: () => {
      if (!home.hidden) renderHome();
    },
    /** 切走 tab 时把进行中的会话收掉，避免回来时状态不一致 */
    reset: () => {
      clearTimeout(timer);
      locked = false;
      if (!summary.hidden) return;
      panel("home");
    },
  };
}
