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
        const CURRENT_VERSION = "149.0-3"; 
        let linkData = {}; 

        fetch(`${CURRENT_VERSION}.json`)
            .then(res => res.json())
            .then(data => {
                linkData = data.links;
                document.getElementById('version-display').innerHTML = `当前版本：${data.version}`;
                document.getElementById('btn-win').href = linkData.windows_exe || "#";

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
                smartBtn.href = linkData.windows_exe || "#";
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