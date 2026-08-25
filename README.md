# ASYS 官网仓库

赛思科技（ASYS）官方网站 + Vantage 浏览器官网 + 搜索起始页。

- 部署：GitHub Pages（gh-pages 分支，push 即自动部署，1-3 分钟生效）
- 域名：asystech.cn（CNAME）
- 远端：`https://github.com/Liangchenxu/asys`

## 目录结构

| 目录 | 内容 |
|------|------|
| `pc/` | 主站页面（首页、产品、服务、关于、Debian 下载、驱动下载、Office、教程中心等） |
| `vantage/` | Vantage 浏览器页面：`index.html`（产品页）、`vdownload.html`（下载页）、`docs.html`（文档中心） |
| `vdocs/` | Vantage 文档（HTML 片段，由 docs.html 的树状目录加载） |
| `vud/` | 各版本更新日志片段（按版本一个文件） |
| `start/` | 搜索起始页（含工具箱工具页） |
| `css/` | 全站样式：`global.css`（全站）、`docs.css`（文档页专用）、`highlight-github.min.css`（代码高亮主题） |
| `js/` | `global.js`（全站逻辑 + 文档树/代码块运行时功能）、`highlight.min.js`（highlight.js） |
| `img/` `exe/` | 静态资源、可执行文件 |
| `deb-donation/` `tools/` `jc/` | Debian 捐赠页、工具清单、教程 |

## 文档系统（vdocs + docs.html）

文档中心是「左侧树状目录 + 右侧内容」结构，内容为 HTML 片段，由 `js/global.js` 动态加载。

- **目录配置**：`vdocs/docs-config.json`（分类嵌套、文档项、更新日志按版本拆分）
- **文档源**：Markdown（`vdocs/*.md`），产物为同名 `.html` 片段
- **代码块运行时功能**（docs.html 的 JS 自动生成，无需在文档里写）：
  - 顶栏：语言名 + 复制按钮
  - 语法高亮（highlight.js，GitHub Light 主题）
  - 行号（CSS counter 伪元素，不污染复制文本）
  - 长行自动折行（`white-space: pre-wrap`，无横向滚动条）

### 文档写作工作流

```bash
# 1. 写 Markdown：vdocs/xxx.md（图片放 vdocs/img/，md 里写 ![](img/xxx.png)）
# 2. 转换：
python3 md-build.py
# 3. 如需注册到目录树：编辑 vdocs/docs-config.json 加条目
# 4. 刷缓存版本号（改了 css/js 后必做）：
python3 build_cache.py
# 5. 推送
git push git@github.com:Liangchenxu/asys.git gh-pages
```

### 样式说明

- 文档样式集中在 `css/docs.css`（与全站 `global.css` 分离）
- 排版为传统 Markdown 风格（GitHub README 参照）：标题深色 + 底部细线、正文近黑、链接标准蓝
- ⚠️ **前端适配以 Firefox 为基准**（Vantage 用户用 Firefox 内核；适配 Firefox 的基本都适配 Chromium，反之不一定）——例：长行代码用折行而非横向滚动条（Linux GTK overlay 滚动条无法用 CSS 压制）

### 工具脚本

| 脚本 | 作用 |
|------|------|
| `md-build.py` | `vdocs/*.md` → `.html` 片段（表格/代码块/锚点，图片路径自动修正） |
| `unify-docs.py` | 清除文档 HTML 中冗余的内联样式（docs.css 统一接管），一次性工具 |
| `build_cache.py` | 给所有 HTML 的 css/js 链接刷 `?v=时间戳` 版本号（改了 css/js 必跑） |

## 维护约定

- 提交信息：中文，`fix:` / `feat:` / `chore:` 前缀
- 所有写/生成的文件以 `\n` 结尾（POSIX）
- 推送用 SSH 最稳：`git push git@github.com:Liangchenxu/asys.git gh-pages`（HTTPS 直连可能被墙）
- 修改/删除已有文件前先确认
