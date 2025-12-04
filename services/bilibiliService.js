const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const ytdlpService = require('./ytdlpService');

const execAsync = promisify(exec);

/**
 * B站视频解析服务
 * 实现 WBI 签名机制，支持扫码登录和多画质下载
 */
class BilibiliService {
    constructor() {
        // 下载目录（使用系统临时目录）
        this.downloadDir = path.join(os.tmpdir(), 'bilibili-downloads');
        this.ensureDownloadDir();
        
        // WBI 签名所需的混淆表
        this.mixinKeyEncTab = [
            46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35,
            27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13,
            37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4,
            22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34, 44, 52
        ];
        
        // 缓存 WBI keys
        this.wbiKeys = null;
        this.wbiKeysExpire = 0;
        
        // 通用请求头（模拟真实Chrome浏览器）
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
            'Referer': 'https://www.bilibili.com/',
            'Origin': 'https://www.bilibili.com',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Microsoft Edge";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"'
        };
        
        // 移动端请求头（模拟真实移动浏览器）
        this.mobileHeaders = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Referer': 'https://m.bilibili.com/',
            'Origin': 'https://m.bilibili.com',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120"',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Ch-Ua-Platform': '"Android"'
        };
        
        // 生成基础Cookie（提升未登录用户画质到1080P）
        this.baseCookie = this.generateBaseCookie();
    }
    
    /**
     * 根据请求判断是否使用移动端请求头
     */
    getHeaders(userAgent = null) {
        // 如果提供了UA，检测是否为移动端
        if (userAgent) {
            const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
            return isMobile ? this.mobileHeaders : this.headers;
        }
        return this.headers;
    }
    
    /**
     * 生成基础Cookie（参考GitHub开源项目，模拟真实浏览器获取高画质）
     */
    generateBaseCookie() {
        const buvid3 = this.generateBuvid3();
        const buvid4 = this.generateBuvid4();
        const b_nut = Date.now();
        const uuid = this.generateUUID();
        const sid = this.generateSid();
        // 完整的Cookie组合（参考BBDown等开源项目）
        return [
            `buvid3=${buvid3}`,
            `buvid4=${buvid4}`,
            `b_nut=${b_nut}`,
            `_uuid=${uuid}`,
            `buvid_fp=${this.generateBuvidFp()}`,
            `SESSDATA=`,  // 空值但保留字段
            `bili_jct=`,  // 空值但保留字段
            `DedeUserID=`, // 空值但保留字段
            `DedeUserID__ckMd5=`, // 空值但保留字段
            `sid=${sid}`,
            `CURRENT_QUALITY=120`,  // 设置为最高画质（4K），提升画质上限
            `CURRENT_FNVAL=4048`,   // DASH格式，支持音视频分离
            `innersign=0`,
            `b_lsid=${this.generateBLsid()}`,
            `i-wanna-go-back=-1`,
            `browser_resolution=1920-1080`,
            `PVID=1`
        ].join('; ');
    }
    
    /**
     * 生成sid（会话ID）
     */
    generateSid() {
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < 16; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    /**
     * 生成buvid4
     */
    generateBuvid4() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    /**
     * 生成buvid_fp
     */
    generateBuvidFp() {
        const chars = '0123456789abcdef';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    /**
     * 生成b_lsid
     */
    generateBLsid() {
        const chars = '0123456789ABCDEF';
        let part1 = '';
        let part2 = '';
        for (let i = 0; i < 8; i++) {
            part1 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        for (let i = 0; i < 8; i++) {
            part2 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `${part1}_${Date.now().toString(16).toUpperCase()}`;
    }
    
    /**
     * 生成buvid3
     */
    generateBuvid3() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 35; i++) {
            if (i === 8 || i === 13 || i === 18 || i === 23) {
                result += '-';
            } else {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }
        return result + 'infoc';
    }
    
    /**
     * 生成UUID
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16).toUpperCase();
        }) + 'infoc';
    }

    /**
     * 获取 WBI keys（优化：减少超时+使用基础Cookie）
     */
    async getWbiKeys(cookies = null) {
        const now = Date.now();
        
        // 延长缓存时间到2小时
        if (this.wbiKeys && now < this.wbiKeysExpire) {
            return this.wbiKeys;
        }

        try {
            const cookieStr = cookies ? this.formatCookies(cookies) : this.baseCookie;
            const headers = { 
                ...this.headers,
                'Cookie': cookieStr
            };
            
            const response = await axios.get('https://api.bilibili.com/x/web-interface/nav', {
                headers,
                timeout: 10000 // 减少到10秒
            });

            if (response.data && response.data.code === 0) {
                const { img_url, sub_url } = response.data.data.wbi_img;
                const imgKey = img_url.split('/').pop().split('.')[0];
                const subKey = sub_url.split('/').pop().split('.')[0];
                
                this.wbiKeys = { imgKey, subKey };
                this.wbiKeysExpire = now + 2 * 60 * 60 * 1000; // 缓存2小时
                
                return this.wbiKeys;
            }
        } catch (error) {
            console.log('获取 WBI keys 失败:', error.message);
            // 使用备用的硬编码keys（不常变化）
            return this.getFallbackWbiKeys();
        }
        
        return this.getFallbackWbiKeys();
    }
    
    /**
     * 获取备用WBI keys（当API失败时使用）
     */
    getFallbackWbiKeys() {
        // B站WBI keys不常变化，可以使用固定值作为备用
        return {
            imgKey: '7cd084941338484aae1ad9425b84077c',
            subKey: '4932caff0ff746eab6f01bf08b70ac45'
        };
    }

    /**
     * 格式化 cookies 对象为字符串
     */
    formatCookies(cookies) {
        if (typeof cookies === 'string') return cookies;
        return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    }

    /**
     * 获取混淆后的 key
     */
    getMixinKey(orig) {
        let temp = '';
        for (let i = 0; i < this.mixinKeyEncTab.length; i++) {
            temp += orig[this.mixinKeyEncTab[i]];
        }
        return temp.slice(0, 32);
    }

    /**
     * 对参数进行 WBI 签名
     */
    async encWbi(params, cookies = null) {
        const wbiKeys = await this.getWbiKeys(cookies);
        if (!wbiKeys) {
            return params;
        }

        const { imgKey, subKey } = wbiKeys;
        const mixinKey = this.getMixinKey(imgKey + subKey);
        
        const currTime = Math.round(Date.now() / 1000);
        const newParams = { ...params, wts: currTime };
        
        const keys = Object.keys(newParams).sort();
        const query = keys.map(key => {
            const value = String(newParams[key]).replace(/[!'()*]/g, '');
            return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
        }).join('&');
        
        const wRid = crypto.createHash('md5').update(query + mixinKey).digest('hex');
        
        return { ...newParams, w_rid: wRid };
    }

    /**
     * 从 URL 提取视频 ID
     */
    extractVideoId(url) {
        const bvMatch = url.match(/BV([a-zA-Z0-9]+)/i);
        const avMatch = url.match(/av(\d+)/i);
        
        if (bvMatch) return { bvid: `BV${bvMatch[1]}` };
        if (avMatch) return { aid: avMatch[1] };
        return null;
    }

    /**
     * 获取视频信息（优化：减少超时时间提升速度）
     */
    async getVideoInfo(url, cookies = null) {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            throw new Error('无法从链接中提取视频ID');
        }

        const params = videoId.bvid 
            ? { bvid: videoId.bvid }
            : { aid: videoId.aid };

        // 使用基础Cookie或用户Cookie
        const cookieStr = cookies ? this.formatCookies(cookies) : this.baseCookie;
        const signedParams = await this.encWbi(params, cookies);
        
        const headers = { 
            ...this.headers,
            'Cookie': cookieStr
        };
        
        const apiUrl = `https://api.bilibili.com/x/web-interface/view?${new URLSearchParams(signedParams)}`;
        
        const response = await axios.get(apiUrl, {
            headers,
            timeout: 15000 // 减少到15秒提升速度
        });

        if (response.data && response.data.code === 0) {
            return response.data.data;
        }
        
        throw new Error(`获取视频信息失败: ${response.data?.message || '未知错误'}`);
    }

    /**
     * 获取视频播放地址（优化：多重尝试获取最高画质）
     */
    async getPlayUrl(bvid, cid, qn = 80, cookies = null) {
        // 使用基础Cookie或用户Cookie
        const cookieStr = cookies ? this.formatCookies(cookies) : this.baseCookie;
        
        // 尝试多个API获取最高画质
        const apis = [
            // 标准WBI API
            {
                url: 'https://api.bilibili.com/x/player/wbi/playurl',
                needSign: true
            },
            // 旧版API（有时能获取更高画质）
            {
                url: 'https://api.bilibili.com/x/player/playurl',
                needSign: false
            }
        ];
        
        // 只请求一次最高画质（120），API会自动返回可用画质列表
        for (const api of apis) {
            try {
                const params = {
                    bvid: bvid,
                    cid: cid,
                    qn: 120,  // 请求最高画质，API会返回所有可用画质
                    fnval: 4048,  // DASH格式 (支持音视频分离)
                    fnver: 0,
                    fourk: 1,
                    platform: 'pc',
                    high_quality: 1,
                    build: 6060600,
                    device: 'pc',
                    mobi_app: 'pc',
                    try_look: 1,  // 关键参数：允许试看，可以获取更高画质（包括1080P）
                    ts: Math.floor(Date.now() / 1000)
                };
                
                const finalParams = api.needSign ? await this.encWbi(params, cookies) : params;
                
                const headers = { 
                    ...this.headers,
                    'Cookie': cookieStr,
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7'
                };
                
                const apiUrl = `${api.url}?${new URLSearchParams(finalParams)}`;
                
                const response = await axios.get(apiUrl, {
                    headers,
                    timeout: 8000
                });

                if (response.data && response.data.code === 0) {
                    const data = response.data.data;
                    if (data.dash && data.dash.video && data.dash.video.length > 0) {
                        const maxQuality = Math.max(...data.dash.video.map(v => v.id));
                        console.log(`API ${api.url.split('/').pop()} 返回最高画质: ${maxQuality}`);
                        // 返回数据，让调用方决定使用哪个画质
                        return data;
                    }
                }
            } catch (error) {
                console.log(`API ${api.url} 失败:`, error.message);
            }
        }
        
        // 如果都失败，使用标准API的结果
        const params = {
            bvid: bvid,
            cid: cid,
            qn: qn,
            fnval: 4048,
            fnver: 0,
            fourk: 1,
            platform: 'pc',
            try_look: 1  // 允许试看，获取更高画质
        };
        
        const signedParams = await this.encWbi(params, cookies);
        const headers = { 
            ...this.headers,
            'Cookie': cookieStr
        };
        
        const response = await axios.get(`https://api.bilibili.com/x/player/wbi/playurl?${new URLSearchParams(signedParams)}`, {
            headers,
            timeout: 10000
        });

        if (response.data && response.data.code === 0) {
            return response.data.data;
        }
        
        throw new Error(`获取播放地址失败: ${response.data?.message || '未知错误'}`);
    }

    /**
     * 解析视频（主方法）
     */
    async parseVideo(url, cookies = null) {
        try {
            const videoInfo = await this.getVideoInfo(url, cookies);
            
            const bvid = videoInfo.bvid;
            const cid = videoInfo.pages?.[0]?.cid || videoInfo.cid;
            
            if (!cid) {
                throw new Error('无法获取视频 CID');
            }

            let playData = null;
            let downloadLinks = [];
            
            try {
                playData = await this.getPlayUrl(bvid, cid, 120, cookies);
                
                if (playData && playData.dash) {
                    const videos = playData.dash.video || [];
                    const audios = playData.dash.audio || [];
                    
                    const qualityMap = new Map();
                    videos.forEach(video => {
                        const qn = video.id;
                        if (!qualityMap.has(qn) || video.bandwidth > qualityMap.get(qn).video.bandwidth) {
                            qualityMap.set(qn, {
                                video: video,
                                qualityName: this.getQualityName(qn),
                                needVip: qn > 80
                            });
                        }
                    });
                    
                    const bestAudio = audios.length > 0 ? audios[0] : null;
                    
                    qualityMap.forEach((info, qn) => {
                        downloadLinks.push({
                            quality: info.qualityName,
                            qn: qn,
                            needVip: info.needVip,
                            url: url,
                            needYtdlp: true
                        });
                    });
                    
                    downloadLinks.sort((a, b) => b.qn - a.qn);
                }
            } catch (playError) {
                console.log('获取播放地址失败:', playError.message);
            }

            // 定义所有可能的画质选项
            const allQualities = [
                { quality: '4K 超清', qn: 120, needVip: true },
                { quality: '1080P 60帧', qn: 116, needVip: true },
                { quality: '1080P 高码率', qn: 112, needVip: true },
                { quality: '1080P', qn: 80, needVip: false },
                { quality: '720P', qn: 64, needVip: false },
                { quality: '480P', qn: 32, needVip: false },
                { quality: '360P', qn: 16, needVip: false }
            ];
            
            // 获取API实际返回的画质qn列表
            const existingQns = new Set(downloadLinks.map(link => link.qn));
            
            // 如果API没有返回任何画质，免费画质默认可用，VIP画质不可用
            if (downloadLinks.length === 0) {
                downloadLinks = allQualities.map(q => ({
                    ...q,
                    url: url,
                    needYtdlp: true,
                    exists: !q.needVip // 免费画质(1080P及以下)默认可用
                }));
            } else {
                // 找出API返回的最高画质
                const maxExistingQn = Math.max(...existingQns);
                
                // 补充所有可能的画质选项，标记最高可用画质
                const finalLinks = [];
                allQualities.forEach(quality => {
                    const exists = existingQns.has(quality.qn) || quality.qn <= maxExistingQn;
                    finalLinks.push({
                        quality: quality.quality,
                        qn: quality.qn,
                        needVip: quality.needVip,
                        url: url,
                        needYtdlp: true,
                        exists: exists,
                        maxQuality: maxExistingQn // 标记视频支持的最高画质
                    });
                });
                downloadLinks = finalLinks;
                downloadLinks.sort((a, b) => b.qn - a.qn);
            }

            return {
                title: videoInfo.title || 'B站视频',
                author: videoInfo.owner?.name || '未知UP主',
                duration: this.formatDuration(videoInfo.duration),
                thumbnail: videoInfo.pic || '',
                platform: 'B站',
                videoUrl: url,
                downloadLinks: downloadLinks,
                bvid: bvid,
                cid: cid
            };
            
        } catch (error) {
            throw new Error(`B站视频解析失败: ${error.message}`);
        }
    }

    /**
     * 使用 yt-dlp 下载（已废弃 - 总是遇到412错误）
     * 保留方法签名以防旧代码调用，但不再实现
     */
    async downloadWithYtdlp_DEPRECATED(url, qn = 80, res, format = 'mp4', nameFormat = 'title') {
        try {
            // 获取视频信息用于生成文件名
            const videoInfo = await this.getVideoInfo(url, null);
            const title = (videoInfo.title || 'video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
            const author = (videoInfo.owner?.name || 'UP主').replace(/[<>:"/\\|?*]/g, '_').substring(0, 20);
            
            // 根据命名格式生成文件名
            let baseName;
            switch (nameFormat) {
                case 'title-author':
                    baseName = `${title} - ${author}`;
                    break;
                case 'author-title':
                    baseName = `${author} - ${title}`;
                    break;
                default:
                    baseName = title;
            }
            
            // 画质映射到yt-dlp格式选择器
            const qualityMap = {
                120: 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',  // 4K
                116: 'bestvideo[height<=1080][fps>30]+bestaudio/best[height<=1080][fps>30]',  // 1080P60
                112: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',  // 1080P+
                80: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',   // 1080P
                64: 'bestvideo[height<=720]+bestaudio/best[height<=720]',      // 720P
                32: 'bestvideo[height<=480]+bestaudio/best[height<=480]',      // 480P
                16: 'bestvideo[height<=360]+bestaudio/best[height<=360]'       // 360P
            };
            
            const formatSelector = qualityMap[qn] || qualityMap[80];
            
            // 画质名称（用于文件名）
            const qNameMap = {
                120: '4K', 116: '1080P60', 112: '1080P+', 80: '1080P', 
                64: '720P', 32: '480P', 16: '360P'
            };
            const qualityName = qNameMap[qn] || '1080P';
            const finalName = `${qualityName}_${baseName}`;
            
            console.log(`yt-dlp 下载: 画质=${qn}, 格式选择器=${formatSelector}`);
            
            // 注意：延迟设置响应头，等确认yt-dlp成功后再设置，以便失败时可以回退
            
            // 构建yt-dlp命令（添加Cookie和User-Agent绕过412错误）
            const check = await ytdlpService.checkAvailable();
            const userAgent = this.headers['User-Agent'];
            const referer = this.headers['Referer'];
            
            const args = [
                '-f', formatSelector,
                '--merge-output-format', format,
                '--no-playlist',
                '--add-header', `User-Agent: ${userAgent}`,
                '--add-header', `Referer: ${referer}`,
                '--add-header', `Cookie: ${this.baseCookie}`,
                '--add-header', 'Accept: */*',
                '--add-header', 'Accept-Language: zh-CN,zh;q=0.9',
                '--add-header', 'Accept-Encoding: gzip, deflate, br',
                '--no-warnings',
                '--newline',  // 每行输出一个进度信息，便于捕获错误
                '-o', '-',  // 输出到stdout
                url
            ];
            
            const ytdlp = spawn(check.command, args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });
            
            // 收集错误信息
            let errorOutput = '';
            let hasError = false;
            let headersSet = false;
            let startTime = Date.now();
            
            // 使用Promise包装以便捕获错误
            return new Promise((resolve, reject) => {
                // 监听错误输出，如果5秒后还没开始下载且有错误，则回退
                const errorTimeout = setTimeout(() => {
                    if (!headersSet && errorOutput.length > 0) {
                        console.log(`yt-dlp 5秒内未开始下载，错误信息: ${errorOutput.substring(0, 300)}`);
                        // 检查是否是 412 或其他 HTTP 错误
                        if (errorOutput.includes('412') || 
                            errorOutput.includes('Precondition Failed') ||
                            errorOutput.includes('HTTP Error 403') ||
                            errorOutput.includes('Unable to download')) {
                            console.log('yt-dlp 遇到访问错误，回退到原生API');
                            ytdlp.kill();
                            reject(new Error('YTDLP_412_ERROR'));
                        }
                    }
                }, 5000);
                
                // 错误处理（在pipe之前监听）
                ytdlp.stderr.on('data', (data) => {
                    const msg = data.toString();
                    errorOutput += msg;
                    
                    // 立即检测关键错误
                    const is412Error = msg.includes('412') || msg.includes('Precondition Failed');
                    const is403Error = msg.includes('HTTP Error 403');
                    const isAccessError = msg.includes('Unable to download');
                    
                    if (is412Error || is403Error || isAccessError) {
                        hasError = true;
                        const errorType = is412Error ? '412' : is403Error ? '403' : 'Access';
                        console.error(`yt-dlp 遇到${errorType}错误:`, msg.trim());
                        clearTimeout(errorTimeout);
                        ytdlp.kill();
                        
                        // 如果还没设置响应头，可以安全回退
                        if (!headersSet) {
                            console.log(`检测到${errorType}错误，回退到原生API`);
                            reject(new Error('YTDLP_412_ERROR'));
                        } else {
                            // 已经设置了响应头，无法回退
                            console.error('响应头已发送，无法回退到原生API');
                            reject(new Error('YTDLP_ALREADY_STARTED'));
                        }
                        return;
                    }
                    
                    // 记录所有输出以便调试
                    const trimmedMsg = msg.trim();
                    if (trimmedMsg && 
                        !trimmedMsg.includes('Deprecated') && 
                        !trimmedMsg.includes('[download]') &&
                        !trimmedMsg.includes('ETA')) {
                        console.log('yt-dlp stderr:', trimmedMsg);
                    }
                });
                
                ytdlp.on('error', (error) => {
                    clearTimeout(errorTimeout);
                    console.error('yt-dlp 执行错误:', error);
                    hasError = true;
                    reject(error);
                });
                
                // 成功开始输出后设置响应头并pipe
                ytdlp.stdout.once('data', (firstChunk) => {
                    clearTimeout(errorTimeout);
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                    console.log(`yt-dlp 成功开始输出数据 (耗时: ${elapsed}秒, 首块大小: ${firstChunk.length} bytes)`);
                    
                    // 确认成功开始后设置响应头
                    if (!headersSet && !res.headersSent) {
                        res.setHeader('Content-Type', 'video/mp4');
                        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalName)}.${format}"`);
                        res.setHeader('Transfer-Encoding', 'chunked');
                        headersSet = true;
                        console.log(`设置响应头: ${finalName}.${format}`);
                    }
                    
                    // 发送第一个数据块
                    if (headersSet) {
                        res.write(firstChunk);
                        // 将后续输出pipe到响应
                        ytdlp.stdout.pipe(res, { end: false });
                        
                        let totalBytes = firstChunk.length;
                        ytdlp.stdout.on('data', (chunk) => {
                            totalBytes += chunk.length;
                        });
                        
                        ytdlp.stdout.on('end', () => {
                            console.log(`yt-dlp 数据流结束，总计: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
                            res.end();
                        });
                    }
                });
                
                ytdlp.on('close', (code) => {
                    clearTimeout(errorTimeout);
                    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
                    
                    if (code !== 0 || hasError) {
                        console.error(`yt-dlp 进程结束，退出码: ${code}, 耗时: ${totalTime}秒`);
                        console.error(`错误输出: ${errorOutput.substring(0, 500)}`);
                        
                        // 检查是否是可以回退的错误
                        const canFallback = (
                            errorOutput.includes('412') || 
                            errorOutput.includes('Precondition Failed') ||
                            errorOutput.includes('HTTP Error 403') ||
                            errorOutput.includes('Unable to download')
                        ) && !headersSet;
                        
                        if (canFallback) {
                            console.log('yt-dlp 遇到访问错误且未开始传输，回退到原生API');
                            reject(new Error('YTDLP_412_ERROR'));
                            return;
                        }
                        
                        if (!headersSet && !res.headersSent) {
                            res.status(500).json({ 
                                success: false, 
                                error: `yt-dlp 下载失败: ${errorOutput.substring(0, 200)}` 
                            });
                        }
                        reject(new Error(`yt-dlp 下载失败，退出码: ${code}`));
                    } else {
                        console.log(`yt-dlp 下载成功完成，总耗时: ${totalTime}秒`);
                        if (!headersSet && !res.headersSent) {
                            res.setHeader('Content-Type', 'video/mp4');
                            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalName)}.${format}"`);
                        }
                        resolve();
                    }
                });
                
                // 处理客户端断开连接
                res.on('close', () => {
                    clearTimeout(errorTimeout);
                    if (!ytdlp.killed) {
                        ytdlp.kill();
                    }
                });
            });
            
        } catch (error) {
            // 如果是412错误，重新抛出以便上层处理
            if (error.message === 'YTDLP_412_ERROR') {
                throw error;
            }
            console.error('yt-dlp 下载失败:', error);
            throw error;
        }
    }

    /**
     * 带画质选择的下载方法（流式传输到浏览器）
     * @param {string} url - 视频URL
     * @param {number} qn - 画质
     * @param {object} cookies - 登录cookies
     * @param {object} res - Express响应对象
     * @param {string} format - 输出格式 (mp4, flv, mkv, webm)
     */
    async downloadWithQuality(url, qn = 80, cookies = null, res, format = 'mp4', nameFormat = 'title') {
        try {
            console.log('开始下载 B站视频:', { url, qn, nameFormat, hasLogin: !!cookies });
            
            // 检查响应头是否已发送（防止重复设置）
            if (res.headersSent) {
                console.error('响应头已发送，无法继续下载');
                throw new Error('响应头已发送，无法继续下载');
            }
            
            // 直接使用原生API下载（yt-dlp已废弃，总是遇到412错误）
            console.log('使用原生API下载');
            
            // 获取视频信息
            const videoInfo = await this.getVideoInfo(url, cookies);
            const bvid = videoInfo.bvid;
            const cid = videoInfo.pages?.[0]?.cid || videoInfo.cid;
            
            if (!cid) {
                throw new Error('无法获取视频 CID');
            }
            
            // 获取播放地址
            const playData = await this.getPlayUrl(bvid, cid, qn, cookies);
            
            if (!playData || !playData.dash) {
                throw new Error('无法获取视频流信息');
            }
            
            const { video: videos, audio: audios } = playData.dash;
            
            // 选择对应画质的视频流（优先精确匹配，否则自动降级）
            let selectedVideo = videos.find(v => v.id === qn);
            if (!selectedVideo) {
                // 选择小于等于请求画质的最高画质（自动降级）
                const lowerQualities = videos.filter(v => v.id <= qn);
                if (lowerQualities.length > 0) {
                    selectedVideo = lowerQualities.reduce((prev, curr) => curr.id > prev.id ? curr : prev);
                } else {
                    // 如果没有更低的画质，选择最低的可用画质
                    selectedVideo = videos.reduce((prev, curr) => curr.id < prev.id ? curr : prev);
                }
                console.log(`请求画质 ${qn} 不可用，自动降级到 ${selectedVideo.id}`);
            }
            
            const selectedAudio = audios && audios.length > 0 ? audios[0] : null;
            
            const videoUrl = selectedVideo.baseUrl || selectedVideo.base_url;
            const audioUrl = selectedAudio ? (selectedAudio.baseUrl || selectedAudio.base_url) : null;
            
            // 实际下载的画质名称
            const actualQn = selectedVideo.id;
            const qualityName = this.getQualityName(actualQn).replace(/\s+/g, '');
            
            // 根据命名格式生成文件名（画质在第一位）
            const timestamp = Date.now();
            const title = (videoInfo.title || 'video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
            const author = (videoInfo.owner?.name || 'UP主').replace(/[<>:"/\\|?*]/g, '_').substring(0, 20);
            
            let baseName;
            switch (nameFormat) {
                case 'title-author':
                    baseName = `${title} - ${author}`;
                    break;
                case 'author-title':
                    baseName = `${author} - ${title}`;
                    break;
                default: // 'title'
                    baseName = title;
            }
            const finalTitle = `${qualityName}_${baseName}`;
            const videoFile = path.join(this.downloadDir, `${timestamp}_video.m4s`);
            const audioFile = path.join(this.downloadDir, `${timestamp}_audio.m4s`);
            const outputFile = path.join(this.downloadDir, `${finalTitle}.${format}`);
            
            // 下载视频流
            console.log('下载视频流...');
            await this.downloadFile(videoUrl, videoFile);
            
            if (audioUrl) {
                // 下载音频流
                console.log('下载音频流...');
                await this.downloadFile(audioUrl, audioFile);
                
                // 检查 ffmpeg 并合并
                const hasFfmpeg = await this.checkFfmpeg();
                console.log('FFmpeg 可用:', hasFfmpeg);
                
                if (hasFfmpeg) {
                    console.log(`合并音视频并转换为 ${format} 格式...`);
                    await this.mergeVideoAudio(videoFile, audioFile, outputFile, format);
                    
                    // 清理临时文件
                    try {
                        fs.unlinkSync(videoFile);
                        fs.unlinkSync(audioFile);
                    } catch (e) {}
                    
                    // 发送合并后的文件（检查响应头是否已设置）
                    if (res.headersSent) {
                        console.error('响应头已发送，无法继续下载');
                        throw new Error('响应头已发送');
                    }
                    const stats = fs.statSync(outputFile);
                    const contentType = this.getContentType(format);
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Length', stats.size);
                    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(finalTitle)}.${format}"`);
                    
                    const fileStream = fs.createReadStream(outputFile);
                    fileStream.pipe(res);
                    
                    fileStream.on('end', () => {
                        // 清理输出文件
                        setTimeout(() => {
                            try { fs.unlinkSync(outputFile); } catch (e) {}
                        }, 5000);
                    });
                    
                    return;
                }
            }
            
            // 如果没有音频或没有 ffmpeg，只发送视频（⚠️ 会导致没有声音）
            console.log('⚠️ 警告: FFmpeg不可用或无音频，将只返回视频流（无声音）');
            // 如果指定了格式且不是 m4s，尝试转换
            if (format !== 'm4s' && format !== 'mp4') {
                const hasFfmpeg = await this.checkFfmpeg();
                if (hasFfmpeg) {
                    const convertedFile = path.join(this.downloadDir, `${safeTitle}.${format}`);
                    await this.convertVideoFormat(videoFile, convertedFile, format);
                    if (res.headersSent) {
                        throw new Error('响应头已发送');
                    }
                    const stats = fs.statSync(convertedFile);
                    const contentType = this.getContentType(format);
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Length', stats.size);
                    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.${format}"`);
                    const fileStream = fs.createReadStream(convertedFile);
                    fileStream.pipe(res);
                    fileStream.on('end', () => {
                        setTimeout(() => {
                            try { fs.unlinkSync(convertedFile); fs.unlinkSync(videoFile); } catch (e) {}
                        }, 5000);
                    });
                    return;
                }
            }
            
            if (res.headersSent) {
                throw new Error('响应头已发送');
            }
            const stats = fs.statSync(videoFile);
            const contentType = format === 'm4s' ? 'video/mp4' : this.getContentType(format);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', stats.size);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.${format === 'm4s' ? 'mp4' : format}"`);
            
            const fileStream = fs.createReadStream(videoFile);
            fileStream.pipe(res);
            
            fileStream.on('end', () => {
                setTimeout(() => {
                    try { fs.unlinkSync(videoFile); } catch (e) {}
                }, 5000);
            });
            
        } catch (error) {
            console.error('B站下载失败:', error);
            throw error;
        }
    }

    /**
     * 下载并合并（兼容旧方法）
     */
    async downloadAndMerge(url, res) {
        return this.downloadWithQuality(url, 80, null, res);
    }

    /**
     * 获取清晰度名称
     */
    getQualityName(qn) {
        const qualityMap = {
            127: '8K 超高清',
            126: '杜比视界',
            125: 'HDR 真彩',
            120: '4K 超清',
            116: '1080P60',
            112: '1080P 高码率',
            80: '1080P',
            74: '720P60',
            64: '720P',
            32: '480P',
            16: '360P'
        };
        return qualityMap[qn] || `清晰度 ${qn}`;
    }

    /**
     * 格式化时长
     */
    formatDuration(seconds) {
        if (!seconds) return '00:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 确保下载目录存在
     */
    ensureDownloadDir() {
        if (!fs.existsSync(this.downloadDir)) {
            fs.mkdirSync(this.downloadDir, { recursive: true });
        }
    }

    /**
     * 下载文件
     */
    async downloadFile(url, outputPath) {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 300000,
            headers: this.headers
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(outputPath));
            writer.on('error', reject);
        });
    }

    /**
     * 检查 ffmpeg 是否可用
     */
    async checkFfmpeg() {
        try {
            await execAsync('ffmpeg -version', { timeout: 5000 });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 使用 ffmpeg 合并视频和音频
     * @param {string} videoPath - 视频文件路径
     * @param {string} audioPath - 音频文件路径
     * @param {string} outputPath - 输出文件路径
     * @param {string} format - 输出格式 (mp4, flv, mkv, webm)
     */
    async mergeVideoAudio(videoPath, audioPath, outputPath, format = 'mp4') {
        return new Promise((resolve, reject) => {
            // 根据格式选择编码器
            const formatConfig = this.getFormatConfig(format);
            
            const args = [
                '-i', videoPath,
                '-i', audioPath,
                '-c:v', formatConfig.videoCodec,
                '-c:a', formatConfig.audioCodec,
                '-y',
                outputPath
            ];

            const ffmpeg = spawn('ffmpeg', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stderr = '';
            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve(outputPath);
                } else {
                    reject(new Error(`ffmpeg 合并失败: ${stderr}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(new Error(`启动 ffmpeg 失败: ${error.message}`));
            });
        });
    }

    /**
     * 下载音频（分离音频流）
     */
    async downloadAudio(url, qn = 80, cookies = null, res) {
        try {
            console.log('开始下载 B站音频:', { url, qn, hasLogin: !!cookies });
            
            // 获取视频信息
            const videoInfo = await this.getVideoInfo(url, cookies);
            const bvid = videoInfo.bvid;
            const cid = videoInfo.pages?.[0]?.cid || videoInfo.cid;
            
            if (!cid) {
                throw new Error('无法获取视频 CID');
            }
            
            // 获取播放地址
            const playData = await this.getPlayUrl(bvid, cid, qn, cookies);
            
            if (!playData || !playData.dash) {
                throw new Error('无法获取音频流信息');
            }
            
            const { audio: audios } = playData.dash;
            
            if (!audios || audios.length === 0) {
                throw new Error('无法获取音频流');
            }
            
            // 选择最佳音频
            const bestAudio = audios[0];
            const audioUrl = bestAudio.baseUrl || bestAudio.base_url;
            
            // 生成文件名
            const safeTitle = (videoInfo.title || 'audio').replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
            const audioFile = path.join(this.downloadDir, `${Date.now()}_audio.m4s`);
            const outputFile = path.join(this.downloadDir, `${safeTitle}.mp3`);
            
            // 下载音频流
            console.log('下载音频流...');
            await this.downloadFile(audioUrl, audioFile);
            
            // 检查 ffmpeg（必须有才能转换为 MP3）
            const hasFfmpeg = await this.checkFfmpeg();
            if (!hasFfmpeg) {
                // 清理临时文件
                try {
                    fs.unlinkSync(audioFile);
                } catch (e) {}
                throw new Error('音频下载需要 ffmpeg 支持，请安装 ffmpeg 后重试');
            }
            
            // 转换音频为 MP3（统一格式）
            console.log('转换音频为 MP3...');
            await this.convertToMp3(audioFile, outputFile);
            
            // 清理临时文件
            try {
                fs.unlinkSync(audioFile);
            } catch (e) {}
            
            // 发送转换后的 MP3 文件
            const stats = fs.statSync(outputFile);
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Length', stats.size);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.mp3"`);
            
            const fileStream = fs.createReadStream(outputFile);
            fileStream.pipe(res);
            
            fileStream.on('end', () => {
                setTimeout(() => {
                    try { fs.unlinkSync(outputFile); } catch (e) {}
                }, 5000);
            });
            
        } catch (error) {
            console.error('B站音频下载失败:', error);
            throw error;
        }
    }

    /**
     * 使用 ffmpeg 转换音频为 MP3
     */
    async convertToMp3(inputPath, outputPath) {
        return new Promise((resolve, reject) => {
            const args = [
                '-i', inputPath,
                '-acodec', 'libmp3lame',
                '-ab', '192k',
                '-y',
                outputPath
            ];

            const ffmpeg = spawn('ffmpeg', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stderr = '';
            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve(outputPath);
                } else {
                    reject(new Error(`ffmpeg 转换失败: ${stderr}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(new Error(`启动 ffmpeg 失败: ${error.message}`));
            });
        });
    }

    /**
     * 下载封面
     */
    async downloadCover(url, res) {
        try {
            console.log('开始下载 B站封面:', { url });
            
            // 获取视频信息
            const videoInfo = await this.getVideoInfo(url);
            
            if (!videoInfo.pic) {
                throw new Error('该视频没有封面');
            }
            
            // 处理封面URL
            let coverUrl = videoInfo.pic;
            if (coverUrl.startsWith('//')) {
                coverUrl = 'https:' + coverUrl;
            }
            
            // 生成文件名
            const safeTitle = (videoInfo.title || 'cover').replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
            
            // 下载封面
            const response = await axios({
                method: 'GET',
                url: coverUrl,
                responseType: 'stream',
                timeout: 30000,
                headers: this.headers
            });
            
            // 设置响应头
            res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
            if (response.headers['content-length']) {
                res.setHeader('Content-Length', response.headers['content-length']);
            }
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.jpg"`);
            
            // 流式传输
            response.data.pipe(res);
            
        } catch (error) {
            console.error('B站封面下载失败:', error);
            throw error;
        }
    }

    /**
     * 下载视频（无音频）
     */
    async downloadVideoOnly(url, qn = 80, cookies = null, res) {
        try {
            console.log('开始下载 B站视频（无音频）:', { url, qn, hasLogin: !!cookies });
            
            // 获取视频信息
            const videoInfo = await this.getVideoInfo(url, cookies);
            const bvid = videoInfo.bvid;
            const cid = videoInfo.pages?.[0]?.cid || videoInfo.cid;
            
            if (!cid) {
                throw new Error('无法获取视频 CID');
            }
            
            // 获取播放地址
            const playData = await this.getPlayUrl(bvid, cid, qn, cookies);
            
            if (!playData || !playData.dash) {
                throw new Error('无法获取视频流信息');
            }
            
            const { video: videos } = playData.dash;
            
            // 选择对应画质的视频流
            let selectedVideo = videos.find(v => v.id === qn);
            if (!selectedVideo) {
                // 如果没有精确匹配，选择最接近的
                selectedVideo = videos.reduce((prev, curr) => {
                    return Math.abs(curr.id - qn) < Math.abs(prev.id - qn) ? curr : prev;
                });
            }
            
            const videoUrl = selectedVideo.baseUrl || selectedVideo.base_url;
            
            // 生成文件名
            const timestamp = Date.now();
            const safeTitle = (videoInfo.title || 'video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
            const videoFile = path.join(this.downloadDir, `${timestamp}_video.m4s`);
            
            // 下载视频流
            console.log('下载视频流（无音频）...');
            await this.downloadFile(videoUrl, videoFile);
            
            // 发送视频文件
            const stats = fs.statSync(videoFile);
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Length', stats.size);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}_video.mp4"`);
            
            const fileStream = fs.createReadStream(videoFile);
            fileStream.pipe(res);
            
            fileStream.on('end', () => {
                setTimeout(() => {
                    try { fs.unlinkSync(videoFile); } catch (e) {}
                }, 5000);
            });
            
        } catch (error) {
            console.error('B站视频（无音频）下载失败:', error);
            throw error;
        }
    }

    /**
     * 获取视频和音频的直接下载链接（用于浏览器直接下载）
     */
    async getDirectLinks(url, qn = 80, cookies = null) {
        try {
            const videoInfo = await this.getVideoInfo(url, cookies);
            const bvid = videoInfo.bvid;
            const cid = videoInfo.pages?.[0]?.cid || videoInfo.cid;
            
            if (!cid) {
                throw new Error('无法获取视频 CID');
            }
            
            const playData = await this.getPlayUrl(bvid, cid, qn, cookies);
            
            if (!playData || !playData.dash) {
                throw new Error('无法获取视频流信息');
            }
            
            const { video: videos, audio: audios } = playData.dash;
            
            // 选择对应画质的视频流
            let selectedVideo = videos.find(v => v.id === qn);
            if (!selectedVideo) {
                selectedVideo = videos.reduce((prev, curr) => {
                    return Math.abs(curr.id - qn) < Math.abs(prev.id - qn) ? curr : prev;
                });
            }
            
            const selectedAudio = audios && audios.length > 0 ? audios[0] : null;
            
            const videoUrl = selectedVideo.baseUrl || selectedVideo.base_url;
            const audioUrl = selectedAudio ? (selectedAudio.baseUrl || selectedAudio.base_url) : null;
            
            const safeTitle = (videoInfo.title || 'video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
            
            return {
                title: safeTitle,
                videoUrl: videoUrl,
                audioUrl: audioUrl,
                quality: this.getQualityName(selectedVideo.id),
                qn: selectedVideo.id,
                thumbnail: videoInfo.pic,
                // 提供直接链接需要的请求头
                headers: {
                    'Referer': 'https://www.bilibili.com/',
                    'User-Agent': this.headers['User-Agent']
                }
            };
        } catch (error) {
            throw new Error(`获取直接链接失败: ${error.message}`);
        }
    }

    /**
     * 获取格式的 MIME 类型
     */
    getContentType(format) {
        const types = {
            'mp4': 'video/mp4',
            'flv': 'video/x-flv',
            'mkv': 'video/x-matroska',
            'webm': 'video/webm',
            'mp3': 'audio/mpeg',
            'flac': 'audio/flac',
            'aac': 'audio/aac',
            'm4a': 'audio/mp4'
        };
        return types[format] || 'video/mp4';
    }

    /**
     * 获取格式的 ffmpeg 编码器配置
     */
    getFormatConfig(format) {
        const configs = {
            'mp4': { videoCodec: 'copy', audioCodec: 'aac' },
            'flv': { videoCodec: 'flv1', audioCodec: 'mp3' },
            'mkv': { videoCodec: 'copy', audioCodec: 'copy' },
            'webm': { videoCodec: 'libvpx-vp9', audioCodec: 'libopus' }
        };
        return configs[format] || configs['mp4'];
    }

    /**
     * 转换视频格式
     */
    async convertVideoFormat(inputPath, outputPath, format) {
        return new Promise((resolve, reject) => {
            const formatConfig = this.getFormatConfig(format);
            
            // 构建 ffmpeg 参数
            const args = [
                '-i', inputPath,
                '-c:v', formatConfig.videoCodec,
                '-c:a', formatConfig.audioCodec,
                '-movflags', '+faststart', // 优化 MP4 文件，支持流式播放
                '-y',
                outputPath
            ];
            
            // 对于某些格式，添加额外参数
            if (format === 'webm') {
                args.splice(-2, 0, '-b:v', '1M', '-b:a', '128k'); // 设置码率
            } else if (format === 'flv') {
                args.splice(-2, 0, '-f', 'flv'); // 明确指定格式
            }

            console.log(`执行 ffmpeg 转换: ffmpeg ${args.join(' ')}`);

            const ffmpeg = spawn('ffmpeg', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stderr = '';
            let hasError = false;
            
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                // 检查是否有错误信息
                if (output.toLowerCase().includes('error') || output.toLowerCase().includes('failed')) {
                    hasError = true;
                }
            });

            ffmpeg.on('close', (code) => {
                if (code === 0 && !hasError) {
                    // 检查输出文件是否存在且有内容
                    if (fs.existsSync(outputPath)) {
                        const stats = fs.statSync(outputPath);
                        if (stats.size > 0) {
                            console.log(`格式转换成功: ${outputPath} (${stats.size} bytes)`);
                            resolve(outputPath);
                        } else {
                            reject(new Error('转换后的文件为空'));
                        }
                    } else {
                        reject(new Error('转换后的文件不存在'));
                    }
                } else {
                    reject(new Error(`ffmpeg 转换失败 (退出码: ${code}): ${stderr.substring(0, 500)}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(new Error(`启动 ffmpeg 失败: ${error.message}`));
            });
        });
    }

    /**
     * 转换音频格式
     */
    async convertAudioFormat(inputPath, outputPath, format) {
        return new Promise((resolve, reject) => {
            const audioCodecs = {
                'mp3': ['libmp3lame', '192k'],
                'flac': ['flac', ''],
                'aac': ['aac', '192k'],
                'm4a': ['aac', '192k']
            };
            
            const codec = audioCodecs[format] || ['libmp3lame', '192k'];
            const args = [
                '-i', inputPath,
                '-acodec', codec[0],
                ...(codec[1] ? ['-ab', codec[1]] : []),
                '-y',
                outputPath
            ];

            console.log(`执行 ffmpeg 音频转换: ffmpeg ${args.join(' ')}`);

            const ffmpeg = spawn('ffmpeg', args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stderr = '';
            let hasError = false;
            
            ffmpeg.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                if (output.toLowerCase().includes('error') || output.toLowerCase().includes('failed')) {
                    hasError = true;
                }
            });

            ffmpeg.on('close', (code) => {
                if (code === 0 && !hasError) {
                    // 检查输出文件是否存在且有内容
                    if (fs.existsSync(outputPath)) {
                        const stats = fs.statSync(outputPath);
                        if (stats.size > 0) {
                            console.log(`音频转换成功: ${outputPath} (${stats.size} bytes)`);
                            resolve(outputPath);
                        } else {
                            reject(new Error('转换后的音频文件为空'));
                        }
                    } else {
                        reject(new Error('转换后的音频文件不存在'));
                    }
                } else {
                    reject(new Error(`ffmpeg 音频转换失败 (退出码: ${code}): ${stderr.substring(0, 500)}`));
                }
            });

            ffmpeg.on('error', (error) => {
                reject(new Error(`启动 ffmpeg 失败: ${error.message}`));
            });
        });
    }

    /**
     * 流式转换并下载（带超时和错误处理）
     */
    async streamWithFormat(url, res, filename, type, format) {
        const timestamp = Date.now();
        const tempFile = path.join(this.downloadDir, `${timestamp}_temp.${type === 'audio' ? 'm4a' : 'm4s'}`);
        const outputFile = path.join(this.downloadDir, `${timestamp}_output.${format}`);
        
        try {
            console.log(`开始下载并转换 ${type} 为 ${format} 格式...`);
            
            // 先下载到临时文件（设置超时）
            const downloadPromise = this.downloadFile(url, tempFile);
            const downloadTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('下载超时')), 60000) // 60秒超时
            );
            await Promise.race([downloadPromise, downloadTimeout]);
            
            console.log(`下载完成，开始转换格式...`);
            
            // 转换格式（设置超时）
            const convertPromise = type === 'audio' 
                ? this.convertAudioFormat(tempFile, outputFile, format)
                : this.convertVideoFormat(tempFile, outputFile, format);
            const convertTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('格式转换超时')), 300000) // 5分钟超时
            );
            await Promise.race([convertPromise, convertTimeout]);
            
            console.log(`格式转换完成，开始发送文件...`);
            
            // 检查输出文件是否存在
            if (!fs.existsSync(outputFile)) {
                throw new Error('转换后的文件不存在');
            }
            
            // 发送转换后的文件
            const stats = fs.statSync(outputFile);
            console.log(`准备发送文件: ${filename}, 大小: ${stats.size} bytes`);
            
            const contentType = this.getContentType(format);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', stats.size);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache');
            
            const fileStream = fs.createReadStream(outputFile);
            
            // 监听数据流
            let bytesSent = 0;
            fileStream.on('data', (chunk) => {
                bytesSent += chunk.length;
            });
            
            fileStream.pipe(res);
            
            fileStream.on('end', () => {
                console.log(`文件发送完成: ${filename}, 已发送: ${bytesSent} bytes`);
                setTimeout(() => {
                    try { 
                        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
                    } catch (e) {
                        console.error('清理临时文件失败:', e.message);
                    }
                }, 5000);
            });
            
            fileStream.on('error', (err) => {
                console.error('发送文件流错误:', err.message);
                if (!res.headersSent) {
                    res.status(500).json({ success: false, error: '发送文件失败' });
                }
            });
            
            res.on('close', () => {
                console.log(`客户端连接关闭: ${filename}`);
            });
            
        } catch (error) {
            console.error(`格式转换失败: ${error.message}`);
            console.error('错误堆栈:', error.stack);
            
            // 清理临时文件
            try {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
            } catch (e) {}
            
            // 如果转换失败，返回错误信息
            if (!res.headersSent) {
                res.status(500).json({ 
                    success: false, 
                    error: `格式转换失败: ${error.message}`,
                    suggestion: '请检查服务器是否安装了 ffmpeg，或尝试使用原始格式下载'
                });
            } else {
                throw error;
            }
        }
    }

    /**
     * 流式代理下载（不保存到服务器，直接转发）
     */
    async streamProxy(targetUrl, res, filename) {
        try {
            const response = await axios({
                method: 'GET',
                url: targetUrl,
                responseType: 'stream',
                timeout: 300000,
                headers: this.headers
            });
            
            // 设置响应头
            res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
            if (response.headers['content-length']) {
                res.setHeader('Content-Length', response.headers['content-length']);
            }
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
            
            // 直接管道转发
            response.data.pipe(res);
        } catch (error) {
            throw new Error(`流式代理失败: ${error.message}`);
        }
    }
}

module.exports = new BilibiliService();
