import os
import re
import sys
import time
import json
import urllib.request
import boto3
from urllib.parse import urlparse

# ================= 基础配置 =================
UPSTREAM_REPO = "asystech-chen/Vantage"
R2_BUCKET = "vantage"

VD_JSON_PATH = "vantage/vd.json"
RELEASES_JSON_PATH = "vantage/releases.json"
SHA256SUMS_PATH = "vantage/SHA256SUMS"
DOCS_CONFIG_PATH = "vdocs/docs-config.json"
VUD_DIR = "vud"

LATEST_BADGE = '<span style="font-size: 0.8rem; background: #dbeafe; color: var(--vantage-blue); padding: 3px 8px; border-radius: 12px; font-weight: normal;">最新版本</span>'


def download_with_retry(url, dest_path, retries=3):
    """带重试机制的流式下载，防止大文件网络抖动中断"""
    headers = {"User-Agent": "ASYS-Auto-Updater"}
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as resp, open(dest_path, "wb") as out_file:
                while True:
                    chunk = resp.read(1024 * 1024)  # 每次读取 1MB
                    if not chunk:
                        break
                    out_file.write(chunk)
            return
        except Exception as e:
            print(f"⚠️ 下载失败 (第 {attempt}/{retries} 次尝试): {url} -> {e}")
            if attempt == retries:
                raise RuntimeError(f"❌ 文件下载彻底失败，已终止流水线: {url}") from e
            time.sleep(3)


def get_release_info(target_version=""):
    """获取师傅仓库的 Release 信息（支持 Pre-release 或指定版本）"""
    headers = {"User-Agent": "ASYS-Auto-Updater"}
    gh_token = os.environ.get("GITHUB_TOKEN")
    if gh_token:
        headers["Authorization"] = f"Bearer {gh_token}"

    if target_version:
        tag = target_version if target_version.startswith("v") else f"v{target_version}"
        url = f"https://api.github.com/repos/{UPSTREAM_REPO}/releases/tags/{tag}"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    else:
        # 拉取列表第 1 条，不论是 Pre-release 还是 Latest 都能抓到最新一版
        url = f"https://api.github.com/repos/{UPSTREAM_REPO}/releases?per_page=1"
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=30) as resp:
            releases = json.loads(resp.read().decode("utf-8"))
            if not releases:
                raise RuntimeError("❌ 未找到任何 Release！")
            return releases[0]


def classify_folder(filename):
    """按文件名归类到 amd / aarch / loong 三个目录（排除 .msix 和校验签名文件）"""
    if filename.startswith("SHA256SUMS") or filename.endswith(".msix") or filename.endswith(".asc"):
        return None
    if "x86_64" in filename or "amd64" in filename:
        return "amd"
    if "aarch64" in filename or "arm64" in filename:
        return "aarch"
    if "loongarch64" in filename or "loong64" in filename:
        return "loong"
    return None


def parse_version_tuple(ver_str):
    """
    标准化版本号排序：兼容两段式 (153.0-6) 与三段式 (153.5.0-1)
    统一转换为 (major, minor, patch, rev) 四元组，绝不排错顺序
    """
    if "-" in ver_str:
        main_part, rev_part = ver_str.split("-", 1)
    else:
        main_part, rev_part = ver_str, "0"

    main_nums = [int(x) for x in re.findall(r"\d+", main_part)]
    while len(main_nums) < 3:
        main_nums.append(0)

    rev_nums = [int(x) for x in re.findall(r"\d+", rev_part)]
    rev = rev_nums[0] if rev_nums else 0

    return tuple(main_nums[:3] + [rev])


def preflight_check_and_prepare(version, assets):
    """
    【第一重安全锁】前置完整性校验：
    在上传 R2 或改任何网页前，确保 SHA256SUMS 和 vd.json 所需的 16 个文件全部齐全！
    """
    print("🔍 正在执行前置完整性检查（防止半成品 Release 炸站）...")
    asset_map = {a["name"]: a for a in assets if a.get("size", 0) > 0}

    if "SHA256SUMS" not in asset_map:
        sys.exit("❌ 致命错误：Release 中未找到 SHA256SUMS 文件（可能还在编译上传中），已安全中止！")

    # 先把 SHA256SUMS 下载到临时文件做校验
    tmp_sha_path = "tmp_dl/SHA256SUMS"
    download_with_retry(asset_map["SHA256SUMS"]["browser_download_url"], tmp_sha_path)

    hash_map = {}
    with open(tmp_sha_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 2:
                hash_val = parts[0].upper()
                filename = parts[-1].replace("*", "").strip()
                hash_map[filename] = hash_val

    with open(VD_JSON_PATH, "r", encoding="utf-8") as f:
        vd_data = json.load(f)

    prev_version = vd_data.get("version", "").strip()
    original_links = vd_data.get("links", {})
    ver_regex = re.compile(r"\d+\.\d+(?:\.\d+)?-\d+")

    missing_in_release = []
    missing_in_sha256 = []

    for key, url in original_links.items():
        if key.endswith("_sha256") or not url.strip():
            continue
        expected_url = ver_regex.sub(version, url)
        expected_fname = os.path.basename(urlparse(expected_url).path)

        if expected_fname not in asset_map:
            missing_in_release.append(expected_fname)
        if expected_fname not in hash_map:
            missing_in_sha256.append(expected_fname)

    if missing_in_release or missing_in_sha256:
        print("❌ 前置校验未通过！发现缺失文件：")
        if missing_in_release:
            print(f"  - Release 列表中缺少安装包: {missing_in_release}")
        if missing_in_sha256:
            print(f"  - SHA256SUMS 中缺少哈希记录: {missing_in_sha256}")
        sys.exit("🛑 已触发防炸站保护：未修改任何 R2 文件或官网代码，请等师傅仓库全部上传完毕后再试！")

    # 校验全部通过后，正式覆盖 SHA256SUMS
    os.replace(tmp_sha_path, SHA256SUMS_PATH)
    print(f"✅ 前置校验 100% 通过！共核对所需安装包与哈希记录无误（上一版本: {prev_version} -> 新版本: {version}）")
    return hash_map, prev_version


def sync_to_r2_and_cleanup(version, prev_version, assets, download_dir):
    """上传新版本到 R2，并在全部上传成功后清理上上个版本（严格保留最新 2 个版本）"""
    s3 = boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT_URL"].strip(),
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"].strip(),
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"].strip(),
        region_name="auto",
    )

    # 1. 下载并按分类上传到 R2
    uploaded_count = 0
    for asset in assets:
        fname = asset["name"]
        folder = classify_folder(fname)
        if not folder:
            print(f"⏭️ 跳过无需上传 R2 的文件: {fname}")
            continue

        local_path = os.path.join(download_dir, fname)
        print(f"⬇️ 正在下载: {fname} ({asset['size'] / 1024 / 1024:.2f} MB)")
        download_with_retry(asset["browser_download_url"], local_path)

        r2_key = f"latest/{folder}/{fname}"
        print(f"⬆️ 正在上传 R2: {r2_key}")
        s3.upload_file(local_path, R2_BUCKET, r2_key)
        os.remove(local_path)
        uploaded_count += 1

    print(f"✅ 新版本 {version} 共 {uploaded_count} 个安装包已全部上传至 R2！")

    # 2. 扫描 R2 的三个目录，只保留最新 2 个版本（且强制保护当前版本和上一版本）
    ver_pattern = re.compile(r"vantage[-_](\d+\.\d+(?:\.\d+)?-\d+)")
    protected_versions = {version}
    if prev_version:
        protected_versions.add(prev_version)

    for folder in ["amd", "aarch", "loong"]:
        prefix = f"latest/{folder}/"
        resp = s3.list_objects_v2(Bucket=R2_BUCKET, Prefix=prefix)
        contents = resp.get("Contents", [])

        version_files = {}
        for obj in contents:
            key = obj["Key"]
            m = ver_pattern.search(key)
            if m:
                ver = m.group(1)
                version_files.setdefault(ver, []).append(key)

        sorted_vers = sorted(version_files.keys(), key=parse_version_tuple, reverse=True)
        keep_vers = set(sorted_vers[:2]) | protected_versions

        print(f"📂 R2 目录 [{prefix}] 保留版本: {sorted(keep_vers, key=parse_version_tuple, reverse=True)}")
        for ver in sorted_vers:
            if ver not in keep_vers:
                for old_key in version_files[ver]:
                    print(f"🗑️ 删除 R2 上上个老版本文件 ({ver}): {old_key}")
                    s3.delete_object(Bucket=R2_BUCKET, Key=old_key)


def update_vd_json(version, hash_map):
    """更新 vantage/vd.json 的版本号、下载直链与 SHA256，保持原有空行排版"""
    with open(VD_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    data["version"] = version
    original_links = data.get("links", {})
    new_links = {}

    ver_regex = re.compile(r"\d+\.\d+(?:\.\d+)?-\d+")

    for key, url in original_links.items():
        if key.endswith("_sha256"):
            continue
        if url.strip():
            updated_url = ver_regex.sub(version, url)
            new_links[key] = updated_url
            filename = os.path.basename(urlparse(updated_url).path)
            new_links[f"{key}_sha256"] = hash_map[filename]
        else:
            new_links[key] = ""

    data["links"] = new_links
    json_str = json.dumps(data, indent=4, ensure_ascii=False)

    blank_line_keys = [
        '"mac_intel_dmg"',
        '"linux_x64_deb"',
        '"linux_x64_rpm"',
        '"linux_x64_appimage"',
        '"linux_x64_tar"',
        '"linux_x64_tar_xz"',
        '"loong64_deb"',
    ]
    for bk in blank_line_keys:
        json_str = json_str.replace(f"        {bk}", f"\n        {bk}")

    with open(VD_JSON_PATH, "w", encoding="utf-8") as f:
        f.write(json_str + "\n")
    print("✅ vantage/vd.json 更新完成")


def update_releases_json(version):
    """在 vantage/releases.json 顶部插入新版本记录"""
    with open(RELEASES_JSON_PATH, "r", encoding="utf-8") as f:
        releases = json.load(f)

    tag_with_space = f"v{version} "
    if not any(r.get("tag_name", "").strip() == f"v{version}" for r in releases):
        new_entry = {
            "tag_name": tag_with_space,
            "name": f"Vantage Browser {version}",
            "html_url": "https://asystech.cn/vantage/vdownload.html",
        }
        releases.insert(0, new_entry)
        with open(RELEASES_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(releases, f, indent=2, ensure_ascii=False)
            f.write("\n")
    print("✅ vantage/releases.json 更新完成")


def update_docs_config(version):
    """在 vdocs/docs-config.json 的更新日志分类顶部插入新版本"""
    with open(DOCS_CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)

    for cat in config.get("categories", []):
        if cat.get("title") == "更新日志":
            items = cat.get("items", [])
            item_id = f"changelog-{version}"
            if not any(i.get("id") == item_id for i in items):
                items.insert(
                    0,
                    {
                        "id": item_id,
                        "title": version,
                        "file": f"../vud/{version}.html",
                    },
                )
            break

    with open(DOCS_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("✅ vdocs/docs-config.json 更新完成")


def format_inline_md(text):
    """处理行内加粗、行内代码、超链接与箭头符号"""
    text = text.replace("→", "->")
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2" target="_blank" class="docs-link">\1</a>', text)
    return text


def generate_changelog_html(version, md_body):
    """将 Release Markdown 转换为官网标准 HTML 结构，并移交'最新版本'标签"""
    for fname in os.listdir(VUD_DIR):
        if fname.endswith(".html") and fname != f"{version}.html":
            fpath = os.path.join(VUD_DIR, fname)
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
            if "最新版本</span>" in content:
                content = re.sub(r"\s*<span[^>]*>最新版本</span>", "", content)
                with open(fpath, "w", encoding="utf-8") as f:
                    f.write(content)

    lines = (md_body or "").replace("\r\n", "\n").split("\n")
    intro_lines = []
    sections = []
    current_sec = None

    for raw_line in lines:
        line = raw_line.rstrip()
        if not line or line.strip() == "---":
            continue

        # 兼容 ## 标题 和 ### 标题
        header_match = re.match(r"^#{2,3}\s+(.+)$", line.strip())
        if header_match:
            current_sec = {"title": header_match.group(1).strip(), "items": []}
            sections.append(current_sec)
        elif current_sec is None:
            cleaned = re.sub(r"^>\s*", "", line.strip())
            cleaned = cleaned.replace("**", "").replace("→", "->")
            intro_lines.append(cleaned)
        else:
            stripped = line.lstrip()
            if stripped.startswith("- ") or stripped.startswith("* "):
                indent = len(line) - len(stripped)
                item_html = format_inline_md(stripped[2:].strip())
                if indent >= 2 and current_sec["items"]:
                    current_sec["items"][-1]["sub"].append(item_html)
                else:
                    current_sec["items"].append({"text": item_html, "sub": []})

    html = [
        '<div class="step-block">',
        '    <h2 style="margin-top: 0; color: #111827; font-size: 1.4rem; display: flex; align-items: center; gap: 10px;">',
        f"        v{version}",
        f"        {LATEST_BADGE}",
        "    </h2>",
        '    <div class="step-content">',
        "",
    ]

    if intro_lines:
        html.append('        <p style="margin-bottom: 24px; padding-left: 12px; border-left: 3px solid #e5e7eb; color: var(--text-sub);">')
        for i, iline in enumerate(intro_lines):
            br = "<br>" if i < len(intro_lines) - 1 else ""
            html.append(f"            {iline}{br}")
        html.append("        </p>")
        html.append("")

    for sec in sections:
        html.append(f'        <h3 style="font-size: 1.25em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; margin-top: 24px; margin-bottom: 16px;">{sec["title"]}</h3>')
        html.append("        <ul>")
        for item in sec["items"]:
            if item["sub"]:
                html.append(f'            <li>{item["text"]}')
                html.append('                <ul style="margin-top: 8px; margin-bottom: 8px;">')
                for sub_item in item["sub"]:
                    html.append(f"                    <li>{sub_item}</li>")
                html.append("                </ul>")
                html.append("            </li>")
            else:
                html.append(f'            <li>{item["text"]}</li>')
        html.append("        </ul>")
        html.append("")

    html.extend([
        '        <p style="color: var(--text-sub); margin-bottom: 20px; margin-top: 30px;">如果觉得好用，麻烦点个star吧！</p>',
        '        <div style="margin-top: 25px;">',
        f'            <a href="https://github.com/{UPSTREAM_REPO}/releases/tag/v{version}" target="_blank" class="docs-link">🔗 在 GitHub 查看完整 Release 页面</a>',
        "        </div>",
        "    </div>",
        "</div>",
        "",
    ])

    out_path = os.path.join(VUD_DIR, f"{version}.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(html))
    print(f"✅ {out_path} 生成完成")


def main():
    target_ver = os.environ.get("INPUT_VERSION", "").strip()
    release = get_release_info(target_ver)

    tag_name = release["tag_name"].strip()
    version = tag_name.lstrip("v")
    is_prerelease = release.get("prerelease", False)
    print(f"🚀 开始同步 Vantage 版本: {version} (Tag: {tag_name}, Pre-release: {is_prerelease})")

    os.makedirs("tmp_dl", exist_ok=True)
    assets = release.get("assets", [])

    # 1. 前置校验（不全则直接终止，绝不破坏现有环境）
    hash_map, prev_version = preflight_check_and_prepare(version, assets)

    # 2. 上传新包到 R2 并清理上上个版本
    sync_to_r2_and_cleanup(version, prev_version, assets, "tmp_dl")

    # 3. 全部上传成功后，才修改本地 JSON 和 HTML
    update_vd_json(version, hash_map)
    update_releases_json(version)
    update_docs_config(version)
    generate_changelog_html(version, release.get("body", ""))
    print(f"🎉 Vantage {version} 官网与 R2 全链路安全更新完成！")


if __name__ == "__main__":
    main()