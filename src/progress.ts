/** 等级、里程碑、新字指针。也全是纯函数。见 DESIGN.md §5。 */
import type { Card, Level } from "./types";

export interface Milestone {
  name: string;
  /** 达成需要的字数 */
  at: number;
  /** 学到这里，书报用字的覆盖率 */
  cover: string;
  desc: string;
}

/** 名号。`at` 由 milestoneEvery 生成，这里只写名字和文案。 */
const MILESTONE_TEXT = [
  ["开卷", "75%", "最常用的 500 字。一般书报上四分之三的字，你都认得了。"],
  ["识途", "89%", "1000 字。整句话里大多数字不再是障碍，能猜着读下去了。"],
  ["顺读", "94%", "1500 字。一段文字里生字通常不超过一两个。"],
  ["通篇", "97%", "2000 字。日常文章基本可以从头读到尾。"],
  ["阅报", "98.5%", "2500 字。报纸新闻已经能顺畅读完。"],
  ["书卷", "99%", "3000 字。书籍和杂志里的生字已经很少见。"],
  ["博览", "99.5%", "3500 字全部学完。现代书报上的字，几乎没有你不认得的了。"],
] as const;

export function milestones(every: number): Milestone[] {
  return MILESTONE_TEXT.map(([name, cover, desc], k) => ({
    name,
    at: (k + 1) * every,
    cover,
    desc,
  }));
}

export interface LevelInfo {
  /** 当前等级，从 1 开始 */
  level: number;
  /** 本级已学 */
  inLevel: number;
  /** 每级字数 */
  size: number;
  /** 已解锁的名号数 */
  earned: number;
  /** 已解锁的最后一个名号 */
  current: Milestone | null;
  /** 下一个名号；全部解锁后为 null */
  next: Milestone | null;
  /** 距下一级还差几个字 */
  toNextLevel: number;
  /** 距下一个名号还差几个字 */
  toNextMilestone: number;
}

export function levelInfo(
  learned: number,
  levelSize: number,
  milestoneEvery: number,
): LevelInfo {
  const all = milestones(milestoneEvery);
  const earned = Math.min(Math.floor(learned / milestoneEvery), all.length);
  const next = all[earned] ?? null;
  return {
    level: Math.floor(learned / levelSize) + 1,
    inLevel: learned % levelSize,
    size: levelSize,
    earned,
    current: earned > 0 ? all[earned - 1]! : null,
    next,
    toNextLevel: levelSize - (learned % levelSize),
    toNextMilestone: next ? next.at - learned : 0,
  };
}

/** 学到第 n 个字时，是不是刚好升级 / 刚好解锁名号 */
export function crossing(
  learned: number,
  levelSize: number,
  milestoneEvery: number,
): { level: boolean; milestone: Milestone | null } {
  if (learned === 0) return { level: false, milestone: null };
  const all = milestones(milestoneEvery);
  const hitMilestone = learned % milestoneEvery === 0;
  return {
    level: learned % levelSize === 0,
    milestone: hitMilestone ? (all[learned / milestoneEvery - 1] ?? null) : null,
  };
}

export function countBy(cards: readonly Card[], lv: Level): number {
  return cards.reduce((n, c) => (c.lv === lv ? n + 1 : n), 0);
}

/**
 * 一个字属于第几级：由它在字库里的下标决定，不看用户什么时候学的。
 *
 * 因为新字永远按字库顺序出（见 nextNewIndex），「学习顺序」和「字库顺序」
 * 本就是一回事，级数不需要另外记录，用下标现算就行。
 */
export function charLevel(index: number, levelSize: number): number {
  return Math.floor(index / levelSize) + 1;
}

export function cardsInLevel(
  cards: readonly Card[],
  level: number,
  levelSize: number,
): Card[] {
  return cards.filter((c) => charLevel(c.i, levelSize) === level);
}

export interface LevelBucket {
  level: number;
  cards: Card[];
  green: number;
  amber: number;
}

/** 按级分桶，只列有学过字的级别，按级数升序 —— 给「按级复习」的选级列表用。 */
export function levelBuckets(cards: readonly Card[], levelSize: number): LevelBucket[] {
  const byLevel = new Map<number, Card[]>();
  for (const c of cards) {
    const lv = charLevel(c.i, levelSize);
    const list = byLevel.get(lv);
    if (list) list.push(c);
    else byLevel.set(lv, [c]);
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, list]) => ({
      level,
      cards: list,
      green: countBy(list, "g"),
      amber: countBy(list, "a"),
    }));
}

/**
 * 下一个该学的新字 = 字库里第一个还没学过的下标。
 *
 * 不用「指针」是因为导入进度之后指针可能对不上；直接扫一遍集合最保险，
 * 3500 个字的扫描开销可以忽略。
 */
export function nextNewIndex(cards: readonly Card[], dictSize: number): number {
  const learned = new Set(cards.map((c) => c.i));
  for (let i = 0; i < dictSize; i++) if (!learned.has(i)) return i;
  return dictSize;
}
