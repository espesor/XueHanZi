# 识字

一个帮成年人把汉字认全的 web app。目标是从「认得一些字」走到「能顺畅读书报」。

- 3500 常用字（《通用规范汉字表》一级字表），按**实际使用频率**从易到难
- 自评「认识 / 不认识」，连着两次不看解释就认识，字才算学会
- 每 100 字升一级，每 500 字解锁一个名号
- PWA，装到手机上没网也能用；进度存在本地，可导出导入

设计和决策记录见 [DESIGN.md](DESIGN.md)。

## 跑起来

```bash
npm install
npm run dev
```

其他命令：

| 命令 | 做什么 |
|---|---|
| `npm run dev` | 开发服务器 |
| `npm run build` | 类型检查 + 生产构建，产物在 `dist/` |
| `npm run preview` | 预览构建产物（要验 PWA 就用这个，dev 模式下 service worker 行为不一样） |
| `npm test` | 跑单测 |
| `npm run data` | 重新生成字库 `public/chars.json` |

## 字库

`public/chars.json` 已经生成好了，日常开发不用管它。要重新生成：

```bash
pip install pypinyin wordfreq
npm run data
```

脚本会自己下载《通用规范汉字表》和 CC-CEDICT 到 `data/raw/`（不进版本库），然后：

1. 用 wordfreq 词频**摊到字上**算字频，据此排序（直接用单字频率会把「馆」这种几乎不单独成词的字排错位置）
2. 每个字挑 2 个最常见的组词，CC-CEDICT 负责判断是不是真词、是不是专名
3. pypinyin 注音，带常见变调

3500 个字里 3479 个配到了组词，剩下 21 个（瓤 嘁 蔫 檩 柒 …）本来就没有常用词。

> ⚠️ **字库的数组下标就是字的 ID，进度文件里存的是下标。** 顺序一旦发布就不能改，
> 否则所有人的进度会错位。要调整必须升 `version` 并写迁移。

图标也是脚本生成的：`python scripts/make_icons.py`（需要 Pillow 和一个楷体字体）。

## 结构

```
src/
├── srs.ts        判定规则（连对转绿、复习队列）— 纯函数，有单测
├── progress.ts   等级、里程碑、新字指针 — 纯函数，有单测
├── storage.ts    本地存储、导出导入
├── speech.ts     朗读
├── store.ts      状态中枢，UI 只通过它读写
└── ui/           learn / review / sheet / celebrate / modal / toast
```

规则层不碰 DOM，也不读 `Date.now()`（时间从参数传进来），所以能直接单测。

## 已知限制

- 拼音变调只覆盖常见几类，三声连读等不全
- 组词拼音是机器标的，没有人工全量校对
- 不教写字、不做发音评测、没有账号同步（跨设备靠导出导入文件）
