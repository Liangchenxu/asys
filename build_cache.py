import os
import re
import time

def update_cache_busters(directory):
    # 生成年月日时分格式的时间戳 (例如：202606251042)
    version = time.strftime("%Y%m%d%H%M")

    # 匹配 .css 和 .js 链接的正则表达式
    css_pattern = re.compile(r'href="([^"]+\.css)(?:\?v=[^"]*)?"')
    js_pattern = re.compile(r'src="([^"]+\.js)(?:\?v=[^"]*)?"')

    html_files_updated = 0

    # 遍历目录下的所有文件
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".html"):
                filepath = os.path.join(root, file)

                # 读取原 HTML 内容
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()

                # 替换并加上新的时间戳版本号
                new_content = css_pattern.sub(rf'href="\1?v={version}"', content)
                new_content = js_pattern.sub(rf'src="\1?v={version}"', new_content)

                # 如果内容有变化，才写入文件
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"✅ 已更新文件: {file}")
                    html_files_updated += 1

    print(f"\n🎉 搞定！共给 {html_files_updated} 个 HTML 文件刷上了新版本号。当前直观时间戳: {version}")

# 执行脚本，'.' 代表处理当前目录及其所有子目录下的 HTML 文件
if __name__ == "__main__":
    print("开始自动刷新静态资源版本号...")
    update_cache_busters('.')