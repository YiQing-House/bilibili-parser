const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const videoParser = require('./services/videoParser');
const ytdlpService = require('./services/ytdlpService');
const bilibiliService = require('./services/bilibiliService');
const multiPlatformService = require('./services/multiPlatformService');

const app = express();
const PORT = process.env.PORT || 3000;

// 存储数据
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 公告文件路径
const ANNOUNCEMENT_FILE = path.join(DATA_DIR, 'announcement.json');

// 管理员密钥（生产环境应使用环境变量）
const ADMIN_KEY = process.env.ADMIN_KEY || 'your-secret-key';

// 存储登录会话（内存存储，重启会丢失）
const loginSessions = new Map();

// 中间件
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（前端）
app.use(express.static(path.join(__dirname, 'public')));

// ==================== 公告系统 ====================

// 获取公告
app.get('/api/announcement', (req, res) => {
    try {
        if (fs.existsSync(ANNOUNCEMENT_FILE)) {
            const data = JSON.parse(fs.readFileSync(ANNOUNCEMENT_FILE, 'utf8'));
            res.json({ success: true, content: data.content || '' });
        } else {
            res.json({ success: true, content: '' });
        }
    } catch (error) {
        res.json({ success: true, content: '' });
    }
});

// 保存公告（需要管理员密钥）
app.post('/api/announcement', (req, res) => {
    try {
        const { content, adminKey } = req.body;
        
        if (adminKey !== ADMIN_KEY) {
            return res.status(403).json({ success: false, error: '权限不足' });
        }
        
        fs.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify({ 
            content: content || '', 
            updatedAt: new Date().toISOString() 
        }));
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== B站登录系统 ====================

// 获取登录二维码
app.get('/api/bilibili/qrcode', async (req, res) => {
    try {
        const response = await axios.get('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bilibili.com/'
            }
        });
        
        if (response.data.code === 0) {
            const { url, qrcode_key } = response.data.data;
            
            // 生成二维码图片URL（使用第三方API）
            const qrcodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
            
            res.json({
                success: true,
                qrcodeUrl: qrcodeUrl,
                qrcodeKey: qrcode_key
            });
        } else {
            throw new Error(response.data.message || '获取二维码失败');
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 检查二维码扫描状态
app.get('/api/bilibili/qrcode/check', async (req, res) => {
    try {
        const { key } = req.query;
        
        if (!key) {
            return res.status(400).json({ success: false, error: '缺少qrcode_key' });
        }
        
        const response = await axios.get(`https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${key}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bilibili.com/'
            }
        });
        
        const data = response.data.data;
        let status = 'waiting';
        let userInfo = null;
        let isVip = false;
        let cookies = null;
        
        switch (data.code) {
            case 0: // 登录成功
                status = 'confirmed';
                // 从URL中提取cookie参数
                const urlParams = new URLSearchParams(data.url.split('?')[1]);
                const sessdata = urlParams.get('SESSDATA');
                const biliJct = urlParams.get('bili_jct');
                const dedeUserId = urlParams.get('DedeUserID');
                
                if (sessdata) {
                    cookies = {
                        SESSDATA: sessdata,
                        bili_jct: biliJct,
                        DedeUserID: dedeUserId
                    };
                    
                    // 获取用户信息
                    try {
                        const userResponse = await axios.get('https://api.bilibili.com/x/web-interface/nav', {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Cookie': `SESSDATA=${sessdata}; bili_jct=${biliJct}; DedeUserID=${dedeUserId}`
                            }
                        });
                        
                        if (userResponse.data.code === 0) {
                            const userData = userResponse.data.data;
                            userInfo = {
                                name: userData.uname,
                                avatar: userData.face,
                                mid: userData.mid
                            };
                            isVip = userData.vipStatus === 1;
                        }
                    } catch (e) {
                        console.error('获取用户信息失败:', e.message);
                    }
                    
                    // 存储会话
                    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    loginSessions.set(sessionId, {
                        cookies,
                        userInfo,
                        isVip,
                        createdAt: Date.now()
                    });
                    
                    // 设置cookie
                    res.cookie('bili_session', sessionId, {
                        httpOnly: true,
                        maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
                    });
                }
                break;
            case 86038: // 二维码已过期
                status = 'expired';
                break;
            case 86090: // 已扫码未确认
                status = 'scanned';
                break;
            case 86101: // 未扫码
                status = 'waiting';
                break;
        }
        
        res.json({
            success: true,
            status,
            userInfo,
            isVip
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 检查登录状态
app.get('/api/bilibili/status', (req, res) => {
    try {
        const sessionId = req.cookies?.bili_session;
        
        if (sessionId && loginSessions.has(sessionId)) {
            const session = loginSessions.get(sessionId);
            res.json({
                success: true,
                isLoggedIn: true,
                isVip: session.isVip,
                userInfo: session.userInfo
            });
        } else {
            res.json({
                success: true,
                isLoggedIn: false
            });
        }
    } catch (error) {
        res.json({ success: true, isLoggedIn: false });
    }
});

// 退出登录
app.post('/api/bilibili/logout', (req, res) => {
    try {
        const sessionId = req.cookies?.bili_session;
        
        if (sessionId) {
            loginSessions.delete(sessionId);
            res.clearCookie('bili_session');
        }
        
        res.json({ success: true });
    } catch (error) {
        res.json({ success: true });
    }
});

// B站视频下载（支持画质选择）
app.get('/api/bilibili/download', async (req, res) => {
    try {
        const { url, qn = 80 } = req.query;
        
        if (!url) {
            return res.status(400).json({ success: false, error: '请提供视频链接' });
        }
        
        // 获取用户cookies（如果已登录）
        let cookies = null;
        const sessionId = req.cookies?.bili_session;
        if (sessionId && loginSessions.has(sessionId)) {
            cookies = loginSessions.get(sessionId).cookies;
        }
        
        console.log('B站视频下载请求:', { url, qn, hasLogin: !!cookies });
        
        // 使用bilibiliService下载
        await bilibiliService.downloadWithQuality(url, parseInt(qn), cookies, res);
        
    } catch (error) {
        console.error('B站下载错误:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

// B站音频下载（支持画质选择）
app.get('/api/bilibili/download/audio', async (req, res) => {
    try {
        const { url, qn = 80 } = req.query;
        
        if (!url) {
            return res.status(400).json({ success: false, error: '请提供视频链接' });
        }
        
        // 获取用户cookies（如果已登录）
        let cookies = null;
        const sessionId = req.cookies?.bili_session;
        if (sessionId && loginSessions.has(sessionId)) {
            cookies = loginSessions.get(sessionId).cookies;
        }
        
        console.log('B站音频下载请求:', { url, qn, hasLogin: !!cookies });
        
        // 使用bilibiliService下载音频
        await bilibiliService.downloadAudio(url, parseInt(qn), cookies, res);
        
    } catch (error) {
        console.error('B站音频下载错误:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

// B站收藏夹解析
app.get('/api/bilibili/favorites', async (req, res) => {
    try {
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ success: false, error: '请提供收藏夹ID' });
        }
        
        // 获取用户cookies（如果已登录）
        let cookies = null;
        const sessionId = req.cookies?.bili_session;
        if (sessionId && loginSessions.has(sessionId)) {
            cookies = loginSessions.get(sessionId).cookies;
        }
        
        console.log('解析B站收藏夹:', { id, hasLogin: !!cookies });
        
        // 使用multiPlatformService解析收藏夹
        const result = await multiPlatformService.parseBilibiliFavorites(id, cookies);
        
        res.json(result);
        
    } catch (error) {
        console.error('收藏夹解析错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// B站用户投稿解析
app.get('/api/bilibili/user-videos', async (req, res) => {
    try {
        const { uid } = req.query;
        
        if (!uid) {
            return res.status(400).json({ success: false, error: '请提供用户UID' });
        }
        
        // 获取用户cookies（如果已登录）
        let cookies = null;
        const sessionId = req.cookies?.bili_session;
        if (sessionId && loginSessions.has(sessionId)) {
            cookies = loginSessions.get(sessionId).cookies;
        }
        
        console.log('解析B站用户投稿:', { uid, hasLogin: !!cookies });
        
        // 使用multiPlatformService解析用户投稿
        const result = await multiPlatformService.parseBilibiliUserVideos(uid, cookies);
        
        res.json(result);
        
    } catch (error) {
        console.error('用户投稿解析错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 批量解析接口
app.post('/api/parse/batch', async (req, res) => {
    try {
        const { urls } = req.body;
        
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({ success: false, error: '请提供视频链接数组' });
        }
        
        if (urls.length > 50) {
            return res.status(400).json({ success: false, error: '单次最多解析50个链接' });
        }
        
        console.log('批量解析请求:', urls.length, '个链接');
        
        // 使用multiPlatformService批量解析
        const results = await multiPlatformService.parseMultiple(urls);
        
        res.json({
            success: true,
            total: urls.length,
            results: results
        });
        
    } catch (error) {
        console.error('批量解析错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// B站封面下载
app.get('/api/bilibili/download/cover', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ success: false, error: '请提供视频链接' });
        }
        
        console.log('B站封面下载请求:', { url });
        
        // 使用bilibiliService下载封面
        await bilibiliService.downloadCover(url, res);
        
    } catch (error) {
        console.error('B站封面下载错误:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

// B站视频下载（无音频）
app.get('/api/bilibili/download/video-only', async (req, res) => {
    try {
        const { url, qn = 80 } = req.query;
        
        if (!url) {
            return res.status(400).json({ success: false, error: '请提供视频链接' });
        }
        
        // 获取用户cookies（如果已登录）
        let cookies = null;
        const sessionId = req.cookies?.bili_session;
        if (sessionId && loginSessions.has(sessionId)) {
            cookies = loginSessions.get(sessionId).cookies;
        }
        
        console.log('B站视频（无音频）下载请求:', { url, qn, hasLogin: !!cookies });
        
        // 使用bilibiliService下载视频（无音频）
        await bilibiliService.downloadVideoOnly(url, parseInt(qn), cookies, res);
        
    } catch (error) {
        console.error('B站视频（无音频）下载错误:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

// 获取视频/音频直接下载链接
app.get('/api/bilibili/direct-links', async (req, res) => {
    try {
        const { url, qn = 80 } = req.query;
        
        if (!url) {
            return res.status(400).json({ success: false, error: '请提供视频链接' });
        }
        
        // 获取用户cookies（如果已登录）
        let cookies = null;
        const sessionId = req.cookies?.bili_session;
        if (sessionId && loginSessions.has(sessionId)) {
            cookies = loginSessions.get(sessionId).cookies;
        }
        
        console.log('获取B站直接链接:', { url, qn, hasLogin: !!cookies });
        
        const links = await bilibiliService.getDirectLinks(url, parseInt(qn), cookies);
        res.json({ success: true, data: links });
        
    } catch (error) {
        console.error('获取直接链接错误:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 流式代理下载（单独视频或音频，不合并）
app.get('/api/bilibili/stream', async (req, res) => {
    try {
        const { url, qn = 80, type = 'video' } = req.query;
        
        if (!url) {
            return res.status(400).json({ success: false, error: '请提供视频链接' });
        }
        
        // 获取用户cookies（如果已登录）
        let cookies = null;
        const sessionId = req.cookies?.bili_session;
        if (sessionId && loginSessions.has(sessionId)) {
            cookies = loginSessions.get(sessionId).cookies;
        }
        
        console.log('流式代理下载:', { url, qn, type, hasLogin: !!cookies });
        
        // 获取直接链接
        const links = await bilibiliService.getDirectLinks(url, parseInt(qn), cookies);
        
        const targetUrl = type === 'audio' ? links.audioUrl : links.videoUrl;
        if (!targetUrl) {
            return res.status(400).json({ success: false, error: `无法获取${type === 'audio' ? '音频' : '视频'}链接` });
        }
        
        const ext = type === 'audio' ? 'm4a' : 'm4s';
        const filename = `${links.title}_${type}.${ext}`;
        
        await bilibiliService.streamProxy(targetUrl, res, filename);
        
    } catch (error) {
        console.error('流式代理下载错误:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
});

// ==================== 视频解析 ====================

app.post('/api/parse', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: '请提供视频链接'
            });
        }

        if (!isValidUrl(url)) {
            return res.status(400).json({
                success: false,
                error: '无效的视频链接'
            });
        }

        // 获取用户登录信息（如果是B站视频）
        let cookies = null;
        const sessionId = req.cookies?.bili_session;
        if (sessionId && loginSessions.has(sessionId)) {
            cookies = loginSessions.get(sessionId).cookies;
        }

        // 解析视频（优先使用多平台服务）
        let result;
        if (url.includes('bilibili.com') || url.includes('b23.tv')) {
            // B站视频，使用专门的B站服务（支持登录）
            if (cookies) {
                result = await bilibiliService.parseVideo(url, cookies);
            } else {
                result = await bilibiliService.parseVideo(url);
            }
            result.platform = 'B站';
        } else {
            // 其他平台，使用多平台解析服务（优先yt-dlp，备用API）
            try {
                result = await multiPlatformService.parseVideo(url);
            } catch (multiError) {
                // 如果多平台服务失败，尝试使用旧的videoParser作为备用
                console.log('多平台服务失败，尝试备用解析器:', multiError.message);
                try {
                    result = await videoParser.parse(url);
                } catch (backupError) {
                    throw new Error(`视频解析失败: ${multiError.message}`);
                }
            }
        }
        
        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('解析错误:', error);
        res.status(500).json({
            success: false,
            error: error.message || '解析失败，请稍后重试'
        });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// 获取支持的平台列表
app.get('/api/platforms', (req, res) => {
    try {
        const platforms = multiPlatformService.getSupportedPlatforms();
        res.json({
            success: true,
            platforms: platforms
        });
    } catch (error) {
        // 备用：使用旧的videoParser
        res.json({
            success: true,
            platforms: videoParser.getSupportedPlatforms()
        });
    }
});

// 检查 yt-dlp 是否可用
app.get('/api/ytdlp/check', async (req, res) => {
    try {
        const check = await ytdlpService.checkAvailable();
        res.json({
            success: true,
            available: check.available,
            version: check.version || null,
            command: check.command || null,
            ffmpegAvailable: check.ffmpegAvailable || false,
            error: check.error || null
        });
    } catch (error) {
        res.json({
            success: false,
            available: false,
            error: error.message
        });
    }
});

// 使用 yt-dlp 获取视频信息
app.post('/api/ytdlp/info', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: '请提供视频链接'
            });
        }

        const info = await ytdlpService.getVideoInfo(url);
        
        res.json({
            success: true,
            data: {
                title: info.title,
                author: info.uploader || info.channel || '未知',
                duration: info.duration ? ytdlpService.formatDuration(info.duration) : '00:00',
                thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || '',
                formats: info.formats || []
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 使用 yt-dlp 下载视频
app.get('/api/ytdlp/download', async (req, res) => {
    try {
        let { url, format = 'best' } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: '请提供视频链接'
            });
        }

        if (!isValidUrl(url)) {
            return res.status(400).json({
                success: false,
                error: '无效的视频链接'
            });
        }

        console.log('使用 yt-dlp 下载视频:', url, '格式:', format);

        // 检测是否是 B站链接
        const isBilibili = url.includes('bilibili.com') || url.includes('b23.tv');
        
        if (isBilibili) {
            // B站视频使用专用下载方法
            console.log('检测到 B站链接，使用专用下载方法...');
            try {
                await bilibiliService.downloadAndMerge(url, res);
                return;
            } catch (biliError) {
                console.error('B站专用下载失败:', biliError.message);
                console.log('尝试使用 yt-dlp 作为备用...');
            }
        }

        // 检查 yt-dlp 是否可用
        const check = await ytdlpService.checkAvailable();
        if (!check.available) {
            return res.status(503).json({
                success: false,
                error: '服务器未配置此下载功能。请使用普通下载按钮或联系管理员。'
            });
        }

        // 下载并流式传输
        await ytdlpService.downloadVideoStream(url, format, res);

    } catch (error) {
        console.error('yt-dlp 下载错误:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message || '下载失败，请稍后重试'
            });
        }
    }
});

// 图片代理（解决防盗链问题）
app.get('/api/proxy/image', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).send('Missing url parameter');
        }
        
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.bilibili.com/',
                'Accept': 'image/*,*/*'
            }
        });
        
        res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        response.data.pipe(res);
        
    } catch (error) {
        console.error('图片代理错误:', error.message);
        res.status(500).send('Failed to load image');
    }
});

// 视频下载代理
app.get('/api/download', async (req, res) => {
    try {
        const { url, filename } = req.query;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: '请提供视频链接'
            });
        }

        if (!isValidUrl(url)) {
            return res.status(400).json({
                success: false,
                error: '无效的视频链接'
            });
        }

        console.log('开始下载视频:', url);

        const videoFilename = filename || `video_${Date.now()}.mp4`;
        
        const isBilibiliCdn = url.includes('bilivideo.') || 
                             url.includes('akamaized.net') || 
                             url.includes('bilibili.com') ||
                             url.includes('hdslb.com');
        const referer = isBilibiliCdn ? 'https://www.bilibili.com/' : new URL(url).origin;
        
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 300000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Referer': referer,
                'Origin': isBilibiliCdn ? 'https://www.bilibili.com' : undefined
            }
        });

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(videoFilename)}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
        
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        response.data.pipe(res);

    } catch (error) {
        console.error('下载错误:', error.message);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: error.message || '下载失败'
            });
        }
    }
});

// 所有其他路由返回前端页面
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 验证 URL
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// 启动服务器
app.listen(PORT, () => {
    console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
    console.log(`📱 API 端点: http://localhost:${PORT}/api/parse`);
    console.log(`🔐 管理员密钥: ${ADMIN_KEY}`);
});

// 错误处理
process.on('unhandledRejection', (err) => {
    console.error('未处理的 Promise 拒绝:', err);
});

process.on('uncaughtException', (err) => {
    console.error('未捕获的异常:', err);
    process.exit(1);
});
