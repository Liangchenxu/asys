import json
import os
from urllib.parse import urlparse

VD_JSON_PATH = 'vd.json'
SHA256SUMS_PATH = 'SHA256SUMS'

def main():
    # 1. 解析 SHA256SUMS 文件
    hash_map = {}
    if not os.path.exists(SHA256SUMS_PATH):
        print(f"❌ 找不到文件: {SHA256SUMS_PATH}")
        return

    with open(SHA256SUMS_PATH, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 2:
                hash_val = parts[0].upper() 
                filename = parts[-1].replace('*', '').strip()
                hash_map[filename] = hash_val

    # 2. 读取 vd.json
    if not os.path.exists(VD_JSON_PATH):
        print(f"❌ 找不到文件: {VD_JSON_PATH}")
        return

    with open(VD_JSON_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    original_links = data.get('links', {})
    new_links = {}

    # 3. 精准匹配并按顺序插入
    for key, url in original_links.items():
        if key.endswith('_sha256'):
            continue

        new_links[key] = url

        if url.strip():
            filename = os.path.basename(urlparse(url).path)
            if filename in hash_map:
                new_links[f"{key}_sha256"] = hash_map[filename]
                print(f"✅ 成功添加: {key}_sha256")
            else:
                print(f"⚠️ 未找到匹配的文件名: {filename}")

    data['links'] = new_links

    # ==========================================
    # 🌟 核心美化逻辑：把字典转成文本后，手动塞入空行
    # ==========================================
    # 先转成标准格式的 JSON 字符串
    json_str = json.dumps(data, indent=4, ensure_ascii=False)
    
    # 定义需要在哪些模块前面加空行（严格匹配缩进的 8 个空格）
    blank_line_keys = [
        '"mac_intel_dmg"',
        '"linux_x64_deb"',
        '"linux_x64_rpm"',
        '"linux_x64_appimage"',
        '"linux_x64_tar"',
        '"linux_x64_tar_xz"',
        '"loong64_deb"'
    ]
    
    # 遍历替换，强制注入换行符 (\n)
    for bk in blank_line_keys:
        json_str = json_str.replace(f'        {bk}', f'\n        {bk}')

    # 4. 把美化后的字符串直接写进文件
    with open(VD_JSON_PATH, 'w', encoding='utf-8') as f:
        f.write(json_str)
    
    print("\n🎉 vd.json 更新成功！空行排版已完美恢复。")

if __name__ == '__main__':
    main()