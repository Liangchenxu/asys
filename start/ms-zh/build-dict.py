#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 ecdict-min.json：硬翻引擎前端词典（高频子集）

选词规则：frq<=50000（有词频的前 4.2 万高频词）+ collins 4/5 星 + oxford 3000
           + 强制保留覆盖词表词根（万无一失）
输出：{word: translation}，translation 保留完整词性段，由前端 pick_def 解析

用法:
    python3 build-dict.py                        # 默认读 ~/Vantage/scripts/ms-zh/dict/ecdict.csv
    python3 build-dict.py /path/ecdict.csv out.json
"""
import csv
import gzip
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else (
    Path.home() / "Vantage" / "scripts" / "ms-zh" / "dict" / "ecdict.csv"
)
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else BASE / "ecdict-min.json"

# 强制保留词（覆盖词表词根，OVERRIDES 优先于词典，但保险起见词典里也要有）
FORCE = set(
    "microsoft vantage browser computer firefox mozilla a an is are was were be at for of in the "
    "and to with by from on your you this that it we our as mode open save close delete update "
    "download settings options search privacy security password bookmark tab about support want "
    "apply change action run install create print ask remember trust use allow block enable "
    "disable cancel confirm continue restart start stop view show manage edit copy move add "
    "remove clear select enter submit accept deny keep provide recommend notice get make take "
    "can will would could should must may might shall what when where why how who which whose "
    "not no never always only just also already still please they them their those these there "
    "here time include more shift home pause vol echo if country date load break fix fixes fixed"
    .split()
)


def main():
    sel = {}
    with open(SRC, encoding="utf-8") as f:
        r = csv.reader(f)
        next(r)  # header
        for row in r:
            if len(row) < 4:
                continue
            word = row[0].strip().lower()
            if not word or "," in word:
                continue
            tr = row[3].strip()
            if not tr:
                continue
            try:
                frq = int(row[9]) if len(row) > 9 and row[9] else 0
            except ValueError:
                frq = 0
            collins = row[5].strip() if len(row) > 5 else ""
            oxford = row[6].strip() if len(row) > 6 else ""
            if word in FORCE or (frq and frq <= 50000) or collins in ("4", "5") or oxford == "1":
                sel[word] = tr
    js = json.dumps(sel, ensure_ascii=False, separators=(",", ":"))
    OUT.write_text(js, encoding="utf-8")
    print(f"词条: {len(sel)}")
    print(f"输出: {OUT} ({len(js.encode()) / 1048576:.2f} MB, gzip {len(gzip.compress(js.encode())) / 1048576:.2f} MB)")


if __name__ == "__main__":
    main()
