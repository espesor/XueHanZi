"""生成 chars.json —— 3500 常用字，按字频从易到难排序，每字附拼音和常见组词。

数据来源：
  raw/3500.txt      《通用规范汉字表》一级字表 3500 字（笔画序，仅用作字集）
  raw/cedict.txt.gz  CC-CEDICT，用来确认「这是不是一个真词」并提供释义过滤
  wordfreq           现代汉语词频（多语料合并），用来排字序和挑最常见的组词
  pypinyin           注音

用法： python build_chars.py
"""

import gzip
import json
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

from pypinyin import Style
from pypinyin.contrib.tone_convert import to_tone
from pypinyin.contrib.tone_sandhi import ToneSandhiMixin
from pypinyin.converter import DefaultConverter
from pypinyin.core import Pinyin
from wordfreq import get_frequency_dict

sys.stdout.reconfigure(encoding="utf-8")

# 直接取词表，不走 word_frequency —— 那条路会调 jieba 重新分词，既慢又没必要
FREQ = get_frequency_dict("zh")


class _SandhiConverter(ToneSandhiMixin, DefaultConverter):
    """加上变调：「你好」标 ní hǎo，「不是」标 bú shì。"""


pinyin = Pinyin(_SandhiConverter()).pinyin

ROOT = Path(__file__).parent
RAW = ROOT / "raw"

HAN = re.compile(r"^[一-鿿]+$")

# 组词里不要的词条：专名、异体字说明、方言/旧称等
BAD_DEF = re.compile(
    r"^(surname |variant of|old variant|erhua variant|archaic variant|"
    r"used in |abbr\. for |see |also written)",
    re.I,
)

# CC-CEDICT 收词偏保守，「很多」「一棵」这类透明复合词根本没收，
# 但它们恰恰是最该拿来组词的。词典里没有就看词频，另外限定双字词——
# 词典外的三字高频串多半是人名（刘亦菲、吴亦凡）。
FREQ_ADMIT = 2e-6
# CC-CEDICT 用拼音首字母大写标专名：杨过 [Yang2 Guo4] vs 荸荠 [bi2 qi2]。
# 这比看英文释义靠谱——「Chinese water chestnut」也是大写开头但并非专名。
# 国名地名（中国 [Zhong1 guo2]）同样大写，但词频高出几个数量级，用阈值放行。
PROPER_NOUN_MAX_FREQ = 1e-5


# raw/ 不进版本库（CC-CEDICT 有 4 MB），缺了就现下
SOURCES = {
    "3500.txt": (
        "https://raw.githubusercontent.com/elephantnose/characters/master/"
        "3500%E5%B8%B8%E7%94%A8%E6%B1%89%E5%AD%97.txt"
    ),
    "cedict.txt.gz": "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
}


def fetch_raw():
    RAW.mkdir(parents=True, exist_ok=True)
    for name, url in SOURCES.items():
        dest = RAW / name
        if dest.exists():
            continue
        print(f"下载 {name} …")
        urllib.request.urlretrieve(url, dest)
        print(f"  {dest.stat().st_size / 1024:.0f} KB")


def load_charset():
    text = (RAW / "3500.txt").read_text(encoding="utf-8")
    chars = [c for c in text if HAN.match(c)]
    seen, out = set(), []
    for c in chars:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out


def _cedict_pinyin_to_tone(py: str) -> str:
    """CC-CEDICT 用数字标调、ü 写作 u:（如 nu:3），转成 pypinyin 那种调号形式。"""
    return to_tone(py.replace("u:", "v"))


def load_cedict():
    """返回 {简体词: {"defs": [...], "proper": bool}}，只保留纯汉字词条。

    附带收集 CHAR_READINGS：{单字: {调号读音, ...}}，来自 CC-CEDICT 的单字条目
    （含姓氏、地名等专用读音，这些依然是标准现代普通话，只是用得少）。
    用来把 pypinyin 词典里混进来的古音／方言音（比如「能」的 tái/nái/nài/xióng）
    过滤掉——那些读音 CC-CEDICT 压根没收。
    """
    entries = {}
    char_readings = defaultdict(set)
    line_re = re.compile(r"^(\S+) (\S+) \[([^\]]*)\] /(.*)/$")
    with gzip.open(RAW / "cedict.txt.gz", "rt", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            m = line_re.match(line.strip())
            if not m:
                continue
            simp, py, defs = m.group(2), m.group(3), m.group(4)
            if not HAN.match(simp):
                continue
            e = entries.setdefault(simp, {"defs": [], "proper": True})
            e["defs"].extend(d.strip() for d in defs.split("/") if d.strip())
            # 只要有一条读音全小写，就说明它有普通词的用法
            if not any(s[:1].isupper() for s in py.split()):
                e["proper"] = False
            if len(simp) == 1:
                try:
                    char_readings[simp].add(_cedict_pinyin_to_tone(py.lower()))
                except ValueError:
                    pass  # 极少数条目（儿化等）转不了调号，跳过不影响整体
    return entries, char_readings


def char_frequencies():
    """按「所有词里出现的次数」统计字频，而不是「单独成词」的频率。

    直接用 word_frequency('馆') 会严重低估——它几乎不单独出现，
    但「宾馆/图书馆」很常见。所以要把词频摊到字上。
    """
    freq = defaultdict(float)
    for w, f in FREQ.items():
        if not HAN.match(w):
            continue
        for ch in w:
            freq[ch] += f
    return freq


def usable_word(w, f, cedict, allow_proper=False):
    """这个词能不能拿来当组词。"""
    e = cedict.get(w)
    if e:
        if all(BAD_DEF.match(d) for d in e["defs"]):
            return False
        if e["proper"] and not allow_proper and f < PROPER_NOUN_MAX_FREQ:
            return False
        return True
    # 词典没收：只认双字高频词
    return len(w) == 2 and f >= FREQ_ADMIT


def pick_words(ch, index, rank, cedict, limit=2, strict=True, allow_proper=False):
    """给一个字挑 limit 个组词。

    按词频排候选，然后把「其他字学习者已经学过（字频更高）」的词提到前面，
    这样组词里尽量不出现比本字更生僻的字。双字词略微优先于三字词。
    """
    cands = []
    for w in index.get(ch, ()):
        if strict and any(c not in rank for c in w):
            continue
        f = FREQ.get(w, 0.0)
        if f <= 0 or not usable_word(w, f, cedict, allow_proper):
            continue
        others = [c for c in w if c != ch]
        known = all(rank.get(c, 10 ** 9) <= rank[ch] for c in others)
        cands.append((f if len(w) == 2 else f * 0.6, known, w))

    cands.sort(key=lambda t: -t[0])
    pool = sorted(cands[:8], key=lambda t: (not t[1], -t[0]))

    out = []
    for _, _, w in pool:
        if w not in out:
            out.append(w)
        if len(out) == limit:
            break
    return out


def readings(ch, char_readings, max_n=3):
    """这个字的普通话读音，最多 max_n 个，常用在前。

    pypinyin 的多音字表混了不少古音、方言音（「能」给出 tái/nái/nài/xióng，
    「还」给出 fú，都不是现代普通话）。用 CC-CEDICT 收录过的读音做交集过滤：
    CC-CEDICT 是按现代词典条目收的，没有的多半是历史/方言读法。

    pypinyin 按内部词典顺序给候选，常用的基本排在前面，过滤后保留这个顺序。
    """
    hz = pinyin(ch, style=Style.TONE, heteronym=True)[0]
    valid = char_readings.get(ch)

    seen, out = set(), []
    for r in hz:
        if valid is not None and r not in valid:
            continue
        if r not in seen:
            seen.add(r)
            out.append(r)
        if len(out) == max_n:
            break

    # CC-CEDICT 没收这个字（生僻字），没法过滤，只能相信 pypinyin 的头一个读音
    if not out:
        out = [hz[0]]
    return out


def word_pinyin(w):
    return " ".join(p[0] for p in pinyin(w, style=Style.TONE))


def main():
    fetch_raw()
    charset = load_charset()
    print(f"字表: {len(charset)} 字")

    cedict, char_readings = load_cedict()
    print(f"CC-CEDICT: {len(cedict)} 个纯汉字词条，{len(char_readings)} 个单字有读音记录")

    freq = char_frequencies()
    print(f"字频统计覆盖 {len(freq)} 个字")

    # 按字频从高到低 = 从易到难；字表里没被词频覆盖到的排最后（按原笔画序）
    ordered = sorted(charset, key=lambda c: (-freq.get(c, 0.0), charset.index(c)))
    rank = {c: i for i, c in enumerate(ordered)}

    # 倒排：字 -> 含这个字的词。候选池取词频表，词典只用来做质量判断
    index = defaultdict(list)
    for w in FREQ:
        if 2 <= len(w) <= 3 and HAN.match(w):
            for c in set(w):
                index[c].append(w)

    out, no_words = [], []
    for ch in ordered:
        ws = pick_words(ch, index, rank, cedict)
        if not ws:
            # 放宽「组词里的字必须也在 3500 表内」再试一次，
            # 比如「荸」只有「荸荠」，而「荠」不在一级字表里
            ws = pick_words(ch, index, rank, cedict, strict=False)
        if not ws:
            # 姓氏和地名字（杭、沈、湘、沪）的正确组词本来就是专名，
            # 前面把专名筛掉了，这里放它们回来
            ws = pick_words(ch, index, rank, cedict, strict=False, allow_proper=True)
        if not ws:
            no_words.append(ch)
        out.append({
            "c": ch,
            "p": readings(ch, char_readings),
            "w": [[w, word_pinyin(w)] for w in ws],
        })

    payload = {
        "version": 1,
        "generated": date.today().isoformat(),
        "count": len(out),
        "levelSize": 100,
        "milestoneEvery": 500,
        "source": {
            "charset": "《通用规范汉字表》(2013) 一级字表 3500 字",
            "order": "wordfreq zh 词频摊到字上，从高到低",
            "words": "CC-CEDICT 词条 ∩ wordfreq 词频前 2",
            "pinyin": "pypinyin，多音字用 CC-CEDICT 收录过的读音做交集过滤，去掉古音/方言音",
        },
        "chars": out,
    }

    dest = ROOT.parent / "public" / "chars.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"\n写入 {dest}  ({dest.stat().st_size / 1024:.0f} KB)")

    if no_words:
        print(f"\n没配到组词的字 {len(no_words)} 个: {''.join(no_words)}")

    print("\n--- 多音字过滤抽查（旧的 pypinyin 全量候选 vs 过滤后）---")
    for ch in ["能", "还", "号", "朝", "重", "行", "单", "乐", "解"]:
        raw = pinyin(ch, style=Style.TONE, heteronym=True)[0]
        kept = next(e["p"] for e in out if e["c"] == ch)
        dropped = [r for r in dict.fromkeys(raw) if r not in kept]
        print(f"{ch}  留: {' / '.join(kept):<20} 去掉: {' / '.join(dropped) or '（无）'}")

    print("\n--- 前 20 字 ---")
    for e in out[:20]:
        ws = "  ".join(f"{w}({p})" for w, p in e["w"])
        print(f"{e['c']}  {' / '.join(e['p']):<16} {ws}")

    print("\n--- 第 1500 名附近 ---")
    for e in out[1495:1505]:
        ws = "  ".join(f"{w}({p})" for w, p in e["w"])
        print(f"{e['c']}  {' / '.join(e['p']):<16} {ws}")

    print("\n--- 最后 15 字 ---")
    for e in out[-15:]:
        ws = "  ".join(f"{w}({p})" for w, p in e["w"])
        print(f"{e['c']}  {' / '.join(e['p']):<16} {ws}")


if __name__ == "__main__":
    main()
