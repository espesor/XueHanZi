import { describe, expect, it } from "vitest";
import {
  cardsInLevel,
  charLevel,
  countBy,
  crossing,
  levelBuckets,
  levelInfo,
  milestones,
  nextNewIndex,
} from "../src/progress";
import { sanitize } from "../src/storage";
import type { Card } from "../src/types";

const SIZE = 100;
const EVERY = 500;

const card = (i: number, lv: Card["lv"] = "a"): Card => ({
  i,
  lv,
  streak: 0,
  rep: 0,
  first: 0,
  seen: 0,
});

describe("等级", () => {
  it("一个字没学也是第 1 级", () => {
    const info = levelInfo(0, SIZE, EVERY);
    expect(info.level).toBe(1);
    expect(info.inLevel).toBe(0);
    expect(info.earned).toBe(0);
    expect(info.current).toBeNull();
    expect(info.next?.name).toBe("开卷");
  });

  it("学满 100 个进第 2 级，进度条归零", () => {
    const info = levelInfo(100, SIZE, EVERY);
    expect(info.level).toBe(2);
    expect(info.inLevel).toBe(0);
    expect(info.toNextLevel).toBe(100);
  });

  it("500 个字解锁第一个名号", () => {
    const info = levelInfo(500, SIZE, EVERY);
    expect(info.level).toBe(6);
    expect(info.earned).toBe(1);
    expect(info.current?.name).toBe("开卷");
    expect(info.next?.name).toBe("识途");
    expect(info.toNextMilestone).toBe(500);
  });

  it("3500 个字学完，没有下一个名号", () => {
    const info = levelInfo(3500, SIZE, EVERY);
    expect(info.level).toBe(36); // 第 35 级满了之后的落点
    expect(info.earned).toBe(7);
    expect(info.current?.name).toBe("博览");
    expect(info.next).toBeNull();
  });

  it("七个名号，字数正好铺满 3500", () => {
    const all = milestones(EVERY);
    expect(all).toHaveLength(7);
    expect(all.map((m) => m.at)).toEqual([500, 1000, 1500, 2000, 2500, 3000, 3500]);
  });
});

describe("升级判定", () => {
  it("刚好第 100 个字算升级，第 99、101 不算", () => {
    expect(crossing(99, SIZE, EVERY).level).toBe(false);
    expect(crossing(100, SIZE, EVERY).level).toBe(true);
    expect(crossing(101, SIZE, EVERY).level).toBe(false);
  });

  it("第 500 个字同时升级和解锁名号", () => {
    const c = crossing(500, SIZE, EVERY);
    expect(c.level).toBe(true);
    expect(c.milestone?.name).toBe("开卷");
  });

  it("第 100 个字只升级，不解锁名号", () => {
    expect(crossing(100, SIZE, EVERY).milestone).toBeNull();
  });

  it("第 3500 个字解锁最后一个名号", () => {
    expect(crossing(3500, SIZE, EVERY).milestone?.name).toBe("博览");
  });

  it("零个字不触发任何庆祝", () => {
    expect(crossing(0, SIZE, EVERY)).toEqual({ level: false, milestone: null });
  });
});

describe("字所在的级数", () => {
  it("按字库下标算，不看什么时候学的", () => {
    expect(charLevel(0, SIZE)).toBe(1);
    expect(charLevel(99, SIZE)).toBe(1);
    expect(charLevel(100, SIZE)).toBe(2);
    expect(charLevel(299, SIZE)).toBe(3);
  });

  it("cardsInLevel 只挑落在这一级范围内的卡片", () => {
    const deck = [card(0), card(99), card(100), card(199), card(200)];
    expect(cardsInLevel(deck, 1, SIZE).map((c) => c.i)).toEqual([0, 99]);
    expect(cardsInLevel(deck, 2, SIZE).map((c) => c.i)).toEqual([100, 199]);
    expect(cardsInLevel(deck, 3, SIZE).map((c) => c.i)).toEqual([200]);
    expect(cardsInLevel(deck, 4, SIZE)).toEqual([]);
  });

  it("levelBuckets 按级数升序分桶，绿橙分别计数", () => {
    const deck = [card(0, "g"), card(50, "a"), card(150, "g"), card(151, "a"), card(152, "a")];
    const buckets = levelBuckets(deck, SIZE);
    expect(buckets.map((b) => b.level)).toEqual([1, 2]);
    expect(buckets[0]).toMatchObject({ level: 1, green: 1, amber: 1 });
    expect(buckets[0]?.cards).toHaveLength(2);
    expect(buckets[1]).toMatchObject({ level: 2, green: 1, amber: 2 });
  });

  it("没学过字就是空桶列表", () => {
    expect(levelBuckets([], SIZE)).toEqual([]);
  });
});

describe("新字指针", () => {
  it("没学过就从第一个开始", () => {
    expect(nextNewIndex([], 3500)).toBe(0);
  });

  it("跳过学过的，返回第一个空位", () => {
    expect(nextNewIndex([card(0), card(1), card(2)], 3500)).toBe(3);
  });

  it("进度有洞时补洞 —— 导入的进度可能不连续", () => {
    expect(nextNewIndex([card(0), card(2), card(3)], 3500)).toBe(1);
  });

  it("学完整个字库返回字库大小", () => {
    const all = Array.from({ length: 5 }, (_, i) => card(i));
    expect(nextNewIndex(all, 5)).toBe(5);
  });
});

describe("计数", () => {
  it("按颜色数", () => {
    const deck = [card(0, "g"), card(1, "a"), card(2, "g")];
    expect(countBy(deck, "g")).toBe(2);
    expect(countBy(deck, "a")).toBe(1);
  });
});

describe("进度导入", () => {
  it("丢掉越界和非整数的下标", () => {
    const p = sanitize({ cards: [card(0), card(9999), { ...card(1), i: 1.5 }, card(2)] }, 100);
    expect(p.cards.map((c) => c.i)).toEqual([0, 2]);
  });

  it("丢掉重复的字", () => {
    const p = sanitize({ cards: [card(3), card(3), card(4)] }, 100);
    expect(p.cards.map((c) => c.i)).toEqual([3, 4]);
  });

  it("缺字段补默认，未知颜色当橙色", () => {
    const p = sanitize({ cards: [{ i: 0, lv: "purple" }] }, 100);
    expect(p.cards[0]).toMatchObject({ i: 0, lv: "a", streak: 0, rep: 0 });
    expect(typeof p.cards[0]?.first).toBe("number");
  });

  it("垃圾输入返回空进度而不是崩掉", () => {
    expect(sanitize(null, 100).cards).toEqual([]);
    expect(sanitize({}, 100).cards).toEqual([]);
    expect(sanitize({ cards: "nope" }, 100).cards).toEqual([]);
    expect(sanitize({ cards: [null, 42, "x"] }, 100).cards).toEqual([]);
  });
});
