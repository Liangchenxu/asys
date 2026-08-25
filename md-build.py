#!/usr/bin/env python3
"""md-build.py — 将 vdocs/*.md 批量转换为 vdocs/*.html 片段（供 docs.html 树状目录加载）

用法: python3 md-build.py

写作约定:
  - 源文件: vdocs/xxx.md（Markdown）
  - 产物:   vdocs/xxx.html（HTML 片段，非完整页面，样式由 global.css 统一控制）
  - 图片:   统一放在 vdocs/img/ 目录，md 中写 ![](img/xxx.png)
            脚本自动补 ../vdocs/ 前缀（因为 docs.html 在 vantage/ 下加载）
  - 支持的 Markdown 特性: 表格 / 代码块(```) / 标题锚点 / 引用 / 列表
  - 代码块行号/复制按钮/语法高亮: 由 docs.html 的 JS 在运行时生成（insertCodeHeaders →
    highlight.js → wrapCodeLines），转换时无需处理，保持 <pre><code class="language-xx"> 结构即可
"""
import re
import sys
from pathlib import Path

import markdown

VDOCS = Path(__file__).resolve().parent / "vdocs"

EXTENSIONS = [
    "tables",      # GFM 表格
    "fenced_code", # ``` 围栏代码块
    "toc",         # 标题自动生成锚点 id
    "sane_lists",  # 列表解析更严格（避免误判）
]


def convert(md_path: Path) -> str:
    text = md_path.read_text(encoding="utf-8")
    body = markdown.markdown(text, extensions=EXTENSIONS)
    # 图片路径修正: md 中写 img/xxx.png（相对 vdocs/），
    # 但 HTML 片段被 docs.html(vantage/) 加载，img 相对路径按 docs.html 解析，
    # 所以需要补 ../vdocs/ 前缀才能正确指向 vdocs/img/xxx.png
    body = re.sub(r'(src|href)="(?:\./)?img/', r'\1="../vdocs/img/', body)
    return body


def main() -> int:
    md_files = sorted(VDOCS.glob("*.md"))
    if not md_files:
        print("没有找到 .md 文件")
        return 1

    converted = 0
    for md_path in md_files:
        html_path = VDOCS / (md_path.stem + ".html")
        body = convert(md_path)
        if not body.endswith("\n"):
            body += "\n"  # 保证以 \n 结尾（POSIX 习惯）
        html_path.write_text(body, encoding="utf-8")
        print(f"✅ {md_path.name} → {html_path.name}")
        converted += 1

    print(f"🎉 共转换 {converted} 个文件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
