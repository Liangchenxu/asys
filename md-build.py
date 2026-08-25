#!/usr/bin/env python3
"""md-build.py — 将指定目录下的 *.md 批量转换为同目录 .html 片段（供 docs.html / tutorials.html 加载）

用法:
  python3 md-build.py           # 默认转换 vdocs/（Vantage 文档）
  python3 md-build.py jc        # 转换 jc/（主站教程）

写作约定:
  - 源文件: <dir>/xxx.md（Markdown）
  - 产物:   <dir>/xxx.html（HTML 片段，非完整页面，样式由 docs.css 统一控制）
  - 图片:   统一放在 <dir>/img/ 目录，md 中写 ![](img/xxx.png)，脚本自动补 ../<dir>/ 前缀
  - 支持的 Markdown 特性: 表格 / 代码块(```) / 标题锚点 / 引用 / 列表
  - 代码块行号/复制按钮/语法高亮: 由页面 JS 在运行时生成（insertCodeHeaders →
    highlight.js → wrapCodeLines），转换时无需处理，保持 <pre><code class="language-xx"> 结构即可
"""
import argparse
import re
import sys
from pathlib import Path

import markdown

BASE = Path(__file__).resolve().parent

EXTENSIONS = [
    "tables",      # GFM 表格
    "fenced_code", # ``` 围栏代码块
    "toc",         # 标题自动生成锚点 id
    "sane_lists",  # 列表解析更严格（避免误判）
]


def convert(md_path: Path, img_prefix: str) -> str:
    text = md_path.read_text(encoding="utf-8")
    body = markdown.markdown(text, extensions=EXTENSIONS)
    # 图片路径修正: md 中写 img/xxx.png（相对 <dir>/），但 HTML 片段被
    # 上层页面加载后相对路径按页面解析，所以补 ../<dir>/ 前缀
    body = re.sub(r'(src|href)="(?:\./)?img/', rf'\1="{img_prefix}img/', body)
    return body


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dir", nargs="?", default="vdocs", help="md 所在目录（默认 vdocs）")
    args = parser.parse_args()

    doc_dir = BASE / args.dir
    md_files = sorted(doc_dir.glob("*.md"))
    if not md_files:
        print(f"{doc_dir} 下没有找到 .md 文件")
        return 1

    img_prefix = f"../{args.dir}/"
    converted = 0
    for md_path in md_files:
        html_path = doc_dir / (md_path.stem + ".html")
        body = convert(md_path, img_prefix)
        if not body.endswith("\n"):
            body += "\n"  # 保证以 \n 结尾（POSIX 习惯）
        html_path.write_text(body, encoding="utf-8")
        print(f"✅ {md_path.name} → {html_path.name}")
        converted += 1

    print(f"🎉 共转换 {converted} 个文件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
