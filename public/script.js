// API 配置
const API_BASE_URL = window.location.origin;

// GitHub Gist 公告配置
const GIST_CONFIG = {
    username: 'YiQing-House',
    gistId: 'ae97ddcecaaf2f3dea622ef7b2520c67',
    filename: 'gistfile1.txt',
    enabled: true
};

// 全局状态（适配新 HTML）
let appState = {
    format: localStorage.getItem('preset_format') || 'video+audio',
    quality: parseInt(localStorage.getItem('preset_quality') || '80'),
    videoFormat: localStorage.getItem('preset_videoFormat') || 'mp4',
    audioFormat: localStorage.getItem('preset_audioFormat') || 'mp3',
    theme: localStorage.getItem('theme') || 'light',
    filenameFormat: localStorage.getItem('filename_format') || 'title'
};

// 兼容旧代码的全局变量
let currentVideoData = null;
let currentData = null; // 新 HTML 使用这个
let selectedQuality = null;
let selectedFormat = 'video+audio';
let isLoggedIn = false;
let isVip = false;
let userInfo = null;
let qrCheckInterval = null;
let batchResults = []; // 批量解析结果
let gistAnnouncementData = null; // Gist 公告数据

// 预设选项（兼容）
let presetFormat = 'video+audio';
let presetQuality = 80;
let presetOutput = 'mp4'; // mp4, mp3, flac

// 设置
let appSettings = {
    theme: 'auto',
    filenameFormat: 'title',
    autoDownload: false,
    showQualityTip: true,
    rememberQuality: true
};

// DOM 元素
const videoUrlInput = document.getElementById('videoUrl');
const parseBtn = document.getElementById('parseBtn');
const loadingSection = document.getElementById('loadingSection');
const resultSection = document.getElementById('resultSection');
const errorSection = document.getElementById('errorSection');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// 新 HTML 使用的 DOM 元素（可能不存在，需要检查）
let batchSection = null;
let batchList = null;
let batchCount = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化新 HTML 的 DOM 元素
    batchSection = document.getElementById('batchSection');
    batchList = document.getElementById('batchList');
    batchCount = document.getElementById('batchCount');
    
    // 加载设置
    loadSettings();
    
    // 应用主题
    applyTheme();
    
    // 初始化新 HTML 的 UI
    initUI();
    
    // 初始化背景图
    initBackgroundImage();
    
    // 绑定事件
    if (parseBtn) parseBtn.addEventListener('click', handleSmartParse);
    if (videoUrlInput) {
        videoUrlInput.addEventListener('keydown', (e) => {
            // Ctrl+Enter 触发解析
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                handleSmartParse();
            }
        });
    }
    
    // 输入内容变化时更新提示
    if (videoUrlInput) {
        videoUrlInput.addEventListener('input', updateInputHint);
        videoUrlInput.addEventListener('paste', () => {
            setTimeout(updateInputHint, 100);
        });
    }
    
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            if (errorSection) errorSection.classList.add('hidden');
            if (videoUrlInput) videoUrlInput.focus();
        });
    }

    // 加载 Gist 公告
    checkAnnouncement(); // 新 HTML 使用这个函数
    
    // 检查登录状态
    checkLoginStatus();
    checkLogin(); // 新 HTML 使用这个函数
    
    // 恢复上次的解析搜索结果（保持登录/退出后的状态）
    restoreLastParseResult();
    
    // 加载历史记录到下拉菜单
    loadHistoryToDropdown();
    
    // 初始化预设选项
    initPresetOptions();
    updatePresetVipStatus();
    
    // 窗口大小改变时重新计算指示器位置
    window.addEventListener('resize', () => {
        const activeFmt = document.querySelector('#formatSegment .segment-opt.active');
        if(activeFmt) moveGlider(document.getElementById('formatSegment'), activeFmt);
        const activeQ = document.querySelector('#qualitySegment .segment-opt.active');
        if(activeQ) moveGlider(document.getElementById('qualitySegment'), activeQ);
    });
    
    // 点击外部关闭历史记录下拉菜单
    document.addEventListener('click', (e) => {
        const historyDropdown = document.getElementById('historyDropdown');
        const historyTrigger = document.querySelector('.history-trigger');
        if (historyDropdown && historyTrigger) {
            if (!e.target.closest('.history-dropdown') && !e.target.closest('.history-trigger')) {
                historyDropdown.classList.remove('active');
            }
        }
    });
    
    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (appState.theme === 'auto') {
            applyTheme();
        }
    });
});

// ==================== 预设选项功能 ====================

function initPresetOptions() {
    // 恢复保存的预设
    const savedFormat = localStorage.getItem('presetFormat');
    const savedQuality = localStorage.getItem('presetQuality');
    
    if (savedFormat) {
        presetFormat = savedFormat;
        const formatBtn = document.querySelector(`#formatGroup .preset-item[data-format="${savedFormat}"]`);
        if (formatBtn) {
            document.querySelectorAll('#formatGroup .preset-item').forEach(btn => btn.classList.remove('active'));
            formatBtn.classList.add('active');
        }
    }
    
    if (savedQuality) {
        const qn = parseInt(savedQuality);
        const needVip = qn > 80;
        if (!needVip || (isLoggedIn && isVip)) {
            presetQuality = qn;
            const qualityBtn = document.querySelector(`#qualityGroup .preset-item[data-qn="${qn}"]`);
            if (qualityBtn) {
                document.querySelectorAll('#qualityGroup .preset-item').forEach(btn => btn.classList.remove('active'));
                qualityBtn.classList.add('active');
            }
        }
    }
    
    updatePresetVisibility();
    updatePresetInfoDisplay();
}

function selectPresetFormat(format, element) {
    presetFormat = format;
    localStorage.setItem('presetFormat', format);
    
    // 更新按钮状态
    document.querySelectorAll('#formatGroup .preset-item').forEach(btn => {
        btn.classList.remove('active');
    });
    element.classList.add('active');
    
    updatePresetVisibility();
    updatePresetInfoDisplay();
}

function selectPresetQuality(qn, element) {
    // 检查是否需要登录
    const needVip = qn > 80;
    if (needVip && !isLoggedIn) {
        showToast('请先登录B站账号', 'error');
        showLoginModal();
        return;
    }
    if (needVip && !isVip) {
        showToast('此画质需要大会员', 'error');
        return;
    }
    
    presetQuality = qn;
    localStorage.setItem('presetQuality', qn);
    
    // 更新按钮状态
    document.querySelectorAll('#qualityGroup .preset-item').forEach(btn => {
        btn.classList.remove('active');
    });
    element.classList.add('active');
    updatePresetInfoDisplay();
}

// 选择预设输出格式（mp4, mp3, flac）
function selectPresetOutput(output, element) {
    presetOutput = output;
    localStorage.setItem('presetOutput', output);
    
    // 更新按钮状态
    const outputGroup = document.getElementById('outputGroup');
    if (outputGroup) {
        outputGroup.querySelectorAll('.preset-item').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    if (element) {
        element.classList.add('active');
    }
    
    updatePresetInfoDisplay();
}

function updatePresetVisibility() {
    const qualityGroup = document.getElementById('qualityPresetGroup');
    
    if (presetFormat === 'cover' || presetFormat === 'audio') {
        // 封面和音频不需要画质选择
        if (qualityGroup) qualityGroup.style.display = 'none';
    } else {
        if (qualityGroup) qualityGroup.style.display = 'block';
    }
}

function updatePresetVipStatus() {
    const vipBtns = document.querySelectorAll('.preset-item.vip');
    vipBtns.forEach(btn => {
        if (isLoggedIn && isVip) {
            btn.classList.add('unlocked');
        } else {
            btn.classList.remove('unlocked');
        }
    });
}

// 更新预设信息显示
function updatePresetInfoDisplay() {
    const infoEl = document.getElementById('currentPresetInfo');
    if (!infoEl) return;
    
    const formatNames = {
        'video+audio': '完整视频',
        'video+audio-separate': '视频+音频分离',
        'audio': '仅音频',
        'video-only': '仅视频',
        'cover': '封面'
    };
    
    const qualityNames = {
        120: '4K',
        116: '1080P60',
        112: '1080P+',
        80: '1080P',
        64: '720P',
        32: '480P'
    };
    
    const formatName = formatNames[presetFormat] || '完整视频';
    const qualityName = qualityNames[presetQuality] || '1080P';
    
    if (presetFormat === 'cover' || presetFormat === 'audio') {
        infoEl.textContent = formatName;
    } else {
        infoEl.textContent = `${formatName} · ${qualityName}`;
    }
}

// 使用预设下载（单视频）
async function downloadWithPreset() {
    if (!currentVideoData) {
        showToast('请先解析视频', 'error');
        return;
    }

    const downloadBtn = document.getElementById('downloadBtn');
    const originalText = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 准备下载...';

    try {
        const videoUrl = videoUrlInput.value.trim();
        const safeTitle = (currentVideoData.title || 'video').replace(/[<>:"/\\|?*]/g, '_');
        const encodedUrl = encodeURIComponent(videoUrl);
        const qn = presetQuality || 80;
        
        // 根据预设格式执行下载
        if (presetFormat === 'cover') {
            if (!currentVideoData.thumbnail) {
                showToast('该视频没有封面', 'error');
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = originalText;
                return;
            }
            const downloadUrl = `${API_BASE_URL}/api/bilibili/download/cover?url=${encodedUrl}`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}.jpg`);
        } else if (presetFormat === 'video+audio-separate') {
            showToast('开始分离下载，将依次下载视频和音频...', 'success');
            // 下载视频
            const videoDownloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=video`;
            triggerBrowserDownload(videoDownloadUrl, `${safeTitle}_video.m4s`);
            // 延迟下载音频
            setTimeout(() => {
                const audioDownloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=audio`;
                triggerBrowserDownload(audioDownloadUrl, `${safeTitle}_audio.m4a`);
            }, 1000);
        } else if (presetFormat === 'audio') {
            const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=audio`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}.m4a`);
        } else if (presetFormat === 'video-only') {
            const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=video`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}_video.m4s`);
        } else {
            // 完整视频（需要服务器合并）
            const downloadUrl = `${API_BASE_URL}/api/bilibili/download?url=${encodedUrl}&qn=${qn}`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}.mp4`);
        }
        
        showToast('下载已开始...', 'success');
        
    } catch (error) {
        showToast('下载失败: ' + error.message, 'error');
    } finally {
        setTimeout(() => {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
        }, 2000);
    }
}

// 触发浏览器下载
function triggerBrowserDownload(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        }, 100);
}

// ==================== 设置功能 ====================

function toggleSettings() {
    const sidebar = document.getElementById('settingsSidebar');
    const overlay = document.getElementById('settingsOverlay');
    
    if (!sidebar || !overlay) return;
    
    // 新 HTML 使用 .active 类控制显示
    if (sidebar.classList.contains('active')) {
        sidebar.classList.remove('active');
        overlay.classList.add('hidden');
    } else {
        sidebar.classList.add('active');
        overlay.classList.remove('hidden');
    }
}

function loadSettings() {
    try {
        const saved = localStorage.getItem('appSettings');
        if (saved) {
            appSettings = { ...appSettings, ...JSON.parse(saved) };
        }
        
        // 应用到UI
        document.querySelectorAll('.theme-option').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === appSettings.theme) {
                btn.classList.add('active');
            }
        });
        
        const filenameSelect = document.getElementById('filenameFormat');
        if (filenameSelect) filenameSelect.value = appSettings.filenameFormat;
        
        const autoDownload = document.getElementById('autoDownload');
        if (autoDownload) autoDownload.checked = appSettings.autoDownload;
        
        const showQualityTip = document.getElementById('showQualityTip');
        if (showQualityTip) showQualityTip.checked = appSettings.showQualityTip;
        
        const rememberQuality = document.getElementById('rememberQuality');
        if (rememberQuality) rememberQuality.checked = appSettings.rememberQuality;
        
    } catch (error) {
        console.error('加载设置失败:', error);
    }
}

function saveSettings() {
    try {
        const filenameSelect = document.getElementById('filenameFormat');
        const autoDownload = document.getElementById('autoDownload');
        const showQualityTip = document.getElementById('showQualityTip');
        const rememberQuality = document.getElementById('rememberQuality');
        
        if (filenameSelect) appSettings.filenameFormat = filenameSelect.value;
        if (autoDownload) appSettings.autoDownload = autoDownload.checked;
        if (showQualityTip) appSettings.showQualityTip = showQualityTip.checked;
        if (rememberQuality) appSettings.rememberQuality = rememberQuality.checked;
        
        localStorage.setItem('appSettings', JSON.stringify(appSettings));
    } catch (error) {
        console.error('保存设置失败:', error);
    }
}

function setTheme(theme) {
    appSettings.theme = theme;
    
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.theme === theme) {
            btn.classList.add('active');
        }
    });
    
    applyTheme();
    saveSettings();
}

function applyTheme() {
    let isDark = true;
    
    // 优先使用 appState（新 HTML），否则使用 appSettings（旧 HTML）
    const theme = appState ? appState.theme : (appSettings ? appSettings.theme : 'light');
    
    if (theme === 'light') {
        isDark = false;
    } else if (theme === 'auto') {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    if (isDark) {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
    }
}

// ==================== 智能识别输入 ====================

// 更新输入提示
function updateInputHint() {
    const input = videoUrlInput ? videoUrlInput.value.trim() : '';
    const hintEl = document.getElementById('inputHint');
    const linkCountEl = document.getElementById('linkCount');
    const linkNumEl = document.getElementById('linkNum');
    
    // 新HTML可能没有这些元素，静默返回
    if (!hintEl) return;
    
    if (!input) {
        hintEl.innerHTML = '<i class="fas fa-info-circle"></i> <span>粘贴B站链接、收藏夹ID或多个链接自动识别</span>';
        if (linkCountEl) linkCountEl.classList.add('hidden');
        return;
    }
    
    const inputType = detectInputType(input);
    
    switch (inputType.type) {
        case 'favorites':
            hintEl.innerHTML = `<i class="fas fa-star" style="color: #fbbf24;"></i> <span>检测到收藏夹：${inputType.id}</span>`;
            if (linkCountEl) linkCountEl.classList.add('hidden');
            break;
        case 'user':
            hintEl.innerHTML = `<i class="fas fa-user" style="color: #10b981;"></i> <span>检测到UP主主页：UID ${inputType.uid}</span>`;
            if (linkCountEl) linkCountEl.classList.add('hidden');
            break;
        case 'multi':
            hintEl.innerHTML = `<i class="fas fa-list" style="color: var(--primary-color);"></i> <span>检测到多个链接，将批量解析</span>`;
            if (linkCountEl) linkCountEl.classList.remove('hidden');
            if (linkNumEl) linkNumEl.textContent = inputType.urls.length;
            break;
        case 'single':
            hintEl.innerHTML = `<i class="fab fa-bilibili" style="color: var(--bilibili-pink);"></i> <span>检测到B站视频链接</span>`;
            if (linkCountEl) linkCountEl.classList.add('hidden');
            break;
        default:
            hintEl.innerHTML = `<i class="fas fa-question-circle" style="color: var(--warning-color);"></i> <span>请输入B站视频链接、收藏夹或UP主主页</span>`;
            if (linkCountEl) linkCountEl.classList.add('hidden');
    }
}

// 检测输入类型
function detectInputType(input) {
    // 检查收藏夹
    const mlMatch = input.match(/ml(\d+)/i);
    const fidMatch = input.match(/fid=(\d+)/);
    const favlistMatch = input.match(/favlist.*fid=(\d+)/);
    
    if (mlMatch || fidMatch || favlistMatch) {
        const id = mlMatch?.[1] || fidMatch?.[1] || favlistMatch?.[1];
        return { type: 'favorites', id };
    }
    
    // 检查UP主主页
    const spaceMatch = input.match(/space\.bilibili\.com\/(\d+)/);
    if (spaceMatch) {
        return { type: 'user', uid: spaceMatch[1] };
    }
    
    // 检查多链接
    const urls = extractBilibiliUrls(input);
    if (urls.length > 1) {
        return { type: 'multi', urls };
    }
    
    // 检查单链接
    if (urls.length === 1) {
        return { type: 'single', url: urls[0] };
    }
    
    // 检查是否是纯数字（可能是收藏夹ID）
    if (/^\d+$/.test(input) && input.length > 5) {
        return { type: 'favorites', id: input };
    }
    
    return { type: 'unknown' };
}

// 提取B站链接 - 支持换行、空格、逗号等分隔，以及连在一起的多个链接
function extractBilibiliUrls(text) {
    const urls = new Set();
    
    // 🔧 预处理：在每个 https:// 或 http:// 前添加空格，解决链接连在一起的问题
    // 例如: "...clickhttps://..." → "...click https://..."
    let processedText = text.replace(/(https?:\/\/)/gi, ' $1');
    
    // 提取所有 BV 号（BV + 10位字符）⚠️ 保持原始大小写！BV号是大小写敏感的！
    const bvMatches = processedText.matchAll(/BV[a-zA-Z0-9]{10}/g); // 不用 gi，保持大小写
    for (const match of bvMatches) {
        const bv = match[0]; // 保持原始大小写
        urls.add(`https://www.bilibili.com/video/${bv}`);
    }
    
    // 提取 av 号
    const avMatches = processedText.matchAll(/av(\d+)/gi);
    for (const match of avMatches) {
        urls.add(`https://www.bilibili.com/video/av${match[1]}`);
    }
    
    // 提取 b23.tv 短链接的 ID
    const shortUrlMatches = processedText.matchAll(/b23\.tv\/([a-zA-Z0-9]+)/gi);
    for (const match of shortUrlMatches) {
        urls.add(`https://b23.tv/${match[1]}`);
    }
    
    console.log('提取到的链接:', Array.from(urls)); // 调试日志
    
    return Array.from(urls);
}

// 智能解析入口
async function handleSmartParse() {
    const input = videoUrlInput.value.trim();
    
    if (!input) {
        showToast('请输入B站链接或收藏夹ID', 'error');
        videoUrlInput.focus();
        return;
    }
    
    const inputType = detectInputType(input);
    
    switch (inputType.type) {
        case 'favorites':
            await handleFavoritesParse(inputType.id);
            break;
        case 'user':
            await handleUserVideosParse(inputType.uid);
            break;
        case 'multi':
            await handleMultiParse(inputType.urls);
            break;
        case 'single':
            await handleSingleParse(inputType.url);
            break;
        default:
            // 尝试作为单链接解析
            const urls = extractBilibiliUrls(input);
            if (urls.length > 0) {
                if (urls.length === 1) {
                    await handleSingleParse(urls[0]);
                } else {
                    await handleMultiParse(urls);
                }
            } else {
                showToast('无法识别输入内容，请检查是否为B站链接', 'error');
            }
    }
}

// 单链接解析
async function handleSingleParse(url) {
    // 显示加载状态
    loadingSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    document.getElementById('batchResultSection')?.classList.add('hidden');
    errorSection.classList.add('hidden');
    document.getElementById('loadingText').textContent = '正在解析中，请稍候...';
    document.getElementById('loadingProgress')?.classList.add('hidden');
    parseBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (data.success) {
            currentVideoData = data.data;
            displayResult(data.data);
        } else {
            throw new Error(data.error || '解析失败');
        }
    } catch (error) {
        showError(error.message);
    } finally {
        if (loadingSection) loadingSection.classList.add('hidden');
        if (parseBtn) parseBtn.disabled = false;
    }
}

// ==================== 批量解析 ====================

async function handleMultiParse(urls) {
    if (!urls || urls.length === 0) {
        showToast('请输入至少一个有效链接', 'error');
        return;
    }
    
    if (urls.length > 50) {
        showToast('单次最多解析50个链接', 'error');
        return;
    }
    
    // 显示加载状态
    loadingSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    document.getElementById('batchResultSection')?.classList.add('hidden');
    errorSection.classList.add('hidden');
    
    document.getElementById('loadingText').textContent = '正在批量解析中...';
    const progressEl = document.getElementById('loadingProgress');
    if (progressEl) progressEl.classList.remove('hidden');
    
    parseBtn.disabled = true;
    
    batchResults = [];
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < urls.length; i++) {
        // 更新进度
        const progress = ((i + 1) / urls.length) * 100;
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${i + 1}/${urls.length}`;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urls[i] })
            });
            
        const data = await response.json();
            
            if (data.success) {
                batchResults.push({
                    success: true,
                    url: urls[i],
                    data: data.data
                });
                successCount++;
            } else {
                batchResults.push({
                    success: false,
                    url: urls[i],
                    error: data.error || '解析失败'
                });
                failedCount++;
        }
    } catch (error) {
            batchResults.push({
                success: false,
                url: urls[i],
                error: error.message || '网络错误'
            });
            failedCount++;
        }
        
        // 稍微延迟避免请求过快
        if (i < urls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    // 隐藏加载
    loadingSection.classList.add('hidden');
    if (progressEl) progressEl.classList.add('hidden');
    parseBtn.disabled = false;
    
    // 显示批量结果
    displayBatchResults(successCount, failedCount);
}

// 显示批量解析结果（适配新 HTML）
function displayBatchResults(successCount, failedCount) {
    // 尝试新 HTML 的元素 ID，如果不存在则使用旧的
    const batchSectionEl = document.getElementById('batchSection') || document.getElementById('batchResultSection');
    const batchListEl = document.getElementById('batchList') || document.getElementById('batchResultList');
    const batchCountEl = document.getElementById('batchCount');
    
    if (batchCountEl) batchCountEl.textContent = batchResults.length;
    
    // 隐藏单视频结果区域
    if (resultSection) resultSection.classList.add('hidden');
    
    if (!batchListEl) return;
    
    batchListEl.innerHTML = '';
    
    batchResults.forEach((result, index) => {
        const item = document.createElement('div');
        item.className = 'batch-item';
        item.dataset.index = index;
        
        if (result.success) {
            const data = result.data;
            let thumbnailUrl = data.thumbnail || '';
            if (thumbnailUrl.startsWith('//')) {
                thumbnailUrl = 'https:' + thumbnailUrl;
            }
            if (thumbnailUrl && (thumbnailUrl.includes('bilibili.com') || thumbnailUrl.includes('hdslb.com'))) {
                thumbnailUrl = `${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(thumbnailUrl)}`;
            }
            
            item.innerHTML = `
                <img class="batch-thumb" src="${thumbnailUrl || 'data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 9\"><rect fill=\"%23334155\" width=\"16\" height=\"9\"/></svg>'}">
                <div class="batch-info">
                    <div class="batch-title">${escapeHtml(data.title || '未知标题')}</div>
                    <div class="batch-status success"><i class="fas fa-check"></i> 解析成功</div>
                </div>
                <button onclick="downloadBatchItem(${index})" style="background:var(--primary); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                    <i class="fas fa-download"></i>
                </button>
            `;
        } else {
            item.innerHTML = `
                <div class="batch-info">
                    <div class="batch-title">${escapeHtml(result.url)}</div>
                    <div class="batch-status error"><i class="fas fa-times"></i> ${escapeHtml(result.error)}</div>
                </div>
                <button onclick="retryBatchItem(${index})" style="background:var(--blue); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                    <i class="fas fa-redo"></i>
                </button>
            `;
        }
        
        batchListEl.appendChild(item);
    });
    
    if (batchSectionEl) {
        batchSectionEl.classList.remove('hidden');
        batchSectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    // 如果设置了自动下载
    if (appSettings && appSettings.autoDownload && successCount > 0) {
        setTimeout(() => downloadAllBatch(), 500);
    }
}

// 下载批量解析的单个项目
async function downloadBatchItem(index) {
    const result = batchResults[index];
    if (!result || !result.success) return;
    
    const data = result.data;
    const safeTitle = formatFilename ? formatFilename(data, result.url) : (data.title || 'video').replace(/[<>:"/\\|?*]/g, '_');
    const encodedUrl = encodeURIComponent(result.url);
    
    // 使用 appState（新 HTML）或 presetFormat/presetQuality（旧 HTML）
    const format = appState ? appState.format : presetFormat;
    const quality = appState ? appState.quality : presetQuality;
    
    // 更新状态为下载中
    const listItem = document.querySelector(`.batch-item[data-index="${index}"]`) || document.querySelector(`.batch-result-item[data-index="${index}"]`);
    if (listItem) {
        listItem.classList.add('downloading');
    }
    
    try {
        if (format === 'audio') {
            const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${quality}&type=audio`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}.m4a`);
        } else if (format === 'cover') {
            const downloadUrl = `${API_BASE_URL}/api/bilibili/download/cover?url=${encodedUrl}`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}.jpg`);
        } else if (format === 'video-only') {
            const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${quality}&type=video`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}_video.m4s`);
        } else if (format === 'video+audio-separate') {
            // 分离下载：先视频后音频
            const videoUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${quality}&type=video`;
            triggerBrowserDownload(videoUrl, `${safeTitle}_video.m4s`);
            // 延迟下载音频
            await new Promise(resolve => setTimeout(resolve, 800));
            const audioUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${quality}&type=audio`;
            triggerBrowserDownload(audioUrl, `${safeTitle}_audio.m4a`);
        } else {
            // 合并下载
            const downloadUrl = `${API_BASE_URL}/api/bilibili/download?url=${encodedUrl}&qn=${quality}`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}.mp4`);
        }
        
        if (listItem) {
            listItem.classList.remove('downloading');
            listItem.classList.add('downloaded');
        }
        
        showToast('开始下载...', 'success');
    } catch (error) {
        console.error('下载失败:', error);
        if (listItem) {
            listItem.classList.remove('downloading');
            listItem.classList.add('download-failed');
        }
    }
}

// 重试失败的项目
async function retryBatchItem(index) {
    const result = batchResults[index];
    if (!result) return;
    
    showToast('正在重新解析...', 'success');
    
    const batchListEl = document.getElementById('batchList');
    if (batchListEl && batchListEl.children[index]) {
        batchListEl.children[index].innerHTML = `
            <div class="batch-info">
                <div class="batch-title">正在重新解析...</div>
            </div>
        `;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: result.url })
        });
        
        const data = await response.json();
        
        if (data.success) {
            batchResults[index] = {
                success: true,
                url: result.url,
                data: data.data
            };
            showToast('解析成功！', 'success');
            
            // 更新列表项
            if (batchListEl && batchListEl.children[index]) {
                const resultData = data.data;
                let thumbnailUrl = resultData.thumbnail || '';
                if (thumbnailUrl.startsWith('//')) thumbnailUrl = 'https:' + thumbnailUrl;
                if (thumbnailUrl && (thumbnailUrl.includes('bilibili.com') || thumbnailUrl.includes('hdslb.com'))) {
                    thumbnailUrl = `${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(thumbnailUrl)}`;
                }
                
                batchListEl.children[index].innerHTML = `
                    <img class="batch-thumb" src="${thumbnailUrl || 'data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 9\"><rect fill=\"%23334155\" width=\"16\" height=\"9\"/></svg>'}">
                    <div class="batch-info">
                        <div class="batch-title">${escapeHtml(resultData.title || '未知标题')}</div>
                        <div class="batch-status success"><i class="fas fa-check"></i> 解析成功</div>
                    </div>
                    <button onclick="downloadBatchItem(${index})" style="background:var(--primary); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                        <i class="fas fa-download"></i>
                    </button>
                `;
            }
        } else {
            batchResults[index] = {
                success: false,
                url: result.url,
                error: data.error || '解析失败'
            };
            showToast('解析仍然失败', 'error');
            
            // 更新列表项显示错误
            if (batchListEl && batchListEl.children[index]) {
                batchListEl.children[index].innerHTML = `
                    <div class="batch-info">
                        <div class="batch-title">${escapeHtml(result.url)}</div>
                        <div class="batch-status error"><i class="fas fa-times"></i> ${escapeHtml(data.error || '解析失败')}</div>
                    </div>
                    <button onclick="retryBatchItem(${index})" style="background:var(--blue); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                        <i class="fas fa-redo"></i>
                    </button>
                `;
            }
        }
        
        // 更新计数
        const batchCountEl = document.getElementById('batchCount');
        if (batchCountEl) {
            const successCount = batchResults.filter(r => r.success).length;
            batchCountEl.textContent = batchResults.length;
        }
        
    } catch (error) {
        showToast('重试失败: ' + error.message, 'error');
        
        // 更新列表项显示错误
        const batchListEl = document.getElementById('batchList');
        if (batchListEl && batchListEl.children[index]) {
            batchListEl.children[index].innerHTML = `
                <div class="batch-info">
                    <div class="batch-title">${escapeHtml(result.url)}</div>
                    <div class="batch-status error"><i class="fas fa-times"></i> ${escapeHtml(error.message || '网络错误')}</div>
                </div>
                <button onclick="retryBatchItem(${index})" style="background:var(--blue); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                    <i class="fas fa-redo"></i>
                </button>
            `;
        }
    }
}

// 全部下载
async function downloadAllBatch() {
    // 获取成功项及其原始索引
    const successItems = [];
    batchResults.forEach((r, idx) => {
        if (r.success) {
            successItems.push({ ...r, originalIndex: idx });
        }
    });
    
    if (successItems.length === 0) {
        showToast('没有可下载的项目', 'error');
        return;
    }
    
    // 显示下载进度
    const progressSection = document.getElementById('downloadProgressSection');
    const progressFill = document.getElementById('downloadProgressFill');
    const progressText = document.getElementById('downloadProgressText');
    const currentInfo = document.getElementById('currentDownloadInfo');
    const downloadBtn = document.getElementById('downloadAllBtn');
    
    progressSection.classList.remove('hidden');
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 下载中...';
    
    // 获取当前预设（统一使用 appState）
    const format = appState ? appState.format : presetFormat;
    const quality = appState ? appState.quality : presetQuality;
    
    // 逐个下载
    for (let i = 0; i < successItems.length; i++) {
        const item = successItems[i];
        const data = item.data;
        const encodedUrl = encodeURIComponent(item.url);
        
        // 更新进度
        const progress = ((i + 1) / successItems.length) * 100;
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${i + 1}/${successItems.length}`;
        if (currentInfo) currentInfo.textContent = `正在下载: ${data.title || '未知视频'}`;
        
        // 更新列表项状态（使用原始索引）
        const listItem = document.querySelector(`.batch-result-item[data-index="${item.originalIndex}"]`) || 
                         document.querySelector(`.batch-item[data-index="${item.originalIndex}"]`);
        if (listItem) {
            listItem.classList.remove('downloaded', 'download-failed');
            listItem.classList.add('downloading');
        }
        
        try {
            const safeTitle = formatFilename ? formatFilename(data, item.url) : (data.title || 'video').replace(/[<>:"/\\|?*]/g, '_');
            
            // 根据预设格式下载（使用统一的 format 和 quality）
            if (format === 'audio') {
                const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${quality}&type=audio`;
                triggerBrowserDownload(downloadUrl, `${safeTitle}.m4a`);
            } else if (format === 'cover') {
                const downloadUrl = `${API_BASE_URL}/api/bilibili/download/cover?url=${encodedUrl}`;
                triggerBrowserDownload(downloadUrl, `${safeTitle}.jpg`);
            } else if (format === 'video-only') {
                const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${quality}&type=video`;
                triggerBrowserDownload(downloadUrl, `${safeTitle}_video.m4s`);
            } else if (format === 'video+audio-separate') {
                // 分离下载
                const videoUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${quality}&type=video`;
                triggerBrowserDownload(videoUrl, `${safeTitle}_video.m4s`);
                await new Promise(resolve => setTimeout(resolve, 800));
                const audioUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${quality}&type=audio`;
                triggerBrowserDownload(audioUrl, `${safeTitle}_audio.m4a`);
            } else {
                // 合并下载
                const downloadUrl = `${API_BASE_URL}/api/bilibili/download?url=${encodedUrl}&qn=${quality}`;
                triggerBrowserDownload(downloadUrl, `${safeTitle}.mp4`);
            }
            
            // 等待一小段时间确保下载开始
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (listItem) {
                listItem.classList.remove('downloading');
                listItem.classList.add('downloaded');
            }
            
        } catch (error) {
            console.error('下载失败:', error);
            if (listItem) {
                listItem.classList.remove('downloading');
                listItem.classList.add('download-failed');
            }
        }
        
        // 间隔下载（给浏览器和服务器时间处理）
        if (i < successItems.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    // 完成
    currentInfo.textContent = '下载任务已全部发起！';
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = '<i class="fas fa-download"></i> 全部下载';
    
    setTimeout(() => {
        progressSection.classList.add('hidden');
    }, 3000);
    
    showToast(`已发起 ${successItems.length} 个视频的下载`, 'success');
}

// 获取下载类型和扩展名
function getDownloadTypeAndExt() {
    let downloadType = 'video';
    let fileExt = 'mp4';
    
    if (presetFormat === 'audio') {
        downloadType = 'audio';
        fileExt = 'm4a';
    } else if (presetFormat === 'cover') {
        downloadType = 'cover';
        fileExt = 'jpg';
    } else if (presetFormat === 'video-only') {
        downloadType = 'video-only';
        fileExt = 'm4s';
    } else if (presetFormat === 'video+audio-separate') {
        downloadType = 'separate';
        fileExt = 'm4s'; // 视频部分
    } else {
        // video+audio 合并，需要 ffmpeg
        downloadType = 'merged';
        fileExt = 'mp4';
    }
    
    return { downloadType, fileExt };
}

// 构建下载URL - 使用流式代理
function buildDownloadUrl(videoUrl, downloadType) {
    const encodedUrl = encodeURIComponent(videoUrl);
    
    switch (downloadType) {
        case 'audio':
            return `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${presetQuality}&type=audio`;
        case 'cover':
            return `${API_BASE_URL}/api/bilibili/download/cover?url=${encodedUrl}`;
        case 'video-only':
            return `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${presetQuality}&type=video`;
        case 'merged':
            // 需要服务器合并
            return `${API_BASE_URL}/api/bilibili/download?url=${encodedUrl}&qn=${presetQuality}`;
        default:
            return `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${presetQuality}&type=video`;
    }
}

// 格式化文件名
function formatFilename(data, url) {
    let filename = (data.title || 'video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 80);
    
    switch (appSettings.filenameFormat) {
        case 'bvid-title':
            const bvMatch = url.match(/BV[a-zA-Z0-9]+/i);
            if (bvMatch) {
                filename = `${bvMatch[0]}-${filename}`;
            }
            break;
        case 'author-title':
            if (data.author) {
                filename = `${data.author.replace(/[<>:"/\\|?*]/g, '_')}-${filename}`;
            }
            break;
        case 'title-date':
            const date = new Date().toISOString().split('T')[0];
            filename = `${filename}-${date}`;
            break;
    }
    
    return filename;
}

// 清空批量结果
function clearBatchResults() {
    batchResults = [];
    document.getElementById('batchResultSection')?.classList.add('hidden');
    document.getElementById('multiVideoUrls').value = '';
    updateLinkCount();
    showToast('已清空', 'success');
}

// ==================== 收藏夹解析 ====================

async function handleFavoritesParse(favId) {
    if (!favId) {
        showToast('无法识别收藏夹ID', 'error');
        return;
    }
    
    // 显示加载状态（添加 null 检查）
    if (loadingSection) loadingSection.classList.remove('hidden');
    if (resultSection) resultSection.classList.add('hidden');
    document.getElementById('batchResultSection')?.classList.add('hidden');
    document.getElementById('batchSection')?.classList.add('hidden');
    if (errorSection) errorSection.classList.add('hidden');
    
    const loadingTextEl = document.getElementById('loadingText');
    if (loadingTextEl) loadingTextEl.textContent = '正在解析收藏夹...';
    const progressEl = document.getElementById('loadingProgress');
    if (progressEl) progressEl.classList.add('hidden');
    
    if (parseBtn) parseBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/bilibili/favorites?id=${favId}`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.videos) {
            // 转换为批量结果格式
            batchResults = data.videos.map(video => ({
                success: true,
                url: video.url,
                data: {
                    title: video.title,
                    author: video.author,
                    thumbnail: video.thumbnail,
                    duration: video.duration,
                    platform: 'B站',
                    bvid: video.bvid
                }
            }));
            
            // 显示批量结果（适配新 HTML）
            const batchSectionEl = document.getElementById('batchSection');
            const batchListEl = document.getElementById('batchList');
            const batchCountEl = document.getElementById('batchCount');
            
            if (batchSectionEl) batchSectionEl.classList.remove('hidden');
            if (resultSection) resultSection.classList.add('hidden');
            if (batchListEl) {
                batchListEl.innerHTML = '';
                batchResults.forEach((result, index) => {
                    const item = document.createElement('div');
                    item.className = 'batch-item';
                    item.dataset.index = index;
                    const data = result.data;
                    let thumbnailUrl = data.thumbnail || '';
                    if (thumbnailUrl.startsWith('//')) thumbnailUrl = 'https:' + thumbnailUrl;
                    if (thumbnailUrl && (thumbnailUrl.includes('bilibili.com') || thumbnailUrl.includes('hdslb.com'))) {
                        thumbnailUrl = `${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(thumbnailUrl)}`;
                    }
                    item.innerHTML = `
                        <img class="batch-thumb" src="${thumbnailUrl || 'data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 9\"><rect fill=\"%23334155\" width=\"16\" height=\"9\"/></svg>'}">
                        <div class="batch-info">
                            <div class="batch-title">${escapeHtml(data.title || '未知标题')}</div>
                            <div class="batch-status success"><i class="fas fa-check"></i> 解析成功</div>
                        </div>
                        <button onclick="downloadBatchItem(${index})" style="background:var(--primary); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                            <i class="fas fa-download"></i>
                        </button>
                    `;
                    batchListEl.appendChild(item);
                });
            }
            if (batchCountEl) batchCountEl.textContent = batchResults.length;
            
            showToast(`成功解析 ${data.videos.length} 个视频`, 'success');
        } else {
            throw new Error(data.error || '解析收藏夹失败');
        }
        
    } catch (error) {
        showError(error.message);
    } finally {
        if (loadingSection) loadingSection.classList.add('hidden');
        if (parseBtn) parseBtn.disabled = false;
    }
}

// ==================== UP主投稿解析 ====================

async function handleUserVideosParse(uid) {
    if (!uid) {
        showToast('无法识别用户ID', 'error');
        return;
    }
    
    // 显示加载状态（添加 null 检查）
    if (loadingSection) loadingSection.classList.remove('hidden');
    if (resultSection) resultSection.classList.add('hidden');
    document.getElementById('batchResultSection')?.classList.add('hidden');
    document.getElementById('batchSection')?.classList.add('hidden');
    if (errorSection) errorSection.classList.add('hidden');
    
    const loadingTextEl = document.getElementById('loadingText');
    if (loadingTextEl) loadingTextEl.textContent = '正在获取UP主投稿...';
    const progressEl = document.getElementById('loadingProgress');
    if (progressEl) progressEl.classList.add('hidden');
    
    if (parseBtn) parseBtn.disabled = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/bilibili/user-videos?uid=${uid}`, {
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.success && data.videos) {
            // 转换为批量结果格式
            batchResults = data.videos.map(video => ({
                success: true,
                url: video.url,
                data: {
                    title: video.title,
                    author: video.author,
                    thumbnail: video.thumbnail,
                    duration: video.duration,
                    platform: 'B站',
                    bvid: video.bvid
                }
            }));
            
            // 显示批量结果（适配新 HTML）
            const batchSectionEl = document.getElementById('batchSection');
            const batchListEl = document.getElementById('batchList');
            const batchCountEl = document.getElementById('batchCount');
            
            if (batchSectionEl) batchSectionEl.classList.remove('hidden');
            if (resultSection) resultSection.classList.add('hidden');
            if (batchListEl) {
                batchListEl.innerHTML = '';
                batchResults.forEach((result, index) => {
                    const item = document.createElement('div');
                    item.className = 'batch-item';
                    item.dataset.index = index;
                    const data = result.data;
                    let thumbnailUrl = data.thumbnail || '';
                    if (thumbnailUrl.startsWith('//')) thumbnailUrl = 'https:' + thumbnailUrl;
                    if (thumbnailUrl && (thumbnailUrl.includes('bilibili.com') || thumbnailUrl.includes('hdslb.com'))) {
                        thumbnailUrl = `${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(thumbnailUrl)}`;
                    }
                    item.innerHTML = `
                        <img class="batch-thumb" src="${thumbnailUrl || 'data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 9\"><rect fill=\"%23334155\" width=\"16\" height=\"9\"/></svg>'}">
                        <div class="batch-info">
                            <div class="batch-title">${escapeHtml(data.title || '未知标题')}</div>
                            <div class="batch-status success"><i class="fas fa-check"></i> 解析成功</div>
                        </div>
                        <button onclick="downloadBatchItem(${index})" style="background:var(--primary); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                            <i class="fas fa-download"></i>
                        </button>
                    `;
                    batchListEl.appendChild(item);
                });
            }
            if (batchCountEl) batchCountEl.textContent = batchResults.length;
            
            showToast(`成功获取 ${data.videos.length} 个视频`, 'success');
        } else {
            throw new Error(data.error || '获取UP主投稿失败');
        }
        
    } catch (error) {
        showError(error.message);
    } finally {
        if (loadingSection) loadingSection.classList.add('hidden');
        if (parseBtn) parseBtn.disabled = false;
    }
}

// ==================== GitHub Gist 云公告 ====================

async function loadGistAnnouncement() {
    try {
        if (!GIST_CONFIG.enabled) return;
        
        const response = await fetch(`https://api.github.com/gists/${GIST_CONFIG.gistId}`, {
            headers: { 'Accept': 'application/vnd.github.v3+json' },
            cache: 'no-cache'
        });
        
        if (!response.ok) {
            console.log('Gist 加载失败');
            return;
        }
        
        const gistData = await response.json();
        const file = gistData.files[GIST_CONFIG.filename];
        
        if (!file || !file.content) return;
        
        // 解析 JSON 格式的公告
        let announcementInfo;
        try {
            announcementInfo = JSON.parse(file.content);
        } catch (e) {
            // 如果不是 JSON，当作纯文本处理
            announcementInfo = {
                id: gistData.updated_at,
                title: '公告通知',
                message: file.content,
                isActive: true
            };
        }
        
        // 检查公告是否激活
        if (!announcementInfo.isActive) return;
        
        // 检查是否是新公告（通过版本ID比较）
        const cachedVersion = localStorage.getItem(GIST_CONFIG.cacheKey);
        const currentVersion = announcementInfo.id || gistData.updated_at;
        const isNewAnnouncement = cachedVersion !== currentVersion;
        
        // 检查今日是否不再显示（仅对同一版本公告有效）
        const dontShowToday = localStorage.getItem('gistDontShowDate');
        const dontShowVersion = localStorage.getItem('gistDontShowVersion');
        const today = new Date().toDateString();
        
        const shouldShow = isNewAnnouncement || !(dontShowToday === today && dontShowVersion === currentVersion);
        
        gistAnnouncementData = {
            id: currentVersion,
            title: announcementInfo.title || '公告通知',
            message: announcementInfo.message || '',
            date: announcementInfo.date || '',
            updatedAt: gistData.updated_at,
            source: 'gist'
        };
        
        // 显示徽章
        const badge = document.getElementById('announcementBadge');
        if (badge && isNewAnnouncement) {
            badge.classList.remove('hidden');
        }
        
        // 自动弹出公告
        if (shouldShow) {
            setTimeout(() => showGistAnnouncement(), 500);
        }
        
    } catch (error) {
        console.log('公告加载失败:', error);
    }
}

function showGistAnnouncement() {
    const modal = document.getElementById('gistAnnouncementModal');
    const loading = document.getElementById('gistLoading');
    const content = document.getElementById('gistContent');
    const error = document.getElementById('gistError');
    
    modal.classList.remove('hidden');
    
    if (gistAnnouncementData && gistAnnouncementData.message) {
        loading.classList.add('hidden');
        error.classList.add('hidden');
        content.classList.remove('hidden');
        
        // 渲染公告内容
        let html = '';
        if (gistAnnouncementData.title) {
            html += `<h2>${escapeHtml(gistAnnouncementData.title)}</h2>`;
        }
        if (gistAnnouncementData.date) {
            html += `<p class="announcement-date"><i class="fas fa-calendar"></i> ${escapeHtml(gistAnnouncementData.date)}</p>`;
        }
        html += `<div class="announcement-message">${renderMarkdown(gistAnnouncementData.message)}</div>`;
        
        content.innerHTML = html;
        
        // 隐藏徽章
        const badge = document.getElementById('announcementBadge');
        if (badge) badge.classList.add('hidden');
        
        // 标记已读（保存版本）
        if (gistAnnouncementData.id) {
            localStorage.setItem(GIST_CONFIG.cacheKey, gistAnnouncementData.id);
        }
    } else {
        loading.classList.add('hidden');
        content.classList.add('hidden');
        error.classList.remove('hidden');
    }
}

function closeGistAnnouncement() {
    document.getElementById('gistAnnouncementModal').classList.add('hidden');
}

function toggleDontShowAgain() {
    const checkbox = document.getElementById('dontShowAgain');
    if (checkbox.checked) {
        localStorage.setItem('gistDontShowDate', new Date().toDateString());
        if (gistAnnouncementData && gistAnnouncementData.id) {
            localStorage.setItem('gistDontShowVersion', gistAnnouncementData.id);
        }
    } else {
        localStorage.removeItem('gistDontShowDate');
        localStorage.removeItem('gistDontShowVersion');
    }
}

// 简单的 Markdown 渲染
function renderMarkdown(text) {
    return text
        // 标题
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        // 粗体和斜体
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // 链接
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        // 图片
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
        // 代码块
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        // 行内代码
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // 引用
        .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
        // 无序列表
        .replace(/^\- (.*$)/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        // 分隔线
        .replace(/^---$/gm, '<hr>')
        // 换行
        .replace(/\n/g, '<br>');
}

// 检查登录状态
async function checkLoginStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/bilibili/status`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.success && data.isLoggedIn) {
            isLoggedIn = true;
            isVip = data.isVip || false;
            userInfo = data.userInfo;
            updateLoginUI();
        }
    } catch (error) {
        console.log('登录状态检查失败');
    }
}

function updateLoginUI() {
    const loginStatus = document.getElementById('loginStatus');
    const userInfoEl = document.getElementById('userInfo');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const userVip = document.getElementById('userVip');
    
    if (isLoggedIn && userInfo) {
        loginStatus.classList.add('hidden');
        userInfoEl.classList.remove('hidden');
        
        // 处理头像URL
        let avatarUrl = userInfo.avatar || '';
        if (avatarUrl) {
            // 如果是相对路径，添加https协议
            if (avatarUrl.startsWith('//')) {
                avatarUrl = 'https:' + avatarUrl;
            }
            // 如果包含bilibili.com，使用代理加载（解决防盗链）
            if (avatarUrl.includes('bilibili.com') || avatarUrl.includes('hdslb.com')) {
                avatarUrl = `${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(avatarUrl)}`;
            }
        }
        
        userAvatar.src = avatarUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23ccc"/><text x="12" y="16" text-anchor="middle" fill="%23999" font-size="12">头像</text></svg>';
        userAvatar.onerror = function() {
            // 头像加载失败时使用默认头像
            this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%23ccc"/><text x="12" y="16" text-anchor="middle" fill="%23999" font-size="12">头像</text></svg>';
        };
        
        userName.textContent = userInfo.name || '用户';
        
        if (isVip) {
            userVip.classList.remove('hidden');
        } else {
            userVip.classList.add('hidden');
        }
    } else {
        loginStatus.classList.remove('hidden');
        userInfoEl.classList.add('hidden');
    }
    
    // 更新预设选项中的VIP状态
    updatePresetVipStatus();
}

// 显示登录弹窗
function showLoginModal() {
    document.getElementById('loginModal').classList.remove('hidden');
    getQRCode();
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.add('hidden');
    if (qrCheckInterval) {
        clearInterval(qrCheckInterval);
        qrCheckInterval = null;
    }
}

// 获取登录二维码（适配新 HTML）
async function getQRCode() {
    // 新 HTML 使用的元素 ID
    const qrImg = document.getElementById('qrImg');
    const qrText = document.getElementById('qrText');
    // 旧 HTML 使用的元素 ID（兼容）
    const qrcodeLoading = document.getElementById('qrcodeLoading');
    const qrcodeImg = document.getElementById('qrcodeImg');
    const qrcodeExpired = document.getElementById('qrcodeExpired');
    const loginStatusText = document.getElementById('loginStatusText');
    
    if (qrText) {
        qrText.style.display = 'block';
        qrText.textContent = '二维码加载中...';
    }
    if (qrImg) qrImg.style.display = 'none';
    
    if (qrcodeLoading) qrcodeLoading.classList.remove('hidden');
    if (qrcodeImg) qrcodeImg.classList.add('hidden');
    if (qrcodeExpired) qrcodeExpired.classList.add('hidden');
    if (loginStatusText) loginStatusText.textContent = '正在获取二维码...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/bilibili/qrcode`);
        const data = await response.json();
        
        if (data.success && data.qrcodeUrl) {
            if (qrText) qrText.style.display = 'none';
            if (qrImg) {
                qrImg.src = data.qrcodeUrl;
                qrImg.style.display = 'block';
            }
            
            if (qrcodeLoading) qrcodeLoading.classList.add('hidden');
            if (qrcodeImg) {
            qrcodeImg.src = data.qrcodeUrl;
            qrcodeImg.classList.remove('hidden');
            }
            if (loginStatusText) loginStatusText.textContent = '请使用哔哩哔哩APP扫码';
            
            // 开始轮询检查登录状态
            startQRCodeCheck(data.qrcodeKey);
        } else {
            throw new Error(data.error || '获取二维码失败');
        }
    } catch (error) {
        if (qrText) {
            qrText.style.display = 'block';
            qrText.textContent = '获取二维码失败，请重试';
        }
        if (qrcodeLoading) qrcodeLoading.classList.add('hidden');
        if (loginStatusText) loginStatusText.textContent = '获取二维码失败，请重试';
        showToast(error.message, 'error');
    }
}

function refreshQRCode() {
    getQRCode();
}

// 轮询检查二维码状态（适配新 HTML）
function startQRCodeCheck(qrcodeKey) {
    if (qrCheckInterval) clearInterval(qrCheckInterval);
    
    let checkCount = 0;
    const maxChecks = 180; // 3分钟超时
    
    // 更新二维码状态显示
    const updateQrStatus = (status, message) => {
        const qrImg = document.getElementById('qrImg');
        const qrText = document.getElementById('qrText');
        const qrcodeImg = document.getElementById('qrcodeImg');
        const qrcodeExpired = document.getElementById('qrcodeExpired');
        const loginStatusText = document.getElementById('loginStatusText');
        
        if (status === 'expired' || status === 'error') {
            if (qrImg) qrImg.style.display = 'none';
            if (qrText) {
                qrText.style.display = 'block';
                qrText.textContent = message || '二维码已过期，请刷新';
                qrText.style.color = '#ff6b6b';
            }
            if (qrcodeImg) qrcodeImg.classList.add('hidden');
            if (qrcodeExpired) qrcodeExpired.classList.remove('hidden');
        } else if (status === 'scanned') {
            if (qrText) {
                qrText.style.display = 'block';
                qrText.textContent = '✓ 已扫码，请在手机上确认';
                qrText.style.color = '#52c41a';
            }
        } else if (status === 'success') {
            if (qrText) {
                qrText.style.display = 'block';
                qrText.textContent = '✓ 登录成功！';
                qrText.style.color = '#52c41a';
            }
        }
        if (loginStatusText) loginStatusText.textContent = message || '';
    };
    
    qrCheckInterval = setInterval(async () => {
        checkCount++;
        
        if (checkCount > maxChecks) {
            clearInterval(qrCheckInterval);
            updateQrStatus('expired', '二维码已过期，请点击刷新');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/bilibili/qrcode/check?key=${qrcodeKey}`);
            const data = await response.json();
            
            console.log('二维码状态检查:', data); // 调试日志
            
            // 处理成功响应
            if (data.success) {
                switch (data.status) {
                    case 'waiting':
                        // 等待扫码，无需更新UI
                        break;
                    case 'scanned':
                        updateQrStatus('scanned', '已扫码，请在手机上确认');
                        break;
                    case 'confirmed':
                        clearInterval(qrCheckInterval);
                        updateQrStatus('success', '登录成功！');
                        isLoggedIn = true;
                        isVip = data.isVip || false;
                        userInfo = data.userInfo;
                        
                        // 更新UI但不刷新页面（保持搜索结果）
                        updateLoginUI();
                        closeLoginModal();
                        
                        showToast('登录成功！', 'success');
                        
                        // 不再刷新页面，保持解析搜索结果
                        break;
                    case 'expired':
                        clearInterval(qrCheckInterval);
                        updateQrStatus('expired', '二维码已过期，请点击刷新');
                        break;
                }
            } else {
                // 处理错误响应
                console.error('二维码检查失败:', data.error);
                if (data.error && data.error.includes('过期')) {
                    clearInterval(qrCheckInterval);
                    updateQrStatus('expired', '二维码已过期，请点击刷新');
                }
            }
        } catch (error) {
            console.error('检查登录状态失败:', error);
            // 网络错误不立即停止轮询，可能是临时问题
        }
    }, 2000); // 改为2秒轮询一次，减少请求频率
}

// 退出登录
async function logout() {
    try {
        await fetch(`${API_BASE_URL}/api/bilibili/logout`, { method: 'POST', credentials: 'include' });
    } catch (error) {
        console.error('退出登录失败:', error);
    }
    
    isLoggedIn = false;
    isVip = false;
    userInfo = null;
    
    // 更新UI但不刷新页面（保持搜索结果）
    updateLoginUI();
    
    showToast('已退出登录', 'success');
    
    // 不再刷新页面，保持解析搜索结果
}

// 解析视频 (保留为兼容方法，实际使用 handleSmartParse)
async function handleParse() {
    return handleSmartParse();
}

// 显示解析结果
async function displayResult(result) {
    // 重新检查登录状态（确保状态是最新的）
    await checkLoginStatus();
    
    // 保存当前视频数据，供下载使用
    currentVideoData = result;
    
    // 更新视频信息
    document.getElementById('videoPlatform').textContent = result.platform || '-';
    document.getElementById('videoTitle').textContent = result.title || '-';
    document.getElementById('videoAuthor').textContent = result.author || '-';
    document.getElementById('videoDuration').textContent = result.duration || '-';

    // 显示封面
    const coverImg = document.getElementById('coverImg');
    const coverPlayBtn = document.getElementById('coverPlayBtn');
    
    if (result.thumbnail) {
        // 处理 B站封面的协议问题
        let thumbnailUrl = result.thumbnail;
        if (thumbnailUrl.startsWith('//')) {
            thumbnailUrl = 'https:' + thumbnailUrl;
        }
        
        // 使用代理加载B站封面（解决防盗链问题）
        if (thumbnailUrl.includes('bilibili.com') || thumbnailUrl.includes('hdslb.com')) {
            thumbnailUrl = `${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(thumbnailUrl)}`;
        }
        
        coverImg.src = thumbnailUrl;
        coverImg.onerror = () => {
            coverImg.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect fill="%23334155" width="16" height="9"/><text x="8" y="5" text-anchor="middle" fill="%23666" font-size="2">无封面</text></svg>';
        };
    }
    
    // 设置播放链接
    if (coverPlayBtn && result.videoUrl) {
        coverPlayBtn.href = result.videoUrl;
    }

    // 更新下载按钮文本
    const downloadBtnText = document.getElementById('downloadBtnText');
    downloadBtnText.textContent = '下载视频';
    
    // 更新预设信息显示
    updatePresetInfoDisplay();

    // 隐藏错误区域和批量结果区域
    errorSection.classList.add('hidden');
    document.getElementById('batchResultSection')?.classList.add('hidden');
    
    // 显示结果区域
    resultSection.classList.remove('hidden');
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // 保存解析记录
    saveParseHistory(videoUrlInput.value.trim(), result);
    
    // 更新历史记录显示
    loadParseHistory();
}

// 生成画质列表（显示所有画质，与B站播放器一致）
function generateQualityList(result) {
    const qualityList = document.getElementById('qualityList');
    qualityList.innerHTML = '';
    
    // 从后端获取所有画质选项（后端已返回完整列表）
    const availableQualities = result.downloadLinks || [];
    
    if (availableQualities.length === 0) {
        qualityList.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">暂无可用画质</div>';
        return;
    }
    
    // 按画质从高到低排序
    const sortedQualities = [...availableQualities].sort((a, b) => (b.qn || 0) - (a.qn || 0));
    
    // 找到默认选中的画质（优先选择1080P，如果不可用则选择最高可用画质）
    let defaultQn = null;
    const preferredQn = sortedQualities.find(q => q.qn === 80);
    if (preferredQn) {
        const needVip = preferredQn.needVip !== undefined ? preferredQn.needVip : (preferredQn.qn > 80);
        const exists = preferredQn.exists !== undefined ? preferredQn.exists : true;
        if (exists && (!needVip || (isLoggedIn && isVip))) {
            defaultQn = 80;
        }
    }
    
    // 如果没有找到可用的1080P，选择最高可用画质
    if (!defaultQn) {
        const firstAvailable = sortedQualities.find(q => {
            const needVip = q.needVip !== undefined ? q.needVip : (q.qn > 80);
            const exists = q.exists !== undefined ? q.exists : true;
            return exists && (!needVip || (isLoggedIn && isVip));
        });
        if (firstAvailable) {
            defaultQn = firstAvailable.qn;
        } else if (sortedQualities.length > 0) {
            // 如果没有可用画质，至少选中第一个存在的（虽然可能会被禁用）
            const firstExists = sortedQualities.find(q => q.exists !== false);
            if (firstExists) {
                defaultQn = firstExists.qn;
            } else {
                defaultQn = sortedQualities[0].qn;
            }
        }
    }
    
    sortedQualities.forEach((quality) => {
        const qn = quality.qn || 80;
        const needVip = quality.needVip !== undefined ? quality.needVip : (qn > 80);
        const exists = quality.exists !== undefined ? quality.exists : true; // 默认认为存在
        const qualityName = quality.quality || getQualityName(qn);
        
        // 判断是否可以下载：
        // 1. 画质必须存在（exists为true）
        // 2. 不需要VIP，或者需要VIP但用户已登录且是VIP
        const canDownload = exists && (!needVip || (isLoggedIn && isVip));
        const isSelected = qn === defaultQn && canDownload;
        
        if (isSelected) {
            selectedQuality = qn;
        }
        
        const item = document.createElement('div');
        item.className = `quality-item ${isSelected ? 'selected' : ''} ${!canDownload ? 'disabled' : ''}`;
        item.dataset.qn = qn;
        item.dataset.needVip = needVip;
        item.dataset.exists = exists;
        
        // 显示状态文本（不显示"不可用"）
        let statusText = '';
        if (!exists) {
            // 不显示"不可用"，只通过禁用状态表示
            statusText = '';
        } else if (!canDownload) {
            if (needVip && !isLoggedIn) {
                statusText = '需要登录';
            } else if (needVip && !isVip) {
                statusText = '需要大会员';
            } else {
                statusText = '需要登录';
            }
        }
        
        // 滑动条布局
        item.innerHTML = `
            <span class="quality-name">${qualityName}</span>
            ${needVip ? '<span class="quality-tag vip">大会员</span>' : '<span class="quality-tag free">免费</span>'}
            ${statusText ? `<span class="quality-status">${statusText}</span>` : ''}
        `;
        
        // 所有画质都可以点击，但禁用画质会显示提示
        item.addEventListener('click', () => {
            if (canDownload) {
                selectQuality(item, qn);
            } else {
                if (!exists) {
                    showToast('此视频不支持该画质', 'error');
                } else if (needVip && !isLoggedIn) {
                    showToast('请先登录B站账号', 'error');
                    showLoginModal();
                } else if (needVip && !isVip) {
                    showToast('此画质需要大会员，请登录大会员账号', 'error');
                } else {
                    showToast('请先登录', 'error');
                }
            }
        });
        
        qualityList.appendChild(item);
    });
}

// 获取画质名称（辅助函数）
function getQualityName(qn) {
    const qualityMap = {
        127: '8K 超高清',
        126: '杜比视界',
        125: 'HDR 真彩',
        120: '4K 超清',
        116: '1080P 60帧',
        112: '1080P 高码率',
        80: '1080P',
        74: '720P60',
        64: '720P',
        32: '480P',
        16: '360P'
    };
    return qualityMap[qn] || `清晰度 ${qn}`;
}

// 选择格式
function selectFormat(format, element) {
    selectedFormat = format;
    
    // 更新按钮状态
    document.querySelectorAll('.format-slider-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    element.classList.add('active');
    
    // 更新滑动指示器位置
    updateSliderIndicator(element);
    
    // 更新画质选择器显示
    const qualitySelector = document.getElementById('qualitySelector');
    const downloadBtnText = document.getElementById('downloadBtnText');
    
    // 判断是否需要显示画质选择（有视频选项时显示）
    const hasVideo = format === 'video+audio' || format === 'video+audio-separate' || format === 'video-only';
    
    if (hasVideo) {
        qualitySelector.style.display = 'block';
    } else {
        qualitySelector.style.display = 'none';
    }
    
    // 更新下载按钮文字
    const formatTexts = {
        'video+audio': '下载视频+音频合体',
        'video+audio-separate': '下载视频+音频分离',
        'audio': '下载音频',
        'video-only': '下载视频（无音频）',
        'cover': '下载封面'
    };
    downloadBtnText.textContent = formatTexts[format] || '下载';
}

// 更新滑动指示器位置
function updateSliderIndicator(activeButton) {
    const indicator = document.querySelector('.format-slider-indicator');
    const track = document.querySelector('.format-slider-track');
    
    if (!indicator || !track || !activeButton) return;
    
    // 计算按钮在track中的位置
    const trackRect = track.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    
    // 计算相对于track的偏移量
    const left = buttonRect.left - trackRect.left;
    const width = buttonRect.width;
    
    // 设置指示器的位置和宽度
    indicator.style.transform = `translateX(${left}px)`;
    indicator.style.width = `${width}px`;
}

// 更新画质滑动指示器位置（已改用背景色选中，此函数保留为空以保持兼容）
function updateQualitySliderIndicator(activeItem) {
    // 不再需要滑动指示器，改用背景色选中效果
}

// 选择画质
function selectQuality(element, qn) {
    document.querySelectorAll('.quality-item').forEach(item => {
        item.classList.remove('selected');
    });
    element.classList.add('selected');
    selectedQuality = qn;
    
    // 自动滚动到选中项（如果不在可视区域内）
    const track = document.querySelector('.quality-slider-track');
    if (track && element) {
        const itemLeft = element.offsetLeft;
        const itemRight = itemLeft + element.offsetWidth;
        const trackWidth = track.clientWidth;
        const currentScroll = track.scrollLeft;
        
        // 如果选中项在左侧不可见，滚动到左侧
        if (itemLeft < currentScroll) {
            track.scrollTo({
                left: itemLeft - 10,
                behavior: 'smooth'
            });
        }
        // 如果选中项在右侧不可见，滚动到右侧
        else if (itemRight > currentScroll + trackWidth) {
            track.scrollTo({
                left: itemRight - trackWidth + 10,
                behavior: 'smooth'
            });
        }
    }
}

// 下载选中的格式和画质
async function downloadSelected() {
    if (!currentVideoData) {
        showToast('请先解析视频', 'error');
        return;
    }

    const downloadBtn = document.getElementById('downloadBtn');
    const originalText = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 准备下载...';

    try {
        const videoUrl = videoUrlInput.value.trim();
        const safeTitle = (currentVideoData.title || 'video').replace(/[<>:"/\\|?*]/g, '_');
        
        // 检查画质是否可用（需要画质的格式）
        const needsQuality = selectedFormat !== 'cover';
        if (needsQuality && !selectedQuality) {
            showToast('请先选择画质', 'error');
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
            return;
        }
        
        if (needsQuality) {
            const availableQualities = currentVideoData.downloadLinks || [];
            const selectedQualityInfo = availableQualities.find(q => q.qn === selectedQuality);
            
            if (selectedQualityInfo) {
                const needVip = selectedQualityInfo.needVip !== undefined ? selectedQualityInfo.needVip : (selectedQuality > 80);
                const exists = selectedQualityInfo.exists !== undefined ? selectedQualityInfo.exists : true;
                const canDownload = exists && (!needVip || (isLoggedIn && isVip));
                
                if (!canDownload) {
                    if (!exists) {
                        showToast('此视频不支持该画质', 'error');
                    } else if (needVip && !isLoggedIn) {
                        showToast('请先登录B站账号', 'error');
                        showLoginModal();
                    } else if (needVip && !isVip) {
                        showToast('此画质需要大会员，请登录大会员账号', 'error');
                    }
                    downloadBtn.disabled = false;
                    downloadBtn.innerHTML = originalText;
                    return;
                }
            }
        }
        
        const encodedUrl = encodeURIComponent(videoUrl);
        const qn = selectedQuality || 80;
        
        // 根据格式执行下载
        if (selectedFormat === 'cover') {
            // 下载封面
            if (!currentVideoData.thumbnail) {
                showToast('该视频没有封面', 'error');
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = originalText;
                return;
            }
            const downloadUrl = `${API_BASE_URL}/api/bilibili/download/cover?url=${encodedUrl}`;
            downloadFile(downloadUrl, `${safeTitle}.jpg`);
        } else if (selectedFormat === 'video+audio-separate') {
            // 分离下载：先下载视频，再下载音频
            showToast('开始分离下载，将依次下载视频和音频...', 'success');
            
            // 下载视频 - 使用流式代理
            const videoUrl_dl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=video`;
            downloadFile(videoUrl_dl, `${safeTitle}_video.m4s`);
            
            // 延迟下载音频
            setTimeout(() => {
                const audioUrl_dl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=audio`;
                downloadFile(audioUrl_dl, `${safeTitle}_audio.m4a`);
            }, 1000);
        } else if (selectedFormat === 'audio') {
            // 下载音频 - 使用流式代理
            const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=audio`;
            downloadFile(downloadUrl, `${safeTitle}.m4a`);
        } else if (selectedFormat === 'video-only') {
            // 下载视频（无音频）- 使用流式代理
            const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=video`;
            downloadFile(downloadUrl, `${safeTitle}_video.m4s`);
        } else {
            // 下载视频+音频合体（默认）- 需要服务器合并
            const downloadUrl = `${API_BASE_URL}/api/bilibili/download?url=${encodedUrl}&qn=${qn}`;
            downloadFile(downloadUrl, `${safeTitle}.mp4`);
        }
        
        // 显示提示
        showToast('正在准备下载，请稍候...', 'success');
        
    } catch (error) {
        showToast('下载失败: ' + error.message, 'error');
    } finally {
        setTimeout(() => {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
        }, 2000);
    }
}

// 下载文件辅助函数
// downloadFile 保留为别名，兼容旧代码
function downloadFile(url, filename) {
    triggerBrowserDownload(url, filename);
}

// 显示错误（兼容新 HTML）
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) errorMessage.textContent = message;
    if (errorSection) {
    errorSection.classList.remove('hidden');
    } else {
        // 新 HTML 没有 errorSection，使用 alert
        alert(message);
    }
}

// Toast 提示（兼容新 HTML）
function showToast(message, type = 'success') {
    if (toast && toastMessage) {
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
    } else {
        // 新 HTML 没有 toast，使用简单的提示
        console.log(`[${type}] ${message}`);
        // 可以在这里添加简单的提示实现
    }
}

// 公告管理
function showAdminModal() {
    document.getElementById('adminModal').classList.remove('hidden');
    loadAnnouncementForEdit();
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.add('hidden');
}

async function loadAnnouncementForEdit() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/announcement`);
        const data = await response.json();
        if (data.success) {
            document.getElementById('announcementInput').value = data.content || '';
        }
    } catch (error) {
        console.error('加载公告失败:', error);
    }
}

async function saveAnnouncement() {
    const content = document.getElementById('announcementInput').value.trim();
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/announcement`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, adminKey: 'your-secret-key' })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('公告已保存', 'success');
            loadAnnouncement();
            closeAdminModal();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        showToast('保存失败: ' + error.message, 'error');
    }
}

async function clearAnnouncement() {
    document.getElementById('announcementInput').value = '';
    await saveAnnouncement();
}

// 帮助页面
function showHelp() {
    showToast('使用说明：粘贴视频链接，点击解析即可下载', 'success');
}

function showFAQ() {
    showToast('常见问题：如遇下载失败，请尝试登录B站账号', 'success');
}

function showFeedback() {
    showToast('反馈建议：请联系开发者', 'success');
}

// 解析记录管理
function saveParseHistory(url, result) {
    try {
        let history = JSON.parse(localStorage.getItem('parseHistory') || '[]');
        
        // 检查是否已存在（避免重复）
        const existingIndex = history.findIndex(item => item.url === url);
        if (existingIndex !== -1) {
            // 更新现有记录
            history[existingIndex] = {
                url: url,
                title: result.title || '未知视频',
                platform: result.platform || '未知平台',
                author: result.author || '未知作者',
                thumbnail: result.thumbnail || '',
                timestamp: Date.now()
            };
        } else {
            // 添加新记录
            history.unshift({
                url: url,
                title: result.title || '未知视频',
                platform: result.platform || '未知平台',
                author: result.author || '未知作者',
                thumbnail: result.thumbnail || '',
                timestamp: Date.now()
            });
        }
        
        // 限制最多保存50条记录
        if (history.length > 50) {
            history = history.slice(0, 50);
        }
        
        localStorage.setItem('parseHistory', JSON.stringify(history));
    } catch (error) {
        console.error('保存解析记录失败:', error);
    }
}

function loadParseHistory() {
    try {
        const history = JSON.parse(localStorage.getItem('parseHistory') || '[]');
        const historyList = document.getElementById('historyList');
        
        if (history.length === 0) {
            historyList.innerHTML = '<div class="history-empty">暂无解析记录</div>';
            return;
        }
        
        historyList.innerHTML = '';
        
        history.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const timeStr = new Date(item.timestamp).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            historyItem.innerHTML = `
                <div class="history-info">
                    <div class="history-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                    <div class="history-meta">
                        <span>${item.platform}</span>
                        <span>${item.author}</span>
                        <span>${timeStr}</span>
                    </div>
                </div>
                <div class="history-actions">
                    <button class="history-action-btn" onclick="parseFromHistory('${item.url.replace(/'/g, "\\'")}')" title="重新解析">
                        <i class="fas fa-redo"></i>
                    </button>
                    <button class="history-action-btn" onclick="deleteHistoryItem(${index})" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            historyList.appendChild(historyItem);
        });
    } catch (error) {
        console.error('加载解析记录失败:', error);
    }
}

function parseFromHistory(url) {
    videoUrlInput.value = url;
    handleParse();
}

function deleteHistoryItem(index) {
    try {
        let history = JSON.parse(localStorage.getItem('parseHistory') || '[]');
        history.splice(index, 1);
        localStorage.setItem('parseHistory', JSON.stringify(history));
        loadParseHistory();
        showToast('已删除', 'success');
    } catch (error) {
        console.error('删除解析记录失败:', error);
    }
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== 新 HTML 适配函数 ====================

// 初始化 UI（新 HTML 使用）
function initUI() {
    if(appState.theme === 'dark') document.body.classList.add('dark-theme');

    // 延迟初始化，确保 DOM 完全加载
    setTimeout(() => {
        const fmtBtn = document.querySelector(`#formatSegment .segment-opt[data-val="${appState.format}"]`);
        if(fmtBtn) {
            setPreset('format', appState.format, fmtBtn);
        } else {
            const defaultBtn = document.querySelector(`#formatSegment .segment-opt[data-val="video+audio"]`);
            if(defaultBtn) {
                setPreset('format', 'video+audio', defaultBtn);
            }
        }

        const qBtn = document.querySelector(`#qualitySegment .segment-opt[data-val="${appState.quality}"]`);
        if(qBtn) {
            setPreset('quality', appState.quality, qBtn);
        } else {
            const defaultQBtn = document.querySelector(`#qualitySegment .segment-opt[data-val="80"]`);
            if(defaultQBtn) {
                setPreset('quality', 80, defaultQBtn);
            }
        }

        // 恢复视频格式选择
        const vfBtn = document.querySelector(`#videoFormatSegment .segment-opt[data-val="${appState.videoFormat}"]`);
        if(vfBtn) {
            setPreset('videoFormat', appState.videoFormat, vfBtn);
        } else {
            const defaultVfBtn = document.querySelector(`#videoFormatSegment .segment-opt[data-val="mp4"]`);
            if(defaultVfBtn) {
                setPreset('videoFormat', 'mp4', defaultVfBtn);
            }
        }

        // 恢复音频格式选择
        const afBtn = document.querySelector(`#audioFormatSegment .segment-opt[data-val="${appState.audioFormat}"]`);
        if(afBtn) {
            setPreset('audioFormat', appState.audioFormat, afBtn);
        } else {
            const defaultAfBtn = document.querySelector(`#audioFormatSegment .segment-opt[data-val="mp3"]`);
            if(defaultAfBtn) {
                setPreset('audioFormat', 'mp3', defaultAfBtn);
            }
        }
        
        // 设置文件名格式
        const filenameFormatEl = document.getElementById('filenameFormat');
        if (filenameFormatEl) filenameFormatEl.value = appState.filenameFormat;
    }, 100);
}

// 设置预设（新 HTML 使用）
function setPreset(type, val, btn) {
    // 🔒 VIP画质权限检查
    if (type === 'quality') {
        const needVip = val > 80; // 120(4K), 116(1080P60), 112(1080P+) 需要大会员
        if (needVip) {
            if (!isLoggedIn) {
                showToast('请先登录B站账号才能选择此画质', 'error');
                showLoginModal();
                return; // 阻止选择
            }
            if (!isVip) {
                showToast('此画质需要大会员权限', 'error');
                return; // 阻止选择
            }
        }
    }
    
    appState[type] = val;
    localStorage.setItem(`preset_${type}`, val);
    
    // 同步到旧变量（兼容）
    if (type === 'format') {
        presetFormat = val;
        selectedFormat = val;
    } else if (type === 'quality') {
        presetQuality = val;
        selectedQuality = val;
    }

    const container = btn.parentElement;
    container.querySelectorAll('.segment-opt').forEach(el => el.classList.remove('active'));
    btn.classList.add('active');
    
    moveGlider(container, btn);

    if (type === 'format') {
        // 更新格式相关的显示逻辑
        const qRow = document.getElementById('qualitySegment');
        const vfRow = document.getElementById('videoFormatSegment');
        const afRow = document.getElementById('audioFormatSegment');
        
        if (val === 'cover') {
            // 封面：隐藏所有格式和画质选择
            if (qRow) { qRow.style.display = 'none'; }
            if (vfRow) { vfRow.style.display = 'none'; }
            if (afRow) { afRow.style.display = 'none'; }
        } else if (val === 'audio') {
            // 仅音频：显示音频格式，隐藏视频格式和画质
            if (qRow) { qRow.style.display = 'none'; }
            if (vfRow) { vfRow.style.display = 'none'; }
            if (afRow) { 
                afRow.style.display = 'flex';
                setTimeout(() => {
                    const activeAf = document.querySelector('#audioFormatSegment .segment-opt.active');
                    if(activeAf) moveGlider(afRow, activeAf);
                }, 10);
            }
        } else if (val === 'video-only') {
            // 纯画面：显示视频格式和画质，隐藏音频格式
            if (qRow) { 
                qRow.style.display = 'flex';
                qRow.style.opacity = '1';
                qRow.style.pointerEvents = 'auto';
            }
            if (vfRow) { 
                vfRow.style.display = 'flex';
                setTimeout(() => {
                    const activeVf = document.querySelector('#videoFormatSegment .segment-opt.active');
                    if(activeVf) moveGlider(vfRow, activeVf);
                }, 10);
            }
            if (afRow) { afRow.style.display = 'none'; }
            setTimeout(() => {
                const activeQ = document.querySelector('#qualitySegment .segment-opt.active');
                if(activeQ) moveGlider(qRow, activeQ);
            }, 10);
        } else {
            // video+audio 或 video+audio-separate：显示所有相关选项
            if (qRow) { 
                qRow.style.display = 'flex';
                qRow.style.opacity = '1';
                qRow.style.pointerEvents = 'auto';
            }
            if (vfRow) { 
                vfRow.style.display = 'flex';
                setTimeout(() => {
                    const activeVf = document.querySelector('#videoFormatSegment .segment-opt.active');
                    if(activeVf) moveGlider(vfRow, activeVf);
                }, 10);
            }
            if (afRow) { 
                afRow.style.display = 'flex';
                setTimeout(() => {
                    const activeAf = document.querySelector('#audioFormatSegment .segment-opt.active');
                    if(activeAf) moveGlider(afRow, activeAf);
                }, 10);
            }
            setTimeout(() => {
                const activeQ = document.querySelector('#qualitySegment .segment-opt.active');
                if(activeQ) moveGlider(qRow, activeQ);
            }, 10);
        }
    }

    if (currentData || currentVideoData) updateDownloadHint();
}

// 移动滑动指示器（新 HTML 使用）
function moveGlider(container, targetBtn) {
    const glider = container.querySelector('.glider');
    if (!glider || !targetBtn) return;
    
    // 使用 requestAnimationFrame 确保 DOM 更新后再计算位置
    requestAnimationFrame(() => {
        const cRect = container.getBoundingClientRect();
        const bRect = targetBtn.getBoundingClientRect();
        const left = bRect.left - cRect.left + container.scrollLeft;
        glider.style.width = `${bRect.width}px`;
        glider.style.transform = `translateX(${left}px)`;
        glider.style.opacity = '0.15'; // 确保可见
    });
}

// 显示单视频结果（新 HTML 使用）
function showSingleResult(data) {
    currentData = data;
    currentVideoData = data; // 兼容旧代码
    
    // 保存搜索结果到localStorage（保持登录/退出后的状态）
    try {
        localStorage.setItem('lastParseResult', JSON.stringify(data));
        const currentUrl = videoUrlInput ? videoUrlInput.value.trim() : '';
        if (currentUrl) {
            localStorage.setItem('lastParseUrl', currentUrl);
        }
    } catch (e) {
        console.warn('保存解析结果失败:', e);
    }
    
    const resultSection = document.getElementById('resultSection');
    if (!resultSection) return;
    
    resultSection.classList.remove('hidden');
    
    const resTitle = document.getElementById('resTitle');
    const resAuthor = document.getElementById('resAuthor');
    const resDuration = document.getElementById('resDuration');
    const resCover = document.getElementById('resCover');
    const coverPlayBtn = document.getElementById('coverPlayBtn');
    
    if (resTitle) resTitle.innerText = data.title || '未知标题';
    if (resAuthor) resAuthor.innerHTML = `<i class="fas fa-user"></i> ${data.author || '未知UP主'}`;
    if (resDuration) resDuration.innerHTML = `<i class="far fa-clock"></i> ${data.duration || '00:00'}`;
    
    if (resCover && data.thumbnail) {
        let thumbnailUrl = data.thumbnail;
        if (thumbnailUrl.startsWith('//')) {
            thumbnailUrl = 'https:' + thumbnailUrl;
        }
        if (thumbnailUrl.includes('bilibili.com') || thumbnailUrl.includes('hdslb.com')) {
            thumbnailUrl = `${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(thumbnailUrl)}`;
        }
        resCover.src = thumbnailUrl;
    }
    
    if (coverPlayBtn && data.videoUrl) {
        coverPlayBtn.href = data.videoUrl;
    }
    
    // 提取支持的画质列表
    if (data.downloadLinks && data.downloadLinks.length > 0) {
        data.qualities = data.downloadLinks.map(link => link.qn).filter(qn => qn);
    } else {
        data.qualities = [80, 64, 32, 16]; // 默认画质
    }
    
    updateDownloadHint();
}

// 恢复上次的解析搜索结果（保持登录/退出后的状态）
function restoreLastParseResult() {
    try {
        const savedResult = localStorage.getItem('lastParseResult');
        const savedUrl = localStorage.getItem('lastParseUrl');
        
        if (savedResult && savedUrl) {
            const data = JSON.parse(savedResult);
            
            // 恢复URL输入
            if (videoUrlInput) {
                videoUrlInput.value = savedUrl;
            }
            
            // 恢复搜索结果显示
            showSingleResult(data);
            
            console.log('已恢复上次的解析搜索结果');
        }
    } catch (e) {
        console.warn('恢复解析结果失败:', e);
    }
}

// 更新下载提示（新 HTML 使用）
function updateDownloadHint() {
    const hintEl = document.getElementById('downloadHint');
    if (!hintEl) return;
    
    const data = currentData || currentVideoData;
    if (!data) return;
    
    if (appState.format === 'cover') { 
        hintEl.innerText = "封面图片"; 
        return; 
    }
    if (appState.format === 'audio') { 
        hintEl.innerText = "M4A/MP3 音频"; 
        return; 
    }

    const targetQ = appState.quality;
    const qualities = data.qualities || [];
    const supported = qualities.includes(targetQ);
    
    // 简单的画质名称映射
    const qNameMap = {
        120: '4K', 116: '1080P60', 112: '1080P+', 80: '1080P', 64: '720P', 32: '480P', 16: '360P'
    };
    const targetName = qNameMap[targetQ] || targetQ;

    if (supported) {
        hintEl.innerText = targetName;
    } else {
        const maxQ = qualities.length > 0 ? Math.max(...qualities) : 80;
        const maxName = qNameMap[maxQ] || maxQ;
        hintEl.innerHTML = `不支持 ${targetName}，将自动降至 <span style="color:#F59E0B">${maxName}</span>`;
    }
}

// 执行下载（新 HTML 使用）
async function executeDownload() {
    const data = currentData || currentVideoData;
    if(!data) {
        alert('请先解析视频');
        return;
    }
    
    const videoUrl = videoUrlInput ? videoUrlInput.value.trim() : '';
    if (!videoUrl) {
        alert('请先输入视频链接');
        return;
    }
    
    const safeTitle = (data.title || 'video').replace(/[<>:"/\\|?*]/g, '_');
    const encodedUrl = encodeURIComponent(videoUrl);
    const qn = appState.quality || 80;
    
    try {
        if (appState.format === 'cover') {
            const downloadUrl = `${API_BASE_URL}/api/bilibili/download/cover?url=${encodedUrl}`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}.jpg`);
        } else if (appState.format === 'video+audio-separate') {
            // 分离下载
            const videoUrl_dl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=video`;
            triggerBrowserDownload(videoUrl_dl, `${safeTitle}_video.m4s`);
            setTimeout(() => {
                const audioUrl_dl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=audio`;
                triggerBrowserDownload(audioUrl_dl, `${safeTitle}_audio.m4a`);
            }, 1000);
        } else if (appState.format === 'audio') {
            const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=audio`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}.m4a`);
        } else if (appState.format === 'video-only') {
            const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=video`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}_video.m4s`);
        } else {
            // 完整视频（需要服务器合并）
            const downloadUrl = `${API_BASE_URL}/api/bilibili/download?url=${encodedUrl}&qn=${qn}`;
            triggerBrowserDownload(downloadUrl, `${safeTitle}.mp4`);
        }
    } catch (error) {
        alert('下载失败: ' + error.message);
    }
}

// 检查公告（新 HTML 使用）
async function checkAnnouncement(forceShow = false) {
    if (!GIST_CONFIG.enabled && !forceShow) return;

    // Check if "Don't Show Today" is active
    if (!forceShow) {
        const dontShowDate = localStorage.getItem('announcement_dont_show_date');
        const today = new Date().toDateString();
        if (dontShowDate === today) {
            return; 
        }
    }

    try {
        const rawUrl = `https://gist.githubusercontent.com/${GIST_CONFIG.username}/${GIST_CONFIG.gistId}/raw/${GIST_CONFIG.filename}?t=${new Date().getTime()}`;
        const response = await fetch(rawUrl);
        if (!response.ok) throw new Error('Network error');
        
        const content = await response.text();
        let parsedContent;
        let shouldShow = forceShow;
        let versionId = "";

        try {
            const json = JSON.parse(content);
            // 修复公告排版：移除重复的标题，只显示内容
            let message = json.message || '';
            // 如果消息包含 Markdown 标题，转换为 HTML
            message = message.replace(/## 📢 最新更新\n\n/g, '<h4 style="color:var(--primary); margin-bottom:15px; font-size:1.1rem;">📢 最新更新</h4>');
            message = message.replace(/## 📜 更新历史\n\n/g, '<h4 style="color:var(--primary); margin-top:20px; margin-bottom:15px; font-size:1.1rem;">📜 更新历史</h4>');
            // 将换行转换为 <br>
            message = message.replace(/\n/g, '<br>');
            
            parsedContent = `
                <h4 style="color:var(--primary); margin-bottom:15px; font-size:1.1rem;">${escapeHtml(json.title || '公告')}</h4>
                <div style="line-height:1.8; font-size:0.95rem; color:var(--text-main);">${message}</div>
                <p style="margin-top:15px; font-size:0.8rem; color:var(--text-gray); text-align:right;">${escapeHtml(json.date || new Date().toLocaleDateString())}</p>
            `;
            if(json.isActive === false && !forceShow) return;
            versionId = json.id || content.length;
        } catch (e) {
            // 如果不是 JSON，直接显示文本内容
            let textContent = escapeHtml(content);
            textContent = textContent.replace(/## 📢 最新更新\n\n/g, '<h4 style="color:var(--primary); margin-bottom:15px; font-size:1.1rem;">📢 最新更新</h4>');
            textContent = textContent.replace(/## 📜 更新历史\n\n/g, '<h4 style="color:var(--primary); margin-top:20px; margin-bottom:15px; font-size:1.1rem;">📜 更新历史</h4>');
            textContent = textContent.replace(/\n/g, '<br>');
            parsedContent = `<div style="white-space: pre-wrap; line-height:1.8; color:var(--text-main); font-size:0.95rem;">${textContent}</div>`;
            versionId = content.length;
        }

        const announcementContent = document.getElementById('announcementContent');
        const announcementModal = document.getElementById('announcementModal');
        
        if (shouldShow || !localStorage.getItem('gist_read_' + versionId)) {
            if (announcementContent) announcementContent.innerHTML = parsedContent;
            if (announcementModal) {
                announcementModal.classList.remove('hidden');
                const checkbox = document.getElementById('dontShowTodayCheckbox');
                if (checkbox) checkbox.checked = false;
            }
            
            if (!forceShow) localStorage.setItem('gist_read_' + versionId, 'true');
        }
    } catch (error) {
        if(forceShow) {
            const announcementContent = document.getElementById('announcementContent');
            const announcementModal = document.getElementById('announcementModal');
            if (announcementContent) announcementContent.innerHTML = '<p style="text-align:center; color:var(--text-gray);">无法加载公告</p>';
            if (announcementModal) announcementModal.classList.remove('hidden');
        }
    }
}

// 关闭公告（新 HTML 使用）
function closeAnnouncement() {
    const checkbox = document.getElementById('dontShowTodayCheckbox');
    if (checkbox && checkbox.checked) {
        const today = new Date().toDateString();
        localStorage.setItem('announcement_dont_show_date', today);
    }
    const announcementModal = document.getElementById('announcementModal');
    if (announcementModal) announcementModal.classList.add('hidden');
}

// 切换历史记录下拉菜单（新 HTML 使用）
function toggleHistory(e) {
    if (e) e.stopPropagation();
    const historyDropdown = document.getElementById('historyDropdown');
    if (historyDropdown) historyDropdown.classList.toggle('active');
}

// 保存历史记录（新 HTML 使用）
function saveHistory(url, title, author) {
    let history = JSON.parse(localStorage.getItem('parse_history') || '[]');
    history = history.filter(h => h.url !== url);
    history.unshift({ url, title, author, time: new Date().toLocaleDateString() });
    if(history.length > 20) history.pop();
    localStorage.setItem('parse_history', JSON.stringify(history));
    loadHistoryToDropdown();
}

// 加载历史记录到下拉菜单（新 HTML 使用）
function loadHistoryToDropdown() {
    const list = document.getElementById('historyDropdownList');
    if (!list) return;
    
    const history = JSON.parse(localStorage.getItem('parse_history') || '[]');
    
    if(history.length === 0) {
        list.innerHTML = '<div style="padding:15px; text-align:center; color:var(--text-gray); font-size:0.85rem;">暂无历史记录</div>';
        return;
    }

    list.innerHTML = '';
    history.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'history-row';
        div.onclick = () => { 
            if (videoUrlInput) videoUrlInput.value = item.url;
            const historyDropdown = document.getElementById('historyDropdown');
            if (historyDropdown) historyDropdown.classList.remove('active');
            handleSmartParse();
        };
        div.innerHTML = `
            <div class="history-row-content">
                <div class="history-row-title">${escapeHtml(item.title || item.url)}</div>
                <div class="history-row-meta">${escapeHtml(item.author || '未知')} · ${escapeHtml(item.time || '')}</div>
            </div>
            <div class="history-row-delete" onclick="deleteHistoryItem(event, ${idx})"><i class="fas fa-times"></i></div>
        `;
        list.appendChild(div);
    });
}

// 删除历史记录项（新 HTML 使用）
function deleteHistoryItem(e, idx) {
    if (e) e.stopPropagation();
    let history = JSON.parse(localStorage.getItem('parse_history') || '[]');
    history.splice(idx, 1);
    localStorage.setItem('parse_history', JSON.stringify(history));
    loadHistoryToDropdown();
}

// 清空历史记录（新 HTML 使用）
function clearHistory() {
    localStorage.removeItem('parse_history');
    loadHistoryToDropdown();
}

// 检查登录状态（新 HTML 使用）
function checkLogin() {
    checkLoginStatus().then(() => {
        if(isLoggedIn && userInfo) {
            const loginBtnArea = document.getElementById('loginBtnArea');
            const userInfoArea = document.getElementById('userInfoArea');
            const headerAvatar = document.getElementById('headerAvatar');
            const headerName = document.getElementById('headerName');
            const headerVipBadge = document.getElementById('headerVipBadge');
            
            if (loginBtnArea) loginBtnArea.classList.add('hidden');
            if (userInfoArea) userInfoArea.classList.remove('hidden');
            if (headerAvatar && userInfo.avatar) {
                let avatarUrl = userInfo.avatar;
                if (avatarUrl.startsWith('//')) avatarUrl = 'https:' + avatarUrl;
                if (avatarUrl.includes('bilibili.com') || avatarUrl.includes('hdslb.com')) {
                    avatarUrl = `${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(avatarUrl)}`;
                }
                headerAvatar.src = avatarUrl;
            }
            if (headerName && userInfo.name) headerName.textContent = userInfo.name;
            
            // 显示VIP状态
            if (headerVipBadge) {
                headerVipBadge.classList.remove('hidden');
                if (isVip) {
                    headerVipBadge.textContent = '大会员';
                    headerVipBadge.classList.remove('normal');
                } else {
                    headerVipBadge.textContent = '普通用户';
                    headerVipBadge.classList.add('normal');
                }
            }
        } else {
            const loginBtnArea = document.getElementById('loginBtnArea');
            const userInfoArea = document.getElementById('userInfoArea');
            const headerVipBadge = document.getElementById('headerVipBadge');
            if (loginBtnArea) loginBtnArea.classList.remove('hidden');
            if (userInfoArea) userInfoArea.classList.add('hidden');
            if (headerVipBadge) headerVipBadge.classList.add('hidden');
        }
    });
}

// 更新 handleSmartParse 以适配新 HTML（包装原函数）
const originalHandleSmartParse = handleSmartParse;
handleSmartParse = async function() {
    const input = videoUrlInput ? videoUrlInput.value.trim() : '';
    if (!input) {
        alert('请输入链接');
        return;
    }
    
    if (loadingSection) loadingSection.classList.remove('hidden');
    if (resultSection) resultSection.classList.add('hidden');
    const batchSectionEl = document.getElementById('batchSection');
    if (batchSectionEl) batchSectionEl.classList.add('hidden');
    if (errorSection) errorSection.classList.add('hidden');

    try {
        // 🔧 先检测收藏夹和UP主（优先级最高）
        const inputType = detectInputType(input);
        console.log('输入类型检测:', inputType); // 调试日志
        
        if (inputType.type === 'favorites') {
            await handleFavoritesParse(inputType.id);
            return;
        }
        
        if (inputType.type === 'user') {
            await handleUserVideosParse(inputType.uid);
            return;
        }
        
        // 🔧 再提取视频链接
        const urls = extractBilibiliUrls(input);
        console.log('提取到的视频链接:', urls); // 调试日志
        
        if (urls.length > 1) {
            // 批量解析
            await handleBatchParseNew(urls);
        } else if (urls.length === 1) {
            // 单链接解析
            await handleSingleParse(urls[0]);
        } else {
            throw new Error('无法识别输入内容，请检查是否为B站链接、收藏夹或UP主主页');
        }
    } catch (error) {
        if (errorSection) {
            errorSection.classList.remove('hidden');
            const errorMessage = document.getElementById('errorMessage');
            if (errorMessage) errorMessage.textContent = error.message;
        } else {
            alert(error.message);
        }
    } finally {
        if (loadingSection) loadingSection.classList.add('hidden');
    }
};

// 更新 handleBatchParse 以适配新 HTML（保留原函数，添加新版本）
async function handleBatchParseNew(urls) {
    if (!urls || urls.length === 0) {
        alert('请输入至少一个有效链接');
        return;
    }
    
    const batchSectionEl = document.getElementById('batchSection');
    const batchListEl = document.getElementById('batchList');
    const batchCountEl = document.getElementById('batchCount');
    
    if (batchSectionEl) batchSectionEl.classList.remove('hidden');
    if (batchListEl) batchListEl.innerHTML = '';
    if (batchCountEl) batchCountEl.textContent = '0';
    
    batchResults = [];
    let successCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < urls.length; i++) {
        // 显示解析中状态
        if (batchListEl) {
            const item = document.createElement('div');
            item.className = 'batch-item';
            item.innerHTML = `
                <div class="batch-thumb"></div>
                <div class="batch-info">
                    <div class="batch-title">正在解析... ${escapeHtml(urls[i])}</div>
                </div>
            `;
            batchListEl.appendChild(item);
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urls[i] })
            });
            
            const data = await response.json();
            
            if (data.success) {
                batchResults.push({
                    success: true,
                    url: urls[i],
                    data: data.data
                });
                successCount++;
                
                // 更新列表项
                if (batchListEl && batchListEl.children[i]) {
                    const resultData = data.data;
                    let thumbnailUrl = resultData.thumbnail || '';
                    if (thumbnailUrl.startsWith('//')) thumbnailUrl = 'https:' + thumbnailUrl;
                    if (thumbnailUrl && (thumbnailUrl.includes('bilibili.com') || thumbnailUrl.includes('hdslb.com'))) {
                        thumbnailUrl = `${API_BASE_URL}/api/proxy/image?url=${encodeURIComponent(thumbnailUrl)}`;
                    }
                    
                    batchListEl.children[i].innerHTML = `
                        <img class="batch-thumb" src="${thumbnailUrl || 'data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 9\"><rect fill=\"%23334155\" width=\"16\" height=\"9\"/></svg>'}">
                        <div class="batch-info">
                            <div class="batch-title">${escapeHtml(resultData.title || '未知标题')}</div>
                            <div class="batch-status success"><i class="fas fa-check"></i> 解析成功</div>
                        </div>
                        <button onclick="downloadBatchItem(${i})" style="background:var(--primary); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                            <i class="fas fa-download"></i>
                        </button>
                    `;
                }
            } else {
                batchResults.push({
                    success: false,
                    url: urls[i],
                    error: data.error || '解析失败'
                });
                failedCount++;
                
                // 更新列表项显示错误
                if (batchListEl && batchListEl.children[i]) {
                    batchListEl.children[i].innerHTML = `
                        <div class="batch-info">
                            <div class="batch-title">${escapeHtml(urls[i])}</div>
                            <div class="batch-status error"><i class="fas fa-times"></i> ${escapeHtml(data.error || '解析失败')}</div>
                        </div>
                        <button onclick="retryBatchItem(${i})" style="background:var(--blue); color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
                            <i class="fas fa-redo"></i>
                        </button>
                    `;
                }
            }
        } catch (error) {
            batchResults.push({
                success: false,
                url: urls[i],
                error: error.message || '网络错误'
            });
            failedCount++;
            
            // 更新列表项显示错误
            if (batchListEl && batchListEl.children[i]) {
                batchListEl.children[i].innerHTML = `
                    <div class="batch-info">
                        <div class="batch-title">${escapeHtml(urls[i])}</div>
                        <div class="batch-status error"><i class="fas fa-times"></i> ${escapeHtml(error.message || '网络错误')}</div>
                    </div>
                `;
            }
        }
        
        if (batchCountEl) batchCountEl.textContent = batchResults.length;
        
        // 稍微延迟避免请求过快
        if (i < urls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    // 更新计数
    if (batchCountEl) batchCountEl.textContent = batchResults.length;
}

// 更新 downloadAllBatch 以适配新 HTML
const originalDownloadAllBatch = downloadAllBatch;
downloadAllBatch = function() {
    const progSec = document.getElementById('progressSection');
    if (progSec) progSec.classList.remove('hidden');
    
    const fill = document.getElementById('progressFill');
    const status = document.getElementById('progressStatus');
    const num = document.getElementById('progressNum');
    
    const successItems = batchResults.filter(r => r.success);
    let total = successItems.length;
    let current = 0;
    
    if (status) status.innerText = "正在下载队列...";
    
    successItems.forEach((item, index) => {
        setTimeout(() => {
            const data = item.data;
            const safeTitle = (data.title || 'video').replace(/[<>:"/\\|?*]/g, '_');
            const encodedUrl = encodeURIComponent(item.url);
            const qn = appState.quality || 80;
            
            try {
                if (appState.format === 'audio') {
                    const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=audio`;
                    triggerBrowserDownload(downloadUrl, `${safeTitle}.m4a`);
                } else if (appState.format === 'cover') {
                    const downloadUrl = `${API_BASE_URL}/api/bilibili/download/cover?url=${encodedUrl}`;
                    triggerBrowserDownload(downloadUrl, `${safeTitle}.jpg`);
                } else if (appState.format === 'video-only') {
                    const downloadUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=video`;
                    triggerBrowserDownload(downloadUrl, `${safeTitle}_video.m4s`);
                } else if (appState.format === 'video+audio-separate') {
                    const videoUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=video`;
                    triggerBrowserDownload(videoUrl, `${safeTitle}_video.m4s`);
                    setTimeout(() => {
                        const audioUrl = `${API_BASE_URL}/api/bilibili/stream?url=${encodedUrl}&qn=${qn}&type=audio`;
                        triggerBrowserDownload(audioUrl, `${safeTitle}_audio.m4a`);
                    }, 800);
                } else {
                    const downloadUrl = `${API_BASE_URL}/api/bilibili/download?url=${encodedUrl}&qn=${qn}`;
                    triggerBrowserDownload(downloadUrl, `${safeTitle}.mp4`);
                }
                
                current++;
                if (fill) {
                    let pct = (current / total) * 100;
                    fill.style.width = pct + '%';
                }
                if (num) num.innerText = `${current}/${total}`;
                
                if (current >= total) {
                    if (status) status.innerText = "下载完成！";
                    setTimeout(() => {
                        if (progSec) progSec.classList.add('hidden');
                    }, 3000);
                }
            } catch (error) {
                console.error('下载失败:', error);
            }
        }, index * 2000); // 每个下载间隔2秒
    });
};

// 清空批量结果（新 HTML 使用）
function clearBatch() {
    if (batchSection) batchSection.classList.add('hidden');
    batchResults = [];
    if (batchList) batchList.innerHTML = '';
    if (batchCount) batchCount.textContent = '0';
}

// ==================== 背景图系统 (二次元美少女) ====================

// 背景图配置 - 二次元美少女图片（支持本地图片）
const bgConfig = {
    // 统一背景图池（不区分白天黑夜，3分钟自动切换）
    images: [
        // 本地图片（推荐）：把喜欢的图放在 public/images/ 下
        // 取消注释并添加你的本地图片路径：
        // 'images/bg1.jpg',
        // 'images/bg2.jpg',
        // 'images/bg3.jpg',
        // 在线API（备用）
        'https://api.ixiaowai.cn/gqapi/gqapi.php', // 风景/二次元API
        'https://img.paulzzh.com/touhou/random', // 东方Project随机图 (质量高)
        'https://www.dmoe.cc/random.php', // 随机二次元美少女
        'https://api.ixiaowai.cn/api/api.php', // 综合随机二次元
    ],
    // 轮换间隔（毫秒）：3分钟 = 180000ms
    rotateInterval: 180000,
    // 当前使用的图片索引
    currentIndex: 0
};

// 背景图轮换定时器
let bgRotateTimer = null;

// 更新背景图逻辑（不随主题切换，3分钟自动轮换）
function updateBackgroundImage() {
    const bgElement = document.getElementById('backgroundImage');
    if (!bgElement || !bgConfig.images || bgConfig.images.length === 0) return;

    // 按顺序选择图片（循环）
    let url = bgConfig.images[bgConfig.currentIndex];
    
    // 如果是API链接，添加时间戳防止缓存
    if (url.startsWith('http')) {
        url += (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();
    }

    // 图片预加载
    const img = new Image();
    img.src = url;
    
    img.onload = () => {
        // 直接设置背景图，让CSS控制透明度和滤镜
        bgElement.style.backgroundImage = `url('${url}')`;
        // 清除内联样式，让CSS类控制效果
        bgElement.style.opacity = '';
        bgElement.style.filter = '';
        
        // 更新索引，下次使用下一张
        bgConfig.currentIndex = (bgConfig.currentIndex + 1) % bgConfig.images.length;
    };

    img.onerror = () => {
        console.warn('背景图加载失败，跳过到下一张');
        // 加载失败时跳过到下一张
        bgConfig.currentIndex = (bgConfig.currentIndex + 1) % bgConfig.images.length;
        // 如果还有图片，尝试加载下一张
        if (bgConfig.images.length > 0) {
            setTimeout(() => updateBackgroundImage(), 1000);
        } else {
            // 没有可用图片时使用渐变
            const isDark = document.body.classList.contains('dark-theme');
            if(isDark) {
                bgElement.style.backgroundImage = 'linear-gradient(135deg, #2d1934 0%, #231428 50%, #321937 100%)';
            } else {
                bgElement.style.backgroundImage = 'linear-gradient(135deg, #ffeef5 0%, #fff0f5 50%, #ffe4ec 100%)';
            }
        }
    };
}

// 切换主题（新 HTML 使用）
function toggleTheme() {
    if (!appState) {
        appState = {
            format: localStorage.getItem('preset_format') || 'video+audio',
            quality: parseInt(localStorage.getItem('preset_quality') || '80'),
            videoFormat: localStorage.getItem('preset_videoFormat') || 'mp4',
            audioFormat: localStorage.getItem('preset_audioFormat') || 'mp3',
            theme: localStorage.getItem('theme') || 'light',
            filenameFormat: localStorage.getItem('filename_format') || 'title'
        };
    }
    
    const isDark = document.body.classList.contains('dark-theme');
    const newTheme = isDark ? 'light' : 'dark';
    
    if (newTheme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
    }
    
    appState.theme = newTheme;
    localStorage.setItem('theme', appState.theme);
    
    // 注意：背景图不再随主题切换，保持3分钟自动轮换
    
    // 同步到旧变量（兼容）
    if (appSettings) {
        appSettings.theme = appState.theme;
        localStorage.setItem('appSettings', JSON.stringify(appSettings));
    }
}

// 初始化背景图（含轮换定时器）
function initBackgroundImage() {
    const backgroundImage = document.getElementById('backgroundImage');
    if (!backgroundImage) {
        console.warn('背景图容器未找到');
        return;
    }
    
    // 恢复上次的图片索引（从localStorage）
    const savedIndex = localStorage.getItem('bg_currentIndex');
    if (savedIndex !== null) {
        bgConfig.currentIndex = parseInt(savedIndex) || 0;
    }
    
    // 初始化背景（不依赖主题）
    updateBackgroundImage();
    
    // 启动背景图轮换定时器（每3分钟换一张）
    startBackgroundRotation();
    
    console.log('背景图已初始化，每3分钟自动轮换，不随主题切换');
}

// 启动背景图轮换
function startBackgroundRotation() {
    // 清除旧定时器
    if (bgRotateTimer) {
        clearInterval(bgRotateTimer);
    }
    
    // 每3分钟轮换一次背景图（不随主题切换）
    bgRotateTimer = setInterval(() => {
        console.log('背景图轮换中...');
        updateBackgroundImage();
        // 保存当前索引
        localStorage.setItem('bg_currentIndex', bgConfig.currentIndex.toString());
    }, bgConfig.rotateInterval);
}

// 停止背景图轮换
function stopBackgroundRotation() {
    if (bgRotateTimer) {
        clearInterval(bgRotateTimer);
        bgRotateTimer = null;
    }
}

// 更新 saveSettings 以适配新 HTML
const originalSaveSettings = saveSettings;
saveSettings = function() {
    const filenameFormatEl = document.getElementById('filenameFormat');
    if (filenameFormatEl) {
        appState.filenameFormat = filenameFormatEl.value;
        localStorage.setItem('filename_format', appState.filenameFormat);
    }
};

// 更新 handleSingleParse 以适配新 HTML
const originalHandleSingleParse = handleSingleParse;
handleSingleParse = async function(url) {
    if (loadingSection) loadingSection.classList.remove('hidden');
    if (resultSection) resultSection.classList.add('hidden');
    if (batchSection) batchSection.classList.add('hidden');
    if (errorSection) errorSection.classList.add('hidden');
    if (parseBtn) parseBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        if (data.success) {
            currentVideoData = data.data;
            currentData = data.data; // 新 HTML 使用
            
            // 保存历史记录
            saveHistory(url, data.data.title, data.data.author);
            
            // 显示结果
            showSingleResult(data.data);
        } else {
            throw new Error(data.error || '解析失败');
        }
    } catch (error) {
        if (errorSection) {
            errorSection.classList.remove('hidden');
            const errorMessage = document.getElementById('errorMessage');
            if (errorMessage) errorMessage.textContent = error.message;
        } else {
            alert(error.message);
        }
    } finally {
        if (loadingSection) loadingSection.classList.add('hidden');
        if (parseBtn) parseBtn.disabled = false;
    }
};

// 导出全局函数
window.showLoginModal = showLoginModal;
window.closeLoginModal = closeLoginModal;
window.refreshQRCode = refreshQRCode;
window.logout = logout;
window.downloadSelected = downloadSelected;
window.downloadWithPreset = downloadWithPreset;
window.selectFormat = selectFormat;
window.parseFromHistory = parseFromHistory;
window.deleteHistoryItem = deleteHistoryItem;
window.showAdminModal = showAdminModal;
window.closeAdminModal = closeAdminModal;
window.saveAnnouncement = saveAnnouncement;
window.clearAnnouncement = clearAnnouncement;
window.showHelp = showHelp;
window.showFAQ = showFAQ;
window.showFeedback = showFeedback;
// 智能解析
window.handleSmartParse = handleSmartParse;
window.downloadBatchItem = downloadBatchItem;
window.retryBatchItem = retryBatchItem;
window.downloadAllBatch = downloadAllBatch;
window.clearBatchResults = clearBatchResults;
// Gist 公告
window.showGistAnnouncement = showGistAnnouncement;
window.closeGistAnnouncement = closeGistAnnouncement;
window.toggleDontShowAgain = toggleDontShowAgain;
// 预设选项
window.selectPresetFormat = selectPresetFormat;
window.selectPresetQuality = selectPresetQuality;
window.selectPresetOutput = selectPresetOutput;
// 设置
window.toggleSettings = toggleSettings;
window.toggleTheme = toggleTheme; // 新 HTML 使用 toggleTheme
window.setTheme = toggleTheme; // 兼容旧代码
window.saveSettings = saveSettings;
// 新 HTML 使用的函数
window.setPreset = setPreset;
window.moveGlider = moveGlider;
window.showSingleResult = showSingleResult;
window.executeDownload = executeDownload;
window.checkAnnouncement = checkAnnouncement;
window.closeAnnouncement = closeAnnouncement;
window.toggleHistory = toggleHistory;
window.loadHistoryToDropdown = loadHistoryToDropdown;
window.deleteHistoryItem = deleteHistoryItem;
window.clearHistory = clearHistory;
window.checkLogin = checkLogin;
window.clearBatch = clearBatch;
window.initUI = initUI;

// 关于我们弹窗
function showAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) modal.classList.remove('hidden');
}

function closeAboutModal() {
    const modal = document.getElementById('aboutModal');
    if (modal) modal.classList.add('hidden');
}

// 使用说明弹窗
function showUsageModal() {
    const modal = document.getElementById('usageModal');
    if (modal) modal.classList.remove('hidden');
}

function closeUsageModal() {
    const modal = document.getElementById('usageModal');
    if (modal) modal.classList.add('hidden');
}

// 建议反馈弹窗
function showFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) modal.classList.remove('hidden');
}

function closeFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) modal.classList.add('hidden');
}
