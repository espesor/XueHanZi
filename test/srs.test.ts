import { describe, expect, it } from "vitest";
import {
  grade,
  newCard,
  PROMOTE_STREAK,
  reviewQueue,
  sortForDisplay,
  spotCheckQueue,
} from "../src/srs";
import type { Card } from "../src/types";

const T = 1_700_000_000_000;

/** 直接认识（没查看） */
const know = (card: Card | null, now = T) => grade(card, card?.i ?? 0, "known", false, now);
/** 查看之后才说认识 */
const knowAfterLook = (card: Card | null, now = T) => grade(card, card?.i ?? 0, "known", true, now);
/** 不认识 */
const dunno = (card: Card | null, now = T) => grade(card, card?.i ?? 0, "unknown", true, now);

describe("转绿要连对两次", () => {
  it("第一次直接认识，停在橙色", () => {
    const o = know(null);
    expect(o.card.lv).toBe("a");
    expect(o.card.streak).toBe(1);
    expect(o.verdict).toBe("progress");
    expect(o.isNew).toBe(true);
  });

  it("第二次直接认识才转绿", () => {
    const o = know(know(null).card);
    expect(o.card.lv).toBe("g");
    expect(o.card.streak).toBe(PROMOTE_STREAK);
    expect(o.verdict).toBe("promoted");
    expect(o.isNew).toBe(false);
  });

  it("查看过再说认识不算数，连对归零", () => {
    const first = know(null).card;
    expect(first.streak).toBe(1);
    const o = knowAfterLook(first);
    expect(o.card.lv).toBe("a");
    expect(o.card.streak).toBe(0);
    expect(o.verdict).toBe("reset");
  });

  it("「不认识」把连对打回零", () => {
    const o = dunno(know(null).card);
    expect(o.card.lv).toBe("a");
    expect(o.card.streak).toBe(0);
  });

  it("查看后认识 → 不认识 → 连对两次，仍然能转绿", () => {
    let c = knowAfterLook(null).card;
    c = dunno(c).card;
    c = know(c).card;
    expect(c.lv).toBe("a");
    c = know(c).card;
    expect(c.lv).toBe("g");
  });
});

describe("绿字", () => {
  const green = () => know(know(null).card).card;

  it("再认对一次，巩固次数 +1，仍是绿的", () => {
    const o = know(green());
    expect(o.card.lv).toBe("g");
    expect(o.card.rep).toBe(1);
    expect(o.verdict).toBe("reinforced");
    expect(o.wasGreen).toBe(true);
  });

  it("巩固次数可以一直累加", () => {
    let c = green();
    for (let n = 0; n < 4; n++) c = know(c).card;
    expect(c.rep).toBe(4);
  });

  it("答错就掉回橙色，连对和巩固次数一起归零", () => {
    const g = know(know(green()).card).card;
    expect(g.rep).toBe(2);
    const o = dunno(g);
    expect(o.card.lv).toBe("a");
    expect(o.card.streak).toBe(0);
    expect(o.card.rep).toBe(0);
    expect(o.verdict).toBe("reset");
    expect(o.wasGreen).toBe(true);
  });

  it("需要查看才认出来，同样掉回橙色", () => {
    expect(knowAfterLook(green()).card.lv).toBe("a");
  });
});

describe("卡片字段", () => {
  it("首次学到的时间不随复习改变，上次见到的时间会更新", () => {
    const first = know(null, T).card;
    expect(first.first).toBe(T);
    const later = know(first, T + 86_400_000).card;
    expect(later.first).toBe(T);
    expect(later.seen).toBe(T + 86_400_000);
  });

  it("不修改传进来的卡片", () => {
    const before = newCard(7, T);
    const snapshot = { ...before };
    know(before);
    expect(before).toEqual(snapshot);
  });
});

describe("复习队列", () => {
  const deck: Card[] = [
    { i: 1, lv: "g", streak: 2, rep: 0, first: 10, seen: 10 },
    { i: 2, lv: "a", streak: 1, rep: 0, first: 20, seen: 20 },
    { i: 3, lv: "g", streak: 2, rep: 1, first: 30, seen: 30 },
    { i: 4, lv: "a", streak: 0, rep: 0, first: 40, seen: 40 },
  ];

  it("覆盖学过的全部字，一个不落也不重复", () => {
    const q = reviewQueue(deck);
    expect(q).toHaveLength(deck.length);
    expect(new Set(q).size).toBe(deck.length);
    expect([...q].sort()).toEqual([1, 2, 3, 4]);
  });

  it("橙色全部排在绿色之前", () => {
    const lv = new Map(deck.map((c) => [c.i, c.lv]));
    for (let run = 0; run < 40; run++) {
      const kinds = reviewQueue(deck).map((i) => lv.get(i));
      expect(kinds.indexOf("g")).toBeGreaterThan(kinds.lastIndexOf("a"));
    }
  });

  it("同色内部会打乱", () => {
    // rng 恒为 0 时 Fisher-Yates 必定把末位换到首位，结果可预测
    expect(reviewQueue(deck, () => 0)).toEqual([4, 2, 3, 1]);
  });

  it("多次调用不会总是同一个顺序", () => {
    const seen = new Set(Array.from({ length: 50 }, () => reviewQueue(deck).join(",")));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("没学过字就是空队列", () => {
    expect(reviewQueue([])).toEqual([]);
  });
});

describe("复习页排序", () => {
  it("橙色在前，同色里新学的在前", () => {
    const deck: Card[] = [
      { i: 1, lv: "g", streak: 2, rep: 0, first: 10, seen: 0 },
      { i: 2, lv: "a", streak: 0, rep: 0, first: 20, seen: 0 },
      { i: 3, lv: "g", streak: 2, rep: 0, first: 30, seen: 0 },
      { i: 4, lv: "a", streak: 1, rep: 0, first: 40, seen: 0 },
    ];
    expect(sortForDisplay(deck).map((c) => c.i)).toEqual([4, 2, 3, 1]);
  });

  it("不改动原数组", () => {
    const deck: Card[] = [
      { i: 1, lv: "g", streak: 2, rep: 0, first: 10, seen: 0 },
      { i: 2, lv: "a", streak: 0, rep: 0, first: 20, seen: 0 },
    ];
    sortForDisplay(deck);
    expect(deck.map((c) => c.i)).toEqual([1, 2]);
  });
});

describe("抽查队列", () => {
  // 下标区间故意不重叠，方便靠 i 值判断一张卡来自橙组还是绿组
  const amberHeavy: Card[] = Array.from({ length: 30 }, (_, i) => ({
    i,
    lv: "a",
    streak: 0,
    rep: 0,
    first: i,
    seen: i,
  }));
  const greenHeavy: Card[] = Array.from({ length: 30 }, (_, i) => ({
    i: i + 1000,
    lv: "g",
    streak: 2,
    rep: 0,
    first: i,
    seen: i,
  }));

  it("字数不超过上限时，等于完整的复习队列（橙优先照旧）", () => {
    const deck = [...amberHeavy.slice(0, 3), ...greenHeavy.slice(0, 3)];
    const spot = spotCheckQueue(deck, 20);
    const full = new Set(reviewQueue(deck));
    expect(spot).toHaveLength(6);
    expect(new Set(spot)).toEqual(full);
  });

  it("橙色字数超过上限时，抽出来的全是橙色", () => {
    const spot = spotCheckQueue(amberHeavy, 5);
    expect(spot).toHaveLength(5);
    for (const i of spot) expect(amberHeavy[i]?.lv).toBe("a");
  });

  it("橙色不够上限时，橙色全留下，剩下名额补绿色", () => {
    const deck = [...amberHeavy.slice(0, 4), ...greenHeavy];
    const spot = spotCheckQueue(deck, 10);
    expect(spot).toHaveLength(10);
    const amberIds = new Set(amberHeavy.slice(0, 4).map((c) => c.i));
    expect(spot.filter((i) => amberIds.has(i))).toHaveLength(4);
  });

  it("没学过字就是空队列", () => {
    expect(spotCheckQueue([])).toEqual([]);
  });
});
