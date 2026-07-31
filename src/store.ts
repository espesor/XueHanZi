/** 全局状态。UI 只通过这里读写，规则都在 srs / progress 里。 */
import { cardsInLevel, countBy, nextNewIndex } from "./progress";
import { grade, reviewQueue, spotCheckQueue } from "./srs";
import { clear, load, save } from "./storage";
import type { Answer, Card, Dict, Outcome, Progress, ReviewScope } from "./types";

export interface Session {
  scope: ReviewScope;
  queue: number[];
  pos: number;
  promoted: number;
  pending: number;
}

type Listener = () => void;

export class Store {
  readonly dict: Dict;
  progress: Progress;
  session: Session | null = null;

  private listeners = new Set<Listener>();
  private byIndex = new Map<number, Card>();

  constructor(dict: Dict) {
    this.dict = dict;
    this.progress = load(dict.chars.length);
    this.reindex();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private reindex(): void {
    this.byIndex = new Map(this.progress.cards.map((c) => [c.i, c]));
  }

  // ---- 读 ----

  get cards(): readonly Card[] {
    return this.progress.cards;
  }
  get learned(): number {
    return this.progress.cards.length;
  }
  get greenCount(): number {
    return countBy(this.progress.cards, "g");
  }
  get amberCount(): number {
    return countBy(this.progress.cards, "a");
  }
  get remaining(): number {
    return this.dict.chars.length - this.learned;
  }

  cardAt(index: number): Card | null {
    return this.byIndex.get(index) ?? null;
  }

  entry(index: number) {
    const e = this.dict.chars[index];
    if (!e) throw new RangeError(`字库下标越界: ${index}`);
    return e;
  }

  /** 下一个没学过的字；字库学完返回 null */
  nextNew(): number | null {
    const i = nextNewIndex(this.progress.cards, this.dict.chars.length);
    return i < this.dict.chars.length ? i : null;
  }

  // ---- 写 ----

  /** 记一次作答。新学的字会被加进牌组。 */
  answer(index: number, answer: Answer, viewed: boolean, now = Date.now()): Outcome {
    const outcome = grade(this.cardAt(index), index, answer, viewed, now);

    if (outcome.isNew) {
      // 新学的排在最前面，复习页「新学的在前」靠 first 排序
      this.progress.cards.unshift(outcome.card);
    } else {
      const at = this.progress.cards.findIndex((c) => c.i === index);
      this.progress.cards[at] = outcome.card;
    }
    this.byIndex.set(index, outcome.card);

    if (this.session) {
      if (outcome.verdict === "promoted" || outcome.verdict === "reinforced") {
        this.session.promoted++;
      } else {
        this.session.pending++;
      }
    }

    save(this.progress);
    this.emit();
    return outcome;
  }

  /**
   * 开一轮复习。`spot` 抽查橙优先封顶字数；`level` 只过某一级，不封顶——
   * 一级最多 levelSize 个字，本身就是个合理的会话长度。
   */
  startReview(scope: ReviewScope): Session | null {
    const pool =
      scope.kind === "level"
        ? cardsInLevel(this.progress.cards, scope.level, this.dict.levelSize)
        : this.progress.cards;
    const queue = scope.kind === "spot" ? spotCheckQueue(pool) : reviewQueue(pool);
    if (queue.length === 0) return null;
    this.session = { scope, queue, pos: 0, promoted: 0, pending: 0 };
    return this.session;
  }

  endSession(): void {
    this.session = null;
  }

  replace(progress: Progress): void {
    this.progress = progress;
    this.reindex();
    save(this.progress);
    this.emit();
  }

  reset(): void {
    this.progress = { version: this.progress.version, cards: [] };
    this.session = null;
    this.reindex();
    clear();
    this.emit();
  }
}
