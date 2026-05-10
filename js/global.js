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
    if(thumbs[index - 1]) thumbs[index - 1].classList.add('active');
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
document.addEventListener('DOMContentLoaded', function() {

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

        if(modal && modalImg) {
            galleryItems.forEach(img => {
                img.style.cursor = 'zoom-in'; // 鼠标变放大镜
                img.onclick = function() {
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
        const CURRENT_VERSION = "vd"; 
        let linkData = {}; 

        fetch(`${CURRENT_VERSION}.json`)
            .then(res => res.json())
            .then(data => {
                linkData = data.links;
                document.getElementById('version-display').innerHTML = `当前版本：${data.version}`;

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

                // macOS 下拉框联动
                const macArch = document.getElementById('mac-arch');
                const btnMac = document.getElementById('btn-mac');

                function updateMacBtn() {
                    if (macArch.value === 'intel') {
                        btnMac.href = linkData.mac_intel_dmg || "#";
                    } else {
                        btnMac.href = linkData.mac_apple_dmg || "#";
                    }
                    btnMac.textContent = "下载";
                    btnMac.style.opacity = "1";
                    btnMac.style.pointerEvents = "auto";
                }
                macArch.addEventListener('change', updateMacBtn);
                updateMacBtn();

                initSmartDetection(linkData);
            })
            .catch(err => {
                console.error("JSON加载失败", err);
                const smartText = document.getElementById('smart-text');
                if(smartText) smartText.textContent = `⚠️ 读取 ${CURRENT_VERSION}.json 失败，请检查文件`;
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
                smartText.textContent = "下载 Vantage for macOS";
                smartIcon.textContent = "🍎";
                smartBtn.href = linkData.mac_intel_dmg || "#";
            } else if (ua.indexOf("Linux") !== -1 || ua.indexOf("X11") !== -1) {
                smartText.textContent = "下载 Vantage for Linux (.deb)";
                smartIcon.textContent = "🐧";
                smartBtn.href = linkData.linux_x64_deb || "#";
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
            if(link.getAttribute('data-target') === currentPath) {
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
document.addEventListener('DOMContentLoaded', function() {
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
                        if (window.innerWidth <= 768) document.querySelector('.tutorial-content').scrollIntoView({behavior: 'smooth'});
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

        window.loadTutorialContent = function(filePath) {
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

    // --- 文档页面逻辑 ---
    if (document.body.classList.contains('page-docs')) {
        const sidebarContainer = document.getElementById('sidebar-container');
        const mainContent = document.getElementById('main-content');
        let docsConfig = []; 

        fetch('../vdocs/docs-config.json')
            .then(res => res.json())
            .then(data => {
                docsConfig = data.categories;
                window.vudFiles = data.changelog_files; // ✨ 新增：保存日志文件列表
                let html = '';
                docsConfig.forEach(category => {
                    html += `<h3>${category.title}</h3><ul>`;
                    category.items.forEach(item => {
                        html += `<li><a onclick="loadDoc('${item.id}', '${item.file}')" id="link-${item.id}">${item.title}</a></li>`;
                    });
                    html += `</ul>`;
                });
                sidebarContainer.innerHTML = html;
                loadDocFromHash(); 
            })
            .catch(() => {
                sidebarContainer.innerHTML = '<p style="color:red;">配置读取失败</p>';
                mainContent.innerHTML = '<div class="loading-text" style="color:red;">❌ 无法读取文档列表</div>';
            });

        window.loadDoc = function(id, filePath) {
            document.querySelectorAll('.docs-sidebar a').forEach(a => a.classList.remove('active'));
            const activeLink = document.getElementById(`link-${id}`);
            if (activeLink) activeLink.classList.add('active');
            window.history.pushState(null, null, `#${id}`);
            mainContent.innerHTML = '<div class="loading-text">加载中...</div>';
            fetch(filePath)
                .then(res => { if (!res.ok) throw new Error('找不到文件'); return res.text(); })
                .then(html => {
                    mainContent.innerHTML = html;
                    window.scrollTo(0, 0); 
                    if (id === 'changelog') renderChangelogFromJson();
                })
                .catch(() => {
                    mainContent.innerHTML = `<div class="loading-text" style="color:red;">❌ 无法加载文档内容。</div>`;
                });
        };

        window.loadDocFromHash = function() {
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

        // ✨ 重写：动态拼接 vud 文件夹中的内容
        window.renderChangelogFromJson = async function() {
            const container = document.getElementById('changelog-container');
            if(!container || !window.vudFiles) return;
            
            let finalHtml = '';
            // 按照 docs-config.json 里的排序，挨个去 vud 文件夹拉取 html
            for (const fileName of window.vudFiles) {
                try {
                    const res = await fetch(`../vud/${fileName}`);
                    if (res.ok) {
                        finalHtml += await res.text();
                    }
                } catch(e) { 
                    console.error("加载日志文件失败: ", fileName, e); 
                }
            }
            container.innerHTML = finalHtml;
        };

        window.addEventListener('popstate', loadDocFromHash);
    }
});