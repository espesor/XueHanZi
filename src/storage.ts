/** 进度的读写、导出、导入。见 DESIGN.md §7。 */
import type { Card, Progress } from "./types";

const KEY = "shizi.progress";
export const PROGRESS_VERSION = 1;

export function emptyProgress(): Progress {
  return { version: PROGRESS_VERSION, cards: [] };
}

export function load(dictSize: number): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyProgress();
    return sanitize(JSON.parse(raw), dictSize);
  } catch {
    // 存的东西坏了总比崩了强：当作没有进度，用户还能重新开始
    return emptyProgress();
  }
}

export function save(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // 隐私模式下写不进去。本次会话照常可用，不打断用户。
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 同上 */
  }
}

/** 把任意来路的数据收拾成合法的 Progress：非法下标丢掉，缺字段补默认。 */
export function sanitize(input: unknown, dictSize: number): Progress {
  const raw = input as { cards?: unknown } | null;
  if (!raw || !Array.isArray(raw.cards)) return emptyProgress();

  const seen = new Set<number>();
  const cards: Card[] = [];

  for (const item of raw.cards as unknown[]) {
    const c = item as Partial<Card> | null;
    if (!c || typeof c.i !== "number") continue;
    if (!Number.isInteger(c.i) || c.i < 0 || c.i >= dictSize) continue;
    if (seen.has(c.i)) continue;
    seen.add(c.i);

    const now = Date.now();
    cards.push({
      i: c.i,
      lv: c.lv === "g" ? "g" : "a",
      streak: numberOr(c.streak, 0),
      rep: numberOr(c.rep, 0),
      first: numberOr(c.first, now),
      seen: numberOr(c.seen, now),
    });
  }

  return { version: PROGRESS_VERSION, cards };
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function exportFile(progress: Progress): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob(
    [JSON.stringify({ app: "shizi", exportedAt: new Date().toISOString(), ...progress }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `识字进度-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importFile(file: File, dictSize: number): Promise<Progress> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  const progress = sanitize(parsed, dictSize);
  if (progress.cards.length === 0) throw new Error("文件里没有可用的进度");
  return progress;
}
