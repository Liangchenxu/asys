#!/usr/bin/env python3
"""md-build.py — 将指定目录下的 *.md 批量转换为同目录 .html 片段（供 docs.html / tutorials.html 加载）

用法:
  .venv/bin/python3 md-build.py           # 默认转换 vdocs/（Vantage 文档）
  .venv/bin/python3 md-build.py jc        # 转换 jc/（主站教程）

渲染内核: cmarkgfm（GitHub 官方 cmark-gfm 解析器的 Python 绑定，GitHub 渲染 README/issue 同款）
  - 开启 GitHub 扩展集: table / autolink / tagfilter / strikethrough / tasklist
  - 标题锚点 id 按 GitHub slugger 规则生成: 小写、保留中文等 Unicode 字母数字、
    空白与下划线转连字符、其余标点删除、重名追加 -1/-2（如「系统急救 U 盘制作指南」→ 系统急救-u-盘制作指南）
  - 代码块保持 <pre><code class="language-xx"> 结构（勿用 CMARK_OPT_GITHUB_PRE_LANG，
    否则语言会挪到 <pre lang> 上，与前端 global.js 的 code.language-* 匹配逻辑不兼容）

写作约定:
  - 源文件: <dir>/xxx.md（Markdown，GitHub Flavored Markdown 语法）
  - 产物:   <dir>/xxx.html（HTML 片段，非完整页面，样式由 docs.css 统一控制）
  - 图片:   统一放在 <dir>/img/ 目录，md 中写 ![](img/xxx.png)，脚本自动补 ../<dir>/ 前缀
  - 代码块行号/复制按钮/语法高亮: 由页面 JS 在运行时生成（insertCodeHeaders →
    highlight.js → wrapCodeLines），转换时无需处理，保持 <pre><code class="language-xx"> 结构即可
  - 支持 GitHub 语法: 表格 / 围栏代码块 / 删除线 ~~ / 任务列表 - [x] / 自动链接 / 标题锚点
"""
import argparse
import re
import sys
import unicodedata
from pathlib import Path

# cmarkgfm 在仓库虚拟环境 ~/asys/.venv 中（见 vdocs/README.md 脚本说明）
from cmarkgfm.cmark import markdown_to_html_with_extensions

BASE = Path(__file__).resolve().parent

# GitHub 开源扩展集（GitHub Flavored Markdown）
GFM_EXTENSIONS = ["table", "autolink", "tagfilter", "strikethrough", "tasklist"]

_SLUG_SPACE_RE = re.compile(r"[\s\-_]+")
_SLUG_TAG_RE = re.compile(r"<[^>]+>")


def _is_word_char(ch: str) -> bool:
    """GitHub slugger 的“单词字符”：连字符 + Unicode 字母/数字（中文等保留）。"""
    return ch == "-" or unicodedata.category(ch)[0] in ("L", "N")


def github_slug(text: str) -> str:
    """按 GitHub slugger 规则生成标题锚点（对齐 GitHub 页面上的 # 锚点）。"""
    s = _SLUG_TAG_RE.sub("", text)          # 剥掉标题内行内标签（code/a 等）
    s = s.lower().strip()
    s = _SLUG_SPACE_RE.sub("-", s)          # 空白/下划线/连字符 → 单个连字符
    s = "".join(ch for ch in s if _is_word_char(ch))  # 删其余标点，保留中文/字母/数字/连字符
    return s


def add_heading_ids(body: str) -> str:
    """给 h1-h6 注入 GitHub 风格 id，重名依次追加 -1、-2…"""
    seen: dict[str, int] = {}

    def repl(m: re.Match) -> str:
        level, inner = m.group(1), m.group(2)
        slug = github_slug(inner)
        if not slug:
            return m.group(0)               # 全标点标题：无锚点，保持原样
        if slug in seen:
            seen[slug] += 1
            slug = f"{slug}-{seen[slug]}"
        else:
            seen[slug] = 0
        return f'<h{level} id="{slug}">{inner}</h{level}>'

    return re.sub(r"<h([1-6])>(.*?)</h\1>", repl, body, flags=re.S)


def convert(md_path: Path, img_prefix: str) -> str:
    text = md_path.read_text(encoding="utf-8")
    body = markdown_to_html_with_extensions(text, options=0, extensions=GFM_EXTENSIONS)
    body = add_heading_ids(body)
    # 图片/链接路径修正: md 中写 img/xxx.png（相对 <dir>/），但 HTML 片段被
    # 上层页面加载后相对路径按页面解析，所以补 ../<dir>/ 前缀
    body = re.sub(r'(src|href)="(?:\./)?img/', rf'\1="{img_prefix}img/', body)
    return body


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dir", nargs="?", default="vdocs", help="md 所在目录（默认 vdocs）")
    args = parser.parse_args()

    doc_dir = BASE / args.dir
    md_files = sorted(f for f in doc_dir.glob("*.md") if f.name.lower() != "readme.md")
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
