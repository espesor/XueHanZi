"""把 chars.json 导成 CSV，方便人工挑错。

用法： python data/export_csv.py
输出： data/chars-review.csv （Excel 打开要选 UTF-8，或者直接用 Numbers / Google Sheets）
"""

import csv
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).parent.parent
SRC = ROOT / "public" / "chars.json"
DEST = ROOT / "data" / "chars-review.csv"


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    chars = data["chars"]

    with DEST.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["序号", "字", "拼音", "组词1", "组词1拼音", "组词2", "组词2拼音", "备注"])
        for i, e in enumerate(chars):
            words = e["w"]
            w1, p1 = words[0] if len(words) > 0 else ("", "")
            w2, p2 = words[1] if len(words) > 1 else ("", "")
            w.writerow([i, e["c"], " / ".join(e["p"]), w1, p1, w2, p2, ""])

    print(f"写入 {DEST}  ({len(chars)} 行)")
    print("最后一列「备注」留空，方便你标注要改的地方。")


if __name__ == "__main__":
    main()
