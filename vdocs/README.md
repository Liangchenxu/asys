# vdocs 文档维护指南

本目录是 Vantage 官网的文档系统（文档中心：`https://asystech.cn/vantage/docs.html`）。
本指南写给以后维护网站的任何人——**照着做就能完成文档更新，不需要自己折腾 HTML/CSS/JS**。

## 〇、首次准备（只需一次）

`md-build.py` 使用 GitHub 官方渲染内核 cmarkgfm（装在仓库虚拟环境里），先建环境：

```bash
cd ~/asys
python3 -m venv .venv
.venv/bin/pip install cmarkgfm
```

之后所有转换命令都用 `.venv/bin/python3` 开头（见下文）。

---

## 一、目录结构

```
vdocs/
├── *.md            ← 文档源（Markdown，**日常只改这里**）
├── *.html          ← 转换产物（HTML 片段，⚠️ 不要手改，会被 md-build.py 覆盖）
├── docs-config.json← 文档目录树配置（新增文档要在这里注册）
├── img/            ← 文档图片素材（截图、示意图）
└── README.md       ← 本指南
```

> 注意：`vdocs/` 里的 `.html` 是**片段**（不是完整页面），由文档中心的框架页加载显示。
> 顶层还有 `vud/`（各版本更新日志片段）和 `jc/`（主站教程，用法相同）。

## 二、日常任务速查

### 任务 1：写一篇新文档

1. 在 `vdocs/` 新建 `xxx.md`（写作格式见第三节）
2. 转换：
   ```bash
   .venv/bin/python3 md-build.py
   ```
3. 注册到目录树：编辑 `docs-config.json`，在合适的分类下加一条（见第四节）
4. 本地预览 → 推送上线（见第六节）

### 任务 2：修改现有文档

1. 编辑对应的 `vdocs/xxx.md`（**不是** `.html`！）
2. `.venv/bin/python3 md-build.py` 重新转换
3. 推送

### 任务 3：发布新版本的更新日志

1. 参照 `vud/` 里现有文件，新建 `vud/vX.Y.Z.html`（HTML 片段，格式见第五节）
2. 在 `docs-config.json` 的「更新日志」分类**最前面**加一条（最新版本放最上）
3. 可选：把旧版本文件里的"最新版本"角标去掉，加到新文件上
4. 推送

### 任务 4：往文档里加图片

1. 图片文件放到 `vdocs/img/`
2. md 里写 `![](img/xxx.png)`（转换时自动修正路径，不用自己算相对路径）

### 任务 5：改了样式（css/js）之后

改了 `css/` 或 `js/` 下的文件，**必须**刷新版本号，否则用户浏览器会命中旧缓存：

```bash
python3 build_cache.py   # 给所有 HTML 的 css/js 链接刷 ?v=时间戳
```

## 三、Markdown 写作格式

渲染内核是 **cmarkgfm**（GitHub 官方解析器），**文档在官网上的展示与 GitHub 完全一致**（同一份 md 在 GitHub 仓库里看到什么，官网上就是什么）。

支持的语法：标题、段落、**加粗**、*斜体*、列表、表格、引用、代码块、图片、删除线 ~~、任务列表 - [x]、自动链接（裸 URL 自动变超链）。

```markdown
# 文档标题（一级标题，自动加底部边框）

简介段落……

## 章节标题

正文内容。**加粗**强调，[链接](https://asystech.cn)。

### 小节标题

- 列表项
- 列表项

| 表头1 | 表头2 |
|-------|-------|
| 内容  | 内容  |

> 引用/提示块

- [x] 已完成的任务
- [ ] 待办任务（GFM 任务列表）

~~删除线~~，裸链接自动变超链：https://asystech.cn

```bash
# 代码块：``` 后面写语言名（bash/python 等），自动获得高亮
echo "hello"
```
```

注意：

- 代码块必须写语言名（` ```bash `），自动获得：顶栏语言标签、复制按钮、行号、语法高亮、长行自动折行——**这些都不需要你操心**，运行时自动生成
- **标题的 `#` 后面必须跟一个空格**：`## 3. RHEL 系统` 才是标题；`##3. RHEL 系统` 会被当成普通段落显示（GitHub 上也一样）
- **表格不能顶格插在有序列表中间**（会把列表断成两截）：要让表格属于某一步骤，整体缩进 4 个空格，表格就会嵌进该列表项（见 `jc/usb-rescue.md` 第三步的写法）
- 标题会自动获得 GitHub 风格锚点（中文保留，如 `## 系统急救 U 盘制作指南` → `#系统急救-u-盘制作指南`），可放心在别处链接
- 文件名用英文小写 + 连字符（如 `linux-repos.md`）
- 文件必须以换行结尾

## 四、目录树配置（docs-config.json）

`docs.html` 的左侧目录树读这个文件。结构：

```json
{
  "categories": [
    {
      "title": "分类名（显示在左侧）",
      "items": [
        {
          "id": "唯一标识（URL 锚点用）",
          "title": "显示名",
          "file": "../vdocs/xxx.html"
        }
      ]
    }
  ]
}
```

规则：

- **新增文档后必须在这里注册**，否则目录树里看不到
- `id` 唯一；更新日志的 id 建议用 `changelog-版本号`（如 `changelog-153.0-6`）
- `file` 路径相对文档中心页面（`vantage/docs.html`），所以是 `../vdocs/` 开头
- JSON 语法：**不能有注释、不能有尾逗号**，改完可以用 `python3 -c "import json; json.load(open('vdocs/docs-config.json'))"` 检查

## 五、更新日志格式（vud/）

每个版本一个 HTML 片段，参考现有文件，固定结构：

```html
<div class="step-block">
    <h2>v153.0-6 <span>最新版本</span></h2>
    <h3>分类名（如：功能）</h3>
    <ul>
        <li>改动说明</li>
    </ul>
    <p>如果觉得好用，麻烦点个 star！</p>
</div>
```

## 六、推送上线

```bash
git add -A
git commit -m "feat: 文档更新……"   # 中文，fix:/feat:/chore: 前缀
git push git@github.com:Liangchenxu/asys.git gh-pages
```

- GitHub Pages 约 1-3 分钟生效
- 推送**必须用 SSH 地址**（HTTPS 直连可能被墙）
- 修改/删除已有文件前，先确认

## 七、常见问题

| 现象 | 原因 / 解决 |
|------|------------|
| 改了 md 页面没变化 | 忘了跑 `md-build.py`；或浏览器缓存，强制刷新 Ctrl+Shift+R |
| 图片不显示 | 确认图片在 `vdocs/img/`，md 里写 `![](img/xxx.png)` |
| 目录树里没有新文档 | 没在 `docs-config.json` 注册，或 JSON 语法错误 |
| 标题没变成标题（显示成一堆 `##xxx`） | 标题 `#` 后没加空格，改成 `## 标题` |
| 表格把列表拆断了 | 表格顶格插在列表中间了，把表格整体缩进 4 个空格（见第三节） |
| 命令 `python3 md-build.py` 报找不到 cmarkgfm | 渲染内核装在 venv 里，用 `.venv/bin/python3 md-build.py`；没建过环境先看第〇节 |
| 改了 css/js 没生效 | 没跑 `build_cache.py`（版本号没刷新） |
| 手改了 .html 被覆盖 | 正常现象，.html 是产物，改 md 才是正解 |
| 想改文档样式 | 只改 `css/docs.css`（内容排版），不要动 `global.css` 里的文档相关部分 |

## 八、脚本说明

| 脚本 | 作用 | 用法 |
|------|------|------|
| `md-build.py` | Markdown → HTML 片段（内核 cmarkgfm，GitHub 同款渲染） | `.venv/bin/python3 md-build.py`（vdocs）或 `.venv/bin/python3 md-build.py jc`（主站教程） |
| `unify-docs.py` | 清除历史 HTML 里的内联样式（一次性整理工具） | `python3 unify-docs.py` |
| `build_cache.py` | 刷新全站 css/js 缓存版本号 | `python3 build_cache.py` |

> ⚠️ `md-build.py` 依赖 cmarkgfm（装在 `.venv/`，不入库，见 .gitignore）；另外两个脚本只用标准库。

> ⚠️ 前端适配以 **Firefox 为基准**（Vantage 用户用 Firefox 内核）：适配 Firefox 的基本都适配 Chromium，反之不一定。例如长行代码用自动折行而不是横向滚动条（Linux 下 Firefox 的 GTK overlay 滚动条无法用 CSS 压制）。
