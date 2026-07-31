/** 朗读。用浏览器自带的 speechSynthesis，没有中文语音包就老实说没有。 */

let cached: SpeechSynthesisVoice | null | undefined;

export function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * 挑一个中文语音。voices 在部分浏览器里是异步填充的，
 * 所以每次没拿到就重试，拿到了才缓存。
 */
function chineseVoice(): SpeechSynthesisVoice | null {
  if (cached !== undefined && cached !== null) return cached;
  if (!isSupported()) return null;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null; // 还没加载好，下次再说

  const zh = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("zh"));
  cached =
    zh.find((v) => v.lang.toLowerCase().startsWith("zh-cn")) ??
    zh[0] ??
    null;
  return cached;
}

export function cancel(): void {
  if (isSupported()) window.speechSynthesis.cancel();
}

/** 依次读出每一段，中间由浏览器自然断句。 */
export function speak(texts: readonly string[]): void {
  if (!isSupported()) return;
  cancel();
  const voice = chineseVoice();
  for (const t of texts) {
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "zh-CN";
    u.rate = 0.85;
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  }
}
