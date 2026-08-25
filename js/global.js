/* =========================================
   全局暴露函数 (供 HTML 的 onclick 调用)
   ========================================= */
// Debian 页面：图片切换
function switchImage(index) {
    document.querySelectorAll('.gallery-item').forEach(item => item.classList.remove('active'));
    const target = document.getElementById('img-' + index);
    if (target) target.classList.add('active');

    document.querySelectorAll('.thumb-box').forEach(thumb => thumb.classList.remove('active'));
    const thumbs = document.querySelectorAll('.thumb-box');
    if (thumbs[index - 1]) thumbs[index - 1].classList.add('active');
}

// Debian 页面：Tab 切换
function switchTab(element, contentId) {
    document.querySelectorAll('.tab-item').forEach(item => item.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
    document.getElementById('con-' + contentId).classList.add('active');
}

/* =========================================
   各页面的专属生命周期逻辑 (DOM 加载后执行)
   ========================================= */
document.addEventListener('DOMContentLoaded', function () {

    const isDebian = document.body.classList.contains('page-debian');
    const isVantageHome = document.body.classList.contains('page-vantage-home');
    const isVDownload = document.body.classList.contains('page-vdownload');

    // -----------------------------------------
    // 1. Debian 页面专属特效：点击大图放大 (灯箱)
    // -----------------------------------------
    if (isDebian) {
        const galleryItems = document.querySelectorAll('.gallery-item img');
        const modal = document.getElementById('imageModal');
        const modalImg = document.getElementById('modalImg');

        if (modal && modalImg) {
            galleryItems.forEach(img => {
                img.style.cursor = 'zoom-in'; // 鼠标变放大镜
                img.onclick = function () {
                    modalImg.src = this.src;
                    modal.style.display = 'flex';
                }
            });
        }
    }

    // -----------------------------------------
    // 2. Vantage 首页专属特效：背景视差滚动
    // -----------------------------------------
    if (isVantageHome) {
        const parallaxBg = document.getElementById('parallax-bg');
        if (parallaxBg) {
            const baseOpacity = 0.5;
            const fadeDistance = 600;
            let ticking = false;

            function updateParallax() {
                const scrolled = window.scrollY;
                let scale = 1 + (scrolled * 0.0008);
                let currentOpacity = baseOpacity - (scrolled / fadeDistance) * baseOpacity;
                if (currentOpacity < 0) currentOpacity = 0;

                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        parallaxBg.style.transform = `translate3d(-50%, -50%, 0) scale(${scale})`;
                        parallaxBg.style.opacity = currentOpacity;
                        ticking = false;
                    });
                    ticking = true;
                }
            }
            window.addEventListener('scroll', updateParallax, { passive: true });
            updateParallax(); // 初始化一次
        }
    }

    // -----------------------------------------
    // 3. Vantage 下载页专属逻辑：JSON 获取与按钮联动
    // -----------------------------------------
    if (isVDownload) {

        // ✨ 新功能：自动从 releases.json 读取最新版本号
        fetch('releases.json')
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    // 读取第一个元素的 tag_name，并用 trim() 自动去掉两端多余的空格
                    const latestTag = data[0].tag_name.trim();
                    const versionDisplay = document.getElementById('version-display');
                    if (versionDisplay) {
                        versionDisplay.innerHTML = `当前版本：${latestTag}`;
                    }
                }
            })
            .catch(err => console.error("读取 releases.json 失败", err));


        // 获取下载链接数据
        const CURRENT_VERSION = "vd";
        let linkData = {};

        fetch(`${CURRENT_VERSION}.json`)
            .then(res => res.json())
            .then(data => {
                linkData = data.links;
                // 注意：这里不再用 vd.json 里的版本号了，因为上面已经交给 releases.json 处理了

                // Windows 下拉框联动
                const winArch = document.getElementById('win-arch');
                const btnWin = document.getElementById('btn-win');

                if (btnWin) {
                    function updateWinBtn() {
                        if (winArch && winArch.value === 'arm64') {
                            btnWin.href = linkData.win_arm64_exe || "#";
                        } else {
                            // 兼容新版 win_x64_exe 或旧版 windows_exe 命名
                            btnWin.href = linkData.win_x64_exe || linkData.windows_exe || "#";
                        }
                    }
                    if (winArch) {
                        winArch.addEventListener('change', updateWinBtn);
                    }
                    updateWinBtn();
                }





                // Loong64 下拉框联动
                const loong64Format = document.getElementById('loong64-format');
                const btnLoong64 = document.getElementById('btn-loong64'); // 确保 HTML 里有 id="btn-loong64" 的按钮

                function updateLoong64Btn() {

                    if (!loong64Format || !btnLoong64) return; // 防御性编程，避免找不到元素报错

                    const format = loong64Format.value;
                    const jsonKey = `loong64_${format}`;

                    const targetLink = linkData[jsonKey];
                    if (targetLink && targetLink !== "") {
                        btnLoong64.href = targetLink;                 // 修改为 btnLoong64
                        btnLoong64.textContent = "下载";               // 修改为 btnLoong64
                        btnLoong64.style.opacity = "1";
                        btnLoong64.style.pointerEvents = "auto";
                        btnLoong64.style.cursor = "pointer";
                    } else {
                        btnLoong64.href = "javascript:void(0);";       // 修改为 btnLoong64
                        btnLoong64.textContent = "暂不提供此版本";      // 修改为 btnLoong64
                        btnLoong64.style.opacity = "0.4";
                        btnLoong64.style.pointerEvents = "none";
                        btnLoong64.style.cursor = "not-allowed";
                    }
                }

                // 必须绑定事件，否则下拉框改变时不会触发更新
                if (loong64Format) {
                    loong64Format.addEventListener('change', updateLoong64Btn);
                }
                updateLoong64Btn(); // 页面加载完初始化执行一次




                // Linux 下拉框联动
                const linuxFormat = document.getElementById('linux-format');
                const linuxArch = document.getElementById('linux-arch');
                const btnLinux = document.getElementById('btn-linux');

                function updateLinuxBtn() {
                    const format = linuxFormat.value;
                    const arch = linuxArch.value;
                    const jsonKey = `linux_${arch}_${format}`;

                    const targetLink = linkData[jsonKey];
                    if (targetLink && targetLink !== "") {
                        btnLinux.href = targetLink;
                        btnLinux.textContent = "下载";
                        btnLinux.style.opacity = "1";
                        btnLinux.style.pointerEvents = "auto";
                        btnLinux.style.cursor = "pointer";
                    } else {
                        btnLinux.href = "javascript:void(0);";
                        btnLinux.textContent = "暂不提供此版本";
                        btnLinux.style.opacity = "0.4";
                        btnLinux.style.pointerEvents = "none";
                        btnLinux.style.cursor = "not-allowed";
                    }
                }






                linuxFormat.addEventListener('change', updateLinuxBtn);
                linuxArch.addEventListener('change', updateLinuxBtn);
                updateLinuxBtn();

                // macOS 下拉框联动 (无链接置灰逻辑)
                const macArch = document.getElementById('mac-arch');
                const btnMac = document.getElementById('btn-mac');

                function updateMacBtn() {
                    let targetLink = macArch.value === 'intel' ? linkData.mac_intel_dmg : linkData.mac_apple_dmg;

                    if (targetLink && targetLink !== "") {
                        btnMac.href = targetLink;
                        btnMac.textContent = "下载";
                        btnMac.style.opacity = "1";
                        btnMac.style.pointerEvents = "auto";
                        btnMac.style.cursor = "pointer";
                    } else {
                        btnMac.href = "javascript:void(0);";
                        btnMac.textContent = "暂不提供此版本";
                        btnMac.style.opacity = "0.4";
                        btnMac.style.pointerEvents = "none";
                        btnMac.style.cursor = "not-allowed";
                    }
                }
                macArch.addEventListener('change', updateMacBtn);
                updateMacBtn();

                initSmartDetection(linkData);
            })
            .catch(err => {
                console.error("JSON加载失败", err);
                const smartText = document.getElementById('smart-text');
                // 这里已经锁定为读取 vd.json 如果还报错 149.0-3，绝对是 CDN 缓存！
                if (smartText) smartText.textContent = `⚠️ 读取 ${CURRENT_VERSION}.json 失败，请检查文件`;
            });

        function initSmartDetection(linkData) {
            const ua = window.navigator.userAgent;
            const smartBtn = document.getElementById('smart-btn');
            const smartText = document.getElementById('smart-text');
            const smartIcon = document.getElementById('smart-icon');

            if (!smartBtn) return;

            if (ua.indexOf("Windows") !== -1) {
                smartText.textContent = "下载 Vantage for Windows";
                smartIcon.textContent = "💻";
                smartBtn.href = linkData.win_x64_exe || linkData.windows_exe || "#";
            } else if (ua.indexOf("Mac") !== -1) {
                smartIcon.textContent = "🍎";
                // Mac 智能检测联动：如果没有链接则置灰
                if (linkData.mac_intel_dmg || linkData.mac_apple_dmg) {
                    smartText.textContent = "下载 Vantage for macOS";
                    smartBtn.href = linkData.mac_intel_dmg || linkData.mac_apple_dmg || "#";
                } else {
                    smartText.textContent = "暂不提供 macOS 版本";
                    smartBtn.href = "javascript:void(0);";
                    smartBtn.style.opacity = "0.5";
                    smartBtn.style.cursor = "not-allowed";
                }
            } else if (ua.indexOf("Linux") !== -1 || ua.indexOf("X11") !== -1) {
                smartIcon.textContent = "🐧";

                // 【核心修复】：在 Linux 分支内，进一步判断 CPU 架构
                // 龙芯的新架构是 loongarch64，老架构可能是 mips64 或 mips64el
                if (ua.indexOf("loongarch64") !== -1 || ua.indexOf("mips64") !== -1 || ua.indexOf("LoongArch") !== -1) {
                    smartText.textContent = "下载 Vantage for Linux (loong64)";
                    // 请将下方的 linkData.linux_loongson_deb 替换为你实际的龙芯下载链接变量
                    smartBtn.href = linkData.linux_loongson_deb || "#";
                }
                // 如果你们还有 ARM 架构（比如飞腾、鲲鹏），可以继续加判断
                // else if (ua.indexOf("aarch64") !== -1 || ua.indexOf("arm64") !== -1) { ... }
                else {
                    // 默认分配 x64 (AMD/Intel) 版本的 Linux
                    smartText.textContent = "下载 Vantage for Linux (.deb)";
                    smartBtn.href = linkData.linux_x64_deb || "#";
                }
            } else {
                document.getElementById('smart-download-section').style.display = 'none';
            }
        }

    }
});
// =========================================================
// 🚀 无敌 DRY 架构：公共 Header 和 Footer 自动注入器
// =========================================================
function injectCommonComponents() {
    const headerContainer = document.getElementById('app-header');
    const footerContainer = document.getElementById('app-footer');
    const isVantageSite = document.body.classList.contains('site-vantage');

    // 注入导航栏
    if (headerContainer) {
        headerContainer.innerHTML = isVantageSite ? `
            <nav>
                <div class="nav-left">
                    <a href="index.html" class="nav-logo">
                        <img src="../img/icon.svg" alt="Vantage Logo">
                        <span>Vantage</span>
                    </a>
                    <div class="vantage-nav-links">
                        <a href="index.html" data-target="index.html">主页</a>
                        <a href="vdownload.html" data-target="vdownload.html">下载</a>
                        <a href="docs.html" data-target="docs.html">文档</a>
                    </div>
                </div>
                <a href="../index.html" class="asys-main-link" title="返回首页">
                    <img src="../img/asys.svg" alt="ASYS 科技">
                </a>
            </nav>
        ` : `
            <header>
                <div class="container">
                    <nav>
                        <a href="index.html" class="debian-logo">
                            <img src="../img/ASYS-3.png" alt="赛思科技 Logo">
                            <h1>赛思科技</h1>
                        </a>
                        <div class="debian-nav-links">
                            <a href="index.html" data-target="index.html">首页</a>
                            <a href="service-guide.html" data-target="service-guide.html">自助服务</a>
                            <a href="products.html" data-target="products.html">产品</a>
                            <a href="tutorials.html" data-target="tutorials.html">教程</a>
                            <a href="../vantage/index.html" data-target="vantage.html">Vantage浏览器</a>
                            <a href="../start/index.html" data-target="start/index.html">起始页</a>
                            <a href="about.html" data-target="about.html">关于 & 联系</a>
                        </div>
                    </nav>
                </div>
            </header>
        `;

        // 智能侦测当前页面，自动高亮对应按钮
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const links = headerContainer.querySelectorAll('a[data-target]');
        links.forEach(link => {
            if (link.getAttribute('data-target') === currentPath) {
                link.classList.add('active');
            }
        });
    }

    // 注入页脚
    if (footerContainer) {
        footerContainer.innerHTML = isVantageSite ? `
            <footer>
                <p>&copy; 2026 ASYS 科技 - Vantage 浏览器项目</p>
            </footer>
        ` : `
            <footer>
                <div class="container">
                    <p>© 2026 赛思科技. 保留所有权利。</p>
                </div>
            </footer>
        `;
    }
}
// 页面一加载立刻执行，防止闪烁
injectCommonComponents();

// =========================================================
// 🚀 教程页与文档页专属 JS 逻辑
// =========================================================
document.addEventListener('DOMContentLoaded', function () {
    // --- 教程页面逻辑 ---
    if (document.body.classList.contains('page-tutorials')) {
        const TUTORIALS_LIST_URL = `https://asystech.cn/jc/tutorials-list.json`;
        fetch(TUTORIALS_LIST_URL)
            .then(res => res.ok ? res.json() : Promise.reject(res.status))
            .then(tutorials => {
                document.getElementById('sidebar-loading').style.display = 'none';
                const tutorialList = document.getElementById('tutorial-list');
                tutorialList.innerHTML = '';
                tutorials.forEach(tutorial => {
                    const li = document.createElement('li');
                    li.className = 'toc-item';
                    const a = document.createElement('a');
                    a.className = 'toc-link';
                    a.textContent = tutorial.title;
                    a.onclick = (e) => {
                        e.preventDefault();
                        document.querySelectorAll('.toc-link').forEach(l => l.classList.remove('active'));
                        a.classList.add('active');
                        loadTutorialContent(tutorial.filePath);
                        if (window.innerWidth <= 768) document.querySelector('.tutorial-content').scrollIntoView({ behavior: 'smooth' });
                    };
                    li.appendChild(a);
                    tutorialList.appendChild(li);
                });
                tutorialList.style.display = 'block';
                if (tutorials.length > 0) tutorialList.querySelector('.toc-link').click();
            })
            .catch(() => {
                document.getElementById('sidebar-loading').style.display = 'none';
                document.getElementById('sidebar-error').style.display = 'block';
            });

        window.loadTutorialContent = function (filePath) {
            document.getElementById('content-placeholder').style.display = 'none';
            document.getElementById('tutorial-content').style.display = 'none';
            document.getElementById('content-error').style.display = 'none';
            document.getElementById('content-loading').style.display = 'flex';
            fetch(filePath)
                .then(res => res.ok ? res.text() : Promise.reject(res.status))
                .then(html => {
                    document.getElementById('content-loading').style.display = 'none';
                    const container = document.getElementById('tutorial-content');
                    container.innerHTML = html;
                    container.style.display = 'block';
                    container.querySelectorAll('img').forEach(img => {
                        if (!img.style.width) { img.style.maxWidth = '100%'; img.style.height = 'auto'; }
                    });
                })
                .catch(() => {
                    document.getElementById('content-loading').style.display = 'none';
                    document.getElementById('content-error').style.display = 'flex';
                });
        };
    }

    // --- 文档页面逻辑（树状目录）---
    if (document.body.classList.contains('page-docs')) {
        const sidebarContainer = document.getElementById('sidebar-container');
        const mainContent = document.getElementById('main-content');
        let docsConfig = [];

        fetch('../vdocs/docs-config.json')
            .then(res => res.json())
            .then(data => {
                docsConfig = data.categories;
                sidebarContainer.innerHTML = renderTree(docsConfig);
                loadDocFromHash();
            })
            .catch(() => {
                sidebarContainer.innerHTML = '<p style="color:red;">配置读取失败</p>';
                mainContent.innerHTML = '<div class="loading-text" style="color:red;">❌ 无法读取文档列表</div>';
            });

        // 递归渲染目录树（顶级分类默认收起，保持清爽）
        function renderTree(categories) {
            let html = '';
            categories.forEach(category => {
                html += `<div class="doc-cat">`;
                html += `<div class="doc-cat-header"><span class="doc-cat-arrow">▸</span>${category.title}</div>`;
                html += `<ul class="doc-cat-items">`;
                category.items.forEach(item => {
                    html += `<li><a onclick="loadDoc('${item.id}', '${item.file}')" id="link-${item.id}">${item.title}</a></li>`;
                });
                html += `</ul></div>`;
            });
            return html;
        }

        // 分类点击：展开/收起（手风琴：同时只展开一个分类）
        // 展开时直接打开该分类的第一篇文档，符合交互直觉
        sidebarContainer.addEventListener('click', e => {
            const header = e.target.closest('.doc-cat-header');
            if (!header) return;
            const cat = header.parentElement;
            const isOpen = cat.classList.contains('open');
            sidebarContainer.querySelectorAll('.doc-cat.open').forEach(c => c.classList.remove('open'));
            if (!isOpen) {
                cat.classList.add('open');
                const firstItem = cat.querySelector('.doc-cat-items a');
                if (firstItem) firstItem.click();
            }
        });

        // 展开指定分类所在目录
        function expandCatOf(linkEl) {
            sidebarContainer.querySelectorAll('.doc-cat.open').forEach(c => c.classList.remove('open'));
            const catEl = linkEl.closest('.doc-cat');
            if (catEl) catEl.classList.add('open');
        }

        // 代码块：外包 code-block，顶部 header 显示语言名 + 复制按钮
        function insertCodeHeaders(container) {
            container.querySelectorAll('pre').forEach(pre => {
                if (pre.parentElement && pre.parentElement.classList.contains('code-block')) return;
                const wrapper = document.createElement('div');
                wrapper.className = 'code-block';
                const langMatch = (pre.querySelector('code')?.className || '').match(/language-(\S+)/);
                const lang = langMatch ? langMatch[1] : '';
                const header = document.createElement('div');
                header.className = 'code-header';
                header.innerHTML = `<span class="code-lang"${lang ? '' : ' style="display:none;"'}>${lang}</span><button class="code-copy" type="button" aria-label="复制代码">复制</button>`;
                wrapper.appendChild(header);
                pre.parentNode.insertBefore(wrapper, pre);
                wrapper.appendChild(pre);
            });
        }

        // 复制按钮事件（事件委托，动态内容无需重复绑定）
        document.addEventListener('click', e => {
            const btn = e.target.closest('.code-copy');
            if (!btn) return;
            const block = btn.closest('.code-block') || btn.closest('pre');
            const code = block ? block.querySelector('code') : null;
            if (!code) return;
            const text = code.innerText;
            const done = () => {
                btn.textContent = '✓ 已复制';
                setTimeout(() => { btn.textContent = '复制'; }, 1500);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
            } else {
                fallbackCopy(text, done);
            }
        });

        // 剪贴板 API 不可用时的降级方案
        function fallbackCopy(text, done) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); } catch (err) { }
            document.body.removeChild(ta);
        }

        // 代码行号：高亮后按行包裹 span，行号由 CSS counter 生成（伪元素，不污染复制文本）
        function wrapCodeLines(container) {
            container.querySelectorAll('pre code').forEach(code => {
                if (code.querySelector('.hljs-line')) return;
                const lines = code.innerHTML.split('\n');
                if (lines.length && lines[lines.length - 1] === '') lines.pop();
                code.innerHTML = lines.map(line => `<span class="hljs-line">${line || ' '}</span>`).join('\n');
            });
        }

        window.loadDoc = function (id, filePath) {
            document.querySelectorAll('.docs-sidebar a').forEach(a => a.classList.remove('active'));
            const activeLink = document.getElementById(`link-${id}`);
            if (activeLink) {
                activeLink.classList.add('active');
                expandCatOf(activeLink);
            }
            window.history.pushState(null, null, `#${id}`);
            mainContent.innerHTML = '<div class="loading-text">加载中...</div>';
            fetch(filePath)
                .then(res => { if (!res.ok) throw new Error('找不到文件'); return res.text(); })
                .then(html => {
                    mainContent.innerHTML = html;
                    insertCodeHeaders(mainContent);
                    // 语法高亮（highlight.js）→ 行号包裹（顺序不能反）
                    if (window.hljs) {
                        mainContent.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
                    }
                    wrapCodeLines(mainContent);
                    window.scrollTo(0, 0);
                })
                .catch(() => {
                    mainContent.innerHTML = `<div class="loading-text" style="color:red;">❌ 无法加载文档内容。</div>`;
                });
        };

        window.loadDocFromHash = function () {
            const hash = window.location.hash.replace('#', '');
            let targetItem = null;
            if (hash) {
                docsConfig.forEach(cat => {
                    const found = cat.items.find(item => item.id === hash);
                    if (found) targetItem = found;
                });
            }
            if (!targetItem && docsConfig.length > 0) targetItem = docsConfig[0].items[0];
            if (targetItem) loadDoc(targetItem.id, targetItem.file);
        };

        window.addEventListener('popstate', loadDocFromHash);
    }
});