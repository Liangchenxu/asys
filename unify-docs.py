#!/usr/bin/env python3
"""unify-docs.py — 统一文档页内联样式

删除 vdocs/*.html 中标签元素上的冗余内联 style。
所有元素的基础样式已由 css/docs.css 统一控制，内联样式只会造成页面风格不一致。

特殊处理:
  - shields.io 徽章行（display:flex 的 <p>）→ 替换为 class="badge-row"
  - 非 style 属性（onerror 等）不受影响
  - 代码块结构（pre/code）不在此脚本处理范围：行号/复制按钮/高亮由 docs.html 的 JS 运行时生成

用法: python3 unify-docs.py
"""
import re
import sys
from pathlib import Path

VDOCS = Path(__file__).resolve().parent / "vdocs"

BADGE_ROW_PAT = re.compile(r'<p style="display: flex; gap: 10px; flex-wrap: wrap;[^"]*">')
STYLE_PAT = re.compile(r'\s+style="[^"]*"')


def unify(path: Path) -> int:
    text = path.read_text(encoding="utf-8")
    orig = text
    # 1. 徽章行：flex 布局改为 class（删除后徽章会竖排）
    text = BADGE_ROW_PAT.sub('<p class="badge-row">', text)
    # 2. 删除所有标签上的内联 style（docs.css 统一接管）
    text = STYLE_PAT.sub("", text)
    if text == orig:
        return 0
    if not text.endswith("\n"):
        text += "\n"
    path.write_text(text, encoding="utf-8")
    return len(STYLE_PAT.findall(orig))


def main() -> int:
    total = 0
    for f in sorted(VDOCS.glob("*.html")):
        n = unify(f)
        if n:
            print(f"✅ {f.name}: 删除 {n} 处内联样式")
            total += n
    print(f"🎉 共删除 {total} 处内联样式")
    return 0


if __name__ == "__main__":
    sys.exit(main())
