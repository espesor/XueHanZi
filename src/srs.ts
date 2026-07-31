/**
 * 判定规则。全是纯函数：时间从参数传进来，不碰 DOM，不读 Date.now()。
 * 见 DESIGN.md §4。
 */
import type { Answer, Card, Outcome } from "./types";

/** 连续认对几次转绿 */
export const PROMOTE_STREAK = 2;

export function newCard(index: number, now: number): Card {
  return { i: index, lv: "a", streak: 0, rep: 0, first: now, seen: now };
}

/**
 * 给一次作答评级，返回更新后的卡片（不修改传入的对象）。
 *
 * @param card    已有的卡片；没学过就传 null
 * @param index   字库下标
 * @param answer  用户按了「认识」还是「不认识」
 * @param viewed  这一轮里点过「查看」没有 —— 看过就不算数
 */
export function grade(
  card: Card | null,
  index: number,
  answer: Answer,
  viewed: boolean,
  now: number,
): Outcome {
  const isNew = card === null;
  const base = card ?? newCard(index, now);
  const wasGreen = base.lv === "g";

  // 只有「没查看就认出来」才算数：看过解释再说认识，说明还没真记住
  const clean = answer === "known" && !viewed;

  if (!clean) {
    return {
      card: { ...base, lv: "a", streak: 0, rep: 0, seen: now },
      verdict: "reset",
      isNew,
      wasGreen,
    };
  }

  const streak = base.streak + 1;
  if (streak < PROMOTE_STREAK) {
    return {
      card: { ...base, lv: "a", streak, seen: now },
      verdict: "progress",
      isNew,
      wasGreen,
    };
  }

  return {
    card: {
      ...base,
      lv: "g",
      streak,
      rep: wasGreen ? base.rep + 1 : 0,
      seen: now,
    },
    verdict: wasGreen ? "reinforced" : "promoted",
    isNew,
    wasGreen,
  };
}

/**
 * 一轮复习的出字顺序：学过的字全过一遍，橙色在前，绿色在后，各组内部打乱。
 *
 * 橙色优先是唯一的优先级 —— 没稳的字先见，而且它们下一轮多半还在橙色组，
 * 自然就见得更频繁。见 DESIGN.md §4.4。
 */
export function reviewQueue(
  cards: readonly Card[],
  rng: () => number = Math.random,
): number[] {
  const pick = (lv: Card["lv"]) =>
    shuffle(
      cards.filter((c) => c.lv === lv).map((c) => c.i),
      rng,
    );
  return [...pick("a"), ...pick("g")];
}

function shuffle(a: number[], rng: () => number): number[] {
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [a[k], a[j]] = [a[j]!, a[k]!];
  }
  return a;
}

/** 复习页的排序：橙色在前，同色里新学的在前。和复习队列的顺序一致。 */
export function sortForDisplay(cards: readonly Card[]): Card[] {
  return [...cards].sort((x, y) => {
    if (x.lv !== y.lv) return x.lv === "a" ? -1 : 1;
    return y.first - x.first;
  });
}

/** 「抽查复习」封顶字数。字少时抽查会自然覆盖全部；字多时是恒定长度的一小口。 */
export const SPOT_CHECK_SIZE = 20;

/**
 * 抽查队列 = reviewQueue 掐头。橙色优先级天然保住：
 * 橙色字数 ≥ 上限时抽出来的全是橙色，< 上限时橙色全留下，剩下名额随机补绿色。
 */
export function spotCheckQueue(
  cards: readonly Card[],
  cap: number = SPOT_CHECK_SIZE,
  rng: () => number = Math.random,
): number[] {
  return reviewQueue(cards, rng).slice(0, cap);
}
