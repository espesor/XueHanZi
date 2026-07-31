import "./styles.css";
import { registerSW } from "virtual:pwa-register";
import { Store } from "./store";
import type { Dict } from "./types";
import { mountApp } from "./ui/app";

const root = document.getElementById("app");
if (!root) throw new Error("找不到 #app");

boot(root).catch((err: unknown) => {
  console.error(err);
  root.replaceChildren(
    Object.assign(document.createElement("div"), {
      className: "boot-error",
      textContent: "字库没能加载。检查一下网络，然后刷新页面。",
    }),
  );
});

async function boot(mount: HTMLElement): Promise<void> {
  const res = await fetch(new URL("chars.json", document.baseURI));
  if (!res.ok) throw new Error(`chars.json ${res.status}`);
  const dict = (await res.json()) as Dict;
  if (!Array.isArray(dict.chars) || dict.chars.length === 0) {
    throw new Error("chars.json 是空的");
  }
  mountApp(mount, new Store(dict));
  registerSW({ immediate: true });
}
