/** 撒花。DOM 粒子，够用且不引库；prefers-reduced-motion 直接不放。 */

const GREEN = ["#1C7A4E", "#4FC98A", "#17607A", "#C9E6D6"];
const MIX = ["#1C7A4E", "#EFA84C", "#17607A", "#BE3A2B", "#F7E7CD"];

let host: HTMLElement | null = null;

export function confetti(tone: "green" | "mix" = "green", count = 44): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!host) {
    host = document.createElement("div");
    host.id = "confetti";
    host.setAttribute("aria-hidden", "true");
    document.body.appendChild(host);
  }
  const colors = tone === "green" ? GREEN : MIX;
  for (let i = 0; i < count; i++) {
    const bit = document.createElement("i");
    bit.className = "bit";
    bit.style.left = `${35 + Math.random() * 30}vw`;
    bit.style.top = "32vh";
    bit.style.background = colors[i % colors.length]!;
    bit.style.setProperty("--dx", `${Math.random() * 440 - 220}px`);
    bit.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    bit.style.animationDelay = `${Math.random() * 0.25}s`;
    host.appendChild(bit);
    setTimeout(() => bit.remove(), 1900);
  }
}
