#!/usr/bin/env python3
"""
刷新静态资源（css/js）的版本号 ?v=。

默认（推荐）：只刷新「本次改动过的资源文件」在页面中的引用，借助 git 判断改动内容。
    python3 build_cache.py
    -> 例如只改了 js/global.js，就只会刷引用了 global.js 的那些页面的这一条链接，
       其它资源、其它页面一律不动。

全量：忽略 git，给所有页面的所有 css/js 引用都刷上新时间戳（旧行为）。
    python3 build_cache.py --all
"""
import os
import re
import sys
import time
import subprocess

# 匹配 .css / .js 引用（带或不带 ?v=）
CSS_PATTERN = re.compile(r'href="([^"]+\.css)(?:\?v=[^"]*)?"')
JS_PATTERN = re.compile(r'src="([^"]+\.js)(?:\?v=[^"]*)?"')


def _git(args, cwd):
    """执行 git 命令，失败（非仓库 / 无 git）返回 None。"""
    try:
        result = subprocess.run(
            ['git'] + args, cwd=cwd,
            capture_output=True, text=True,
        )
        if result.returncode != 0:
            return None
        return result.stdout
    except (OSError, subprocess.SubprocessError):
        return None


def repo_root(cwd):
    """返回 git 仓库根目录；非仓库返回 None。"""
    out = _git(['rev-parse', '--show-toplevel'], cwd)
    return out.strip() if out else None


def changed_assets(cwd):
    """
    返回本次改动（相对 HEAD，含已暂存与未跟踪）的 css/js 文件路径集合，
    路径为相对仓库根的 posix 形式。git 不可用返回 None。
    """
    diff = _git(['diff', '--name-only', 'HEAD'], cwd)
    if diff is None:
        return None
    files = set()
    for line in diff.splitlines():
        if line.strip():
            files.add(line.strip())
    untracked = _git(['ls-files', '--others', '--exclude-standard'], cwd)
    if untracked:
        for line in untracked.splitlines():
            if line.strip():
                files.add(line.strip())
    return {f for f in files if f.lower().endswith(('.css', '.js'))}


def norm_ref(html_path, ref, base):
    """把页面里的资源引用规范化成相对 base 的 posix 路径；非本地引用返回 None。"""
    # 跳过 http(s): / data: / //cdn 之类的外部引用
    if re.match(r'^(?:[a-z][a-z0-9+.-]*:|//)', ref, re.I):
        return None
    ref = ref.split('?', 1)[0].split('#', 1)[0]
    target = os.path.abspath(os.path.join(os.path.dirname(html_path), ref))
    return os.path.relpath(target, base).replace(os.sep, '/')


def update_cache_busters(directory, only_changed=True):
    # 生成年月日时分格式的时间戳 (例如：202606251042)
    version = time.strftime("%Y%m%d%H%M")
    root = os.path.abspath(directory)

    changed = None
    base = root
    if only_changed:
        repo = repo_root(directory)
        changed = changed_assets(directory) if repo else None
        if changed is None:
            print("❌ 无法读取 git 改动信息（不在 git 仓库或 git 不可用）。")
            print("   如需忽略 git 全量刷新，请加 --all。")
            return
        if not changed:
            print("ℹ️ 本次没有 css/js 改动，无需刷新版本号。")
            return
        base = repo
        print("🔎 本次改动的资源：" + "、".join(sorted(changed)))

    html_updated = 0

    # 遍历目录下的所有文件
    for walk_root, dirs, files in os.walk(directory):
        for file in files:
            if not file.endswith(".html"):
                continue
            filepath = os.path.join(walk_root, file)

            # 读取原 HTML 内容
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            hits = []

            def css_sub(m):
                ref = m.group(1)
                if changed is None or norm_ref(filepath, ref, base) in changed:
                    hits.append(ref)
                    return rf'href="{ref}?v={version}"'
                return m.group(0)

            def js_sub(m):
                ref = m.group(1)
                if changed is None or norm_ref(filepath, ref, base) in changed:
                    hits.append(ref)
                    return rf'src="{ref}?v={version}"'
                return m.group(0)

            new_content = CSS_PATTERN.sub(css_sub, content)
            new_content = JS_PATTERN.sub(js_sub, new_content)

            # 如果内容有变化，才写入文件
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"✅ 已更新: {file}  ({len(hits)} 处: {', '.join(hits)})")
                html_updated += 1

    print(f"\n🎉 搞定！共给 {html_updated} 个 HTML 文件刷上了新版本号。当前直观时间戳: {version}")


# 执行脚本，'.' 代表处理当前目录及其所有子目录下的 HTML 文件
if __name__ == "__main__":
    all_mode = '--all' in sys.argv
    if all_mode:
        print("开始【全量】刷新静态资源版本号（--all）...")
    else:
        print("开始刷新【本次改动过的资源】的版本号（全量请加 --all）...")
    update_cache_busters('.', only_changed=not all_mode)
