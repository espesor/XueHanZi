/** 字库里的一个字。数组下标就是它的 ID，进度文件里存的是下标。 */
export interface CharEntry {
  /** 汉字 */
  c: string;
  /** 读音，最多 3 个，常用在前 */
  p: string[];
  /** 组词，[词, 拼音] */
  w: [string, string][];
}

export interface Dict {
  version: number;
  generated: string;
  count: number;
  levelSize: number;
  milestoneEvery: number;
  source: Record<string, string>;
  chars: CharEntry[];
}

/** `g` 绿 = 已学会，`a` 橙 = 继续学 */
export type Level = "g" | "a";

export interface Card {
  /** 字库下标 */
  i: number;
  lv: Level;
  /** 连续「不看解释就认识」的次数，到 2 转绿 */
  streak: number;
  /** 转绿之后又认对几次（巩固次数），只用于反馈 */
  rep: number;
  /** 首次学到的时间，用于复习页排序 */
  first: number;
  /** 上次见到的时间 */
  seen: number;
}

export interface Progress {
  version: number;
  cards: Card[];
}

export type Answer = "known" | "unknown";

/** 一次作答之后发生了什么，UI 拿它决定说什么话、撒不撒花 */
export type Verdict =
  /** 刚转绿 */
  | "promoted"
  /** 本来就是绿的，又认对了 */
  | "reinforced"
  /** 认对了但还没到两次，停在橙色 */
  | "progress"
  /** 归零：不认识、或查看过才认出来 */
  | "reset";

export interface Outcome {
  card: Card;
  verdict: Verdict;
  /** 这个字之前没学过 */
  isNew: boolean;
  /** 作答前是不是绿的 */
  wasGreen: boolean;
}

/**
 * 一轮复习覆盖哪些字。
 * `spot` 抽查：橙优先、封顶字数，字少时自然等于全部；字多时是恒定长度的一小口。
 * `level` 按级：只过某一级里学过的字，不封顶（一级最多 levelSize 个，本身就不长）。
 */
export type ReviewScope = { kind: "spot" } | { kind: "level"; level: number };
