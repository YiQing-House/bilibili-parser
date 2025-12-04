const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

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
        
        // 通用请求头
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.bilibili.com/',
            'Origin': 'https://www.bilibili.com'
        };
    }

    /**
     * 获取 WBI keys
     */
    async getWbiKeys(cookies = null) {
        const now = Date.now();
        
        if (this.wbiKeys && now < this.wbiKeysExpire) {
            return this.wbiKeys;
        }

        try {
            const headers = { ...this.headers };
            if (cookies) {
                headers['Cookie'] = this.formatCookies(cookies);
            }
            
            const response = await axios.get('https://api.bilibili.com/x/web-interface/nav', {
                headers,
                timeout: 10000
            });

            if (response.data && response.data.code === 0) {
                const { img_url, sub_url } = response.data.data.wbi_img;
                const imgKey = img_url.split('/').pop().split('.')[0];
                const subKey = sub_url.split('/').pop().split('.')[0];
                
                this.wbiKeys = { imgKey, subKey };
                this.wbiKeysExpire = now + 30 * 60 * 1000;
                
                return this.wbiKeys;
            }
        } catch (error) {
            console.log('获取 WBI keys 失败:', error.message);
        }
        
        return null;
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
     * 获取视频信息
     */
    async getVideoInfo(url, cookies = null) {
        const videoId = this.extractVideoId(url);
        if (!videoId) {
            throw new Error('无法从链接中提取视频ID');
        }

        const params = videoId.bvid 
            ? { bvid: videoId.bvid }
            : { aid: videoId.aid };

        const signedParams = await this.encWbi(params, cookies);
        
        const headers = { ...this.headers };
        if (cookies) {
            headers['Cookie'] = this.formatCookies(cookies);
        }
        
        const apiUrl = `https://api.bilibili.com/x/web-interface/view?${new URLSearchParams(signedParams)}`;
        
        const response = await axios.get(apiUrl, {
            headers,
            timeout: 10000
        });

        if (response.data && response.data.code === 0) {
            return response.data.data;
        }
        
        throw new Error(`获取视频信息失败: ${response.data?.message || '未知错误'}`);
    }

    /**
     * 获取视频播放地址（支持登录获取高画质）
     */
    async getPlayUrl(bvid, cid, qn = 80, cookies = null) {
        const params = {
            bvid: bvid,
            cid: cid,
            qn: qn,
            fnval: 4048,  // 支持 DASH + HDR + 4K + AV1 + 8K
            fnver: 0,
            fourk: 1,
            platform: 'pc'
        };

        const signedParams = await this.encWbi(params, cookies);
        
        const headers = { ...this.headers };
        if (cookies) {
            headers['Cookie'] = this.formatCookies(cookies);
        }
        
        const apiUrl = `https://api.bilibili.com/x/player/wbi/playurl?${new URLSearchParams(signedParams)}`;
        
        const response = await axios.get(apiUrl, {
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
            
            // 如果API没有返回任何画质，使用默认列表
            // 免费画质（1080P及以下）默认认为存在，大会员画质标记为不存在
            if (downloadLinks.length === 0) {
                downloadLinks = allQualities.map(q => ({
                    ...q,
                    url: url,
                    needYtdlp: true,
                    exists: !q.needVip // 免费画质默认存在，大会员画质不存在
                }));
            } else {
                // 补充所有可能的画质选项，标记哪些是实际存在的
                const finalLinks = [];
                allQualities.forEach(quality => {
                    // 如果API返回了该画质，标记为存在
                    // 如果是免费画质（1080P及以下），即使API没返回也认为存在（B站通常都支持）
                    const exists = existingQns.has(quality.qn) || !quality.needVip;
                    finalLinks.push({
                        quality: quality.quality,
                        qn: quality.qn,
                        needVip: quality.needVip,
                        url: url,
                        needYtdlp: true,
                        exists: exists // 标记是否存在
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
     * 带画质选择的下载方法（流式传输到浏览器）
     * @param {string} url - 视频URL
     * @param {number} qn - 画质
     * @param {object} cookies - 登录cookies
     * @param {object} res - Express响应对象
     * @param {string} format - 输出格式 (mp4, flv, mkv, webm)
     */
    async downloadWithQuality(url, qn = 80, cookies = null, res, format = 'mp4') {
        try {
            console.log('开始下载 B站视频:', { url, qn, hasLogin: !!cookies });
            
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
            
            // 选择对应画质的视频流
            let selectedVideo = videos.find(v => v.id === qn);
            if (!selectedVideo) {
                // 如果没有精确匹配，选择最接近的
                selectedVideo = videos.reduce((prev, curr) => {
                    return Math.abs(curr.id - qn) < Math.abs(prev.id - qn) ? curr : prev;
                });
            }
            
            const selectedAudio = audios && audios.length > 0 ? audios[0] : null;
            
            const videoUrl = selectedVideo.baseUrl || selectedVideo.base_url;
            const audioUrl = selectedAudio ? (selectedAudio.baseUrl || selectedAudio.base_url) : null;
            
            // 生成文件名
            const timestamp = Date.now();
            const safeTitle = (videoInfo.title || 'video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
            const videoFile = path.join(this.downloadDir, `${timestamp}_video.m4s`);
            const audioFile = path.join(this.downloadDir, `${timestamp}_audio.m4s`);
            const outputFile = path.join(this.downloadDir, `${safeTitle}.${format}`);
            
            // 下载视频流
            console.log('下载视频流...');
            await this.downloadFile(videoUrl, videoFile);
            
            if (audioUrl) {
                // 下载音频流
                console.log('下载音频流...');
                await this.downloadFile(audioUrl, audioFile);
                
                // 检查 ffmpeg 并合并
                const hasFfmpeg = await this.checkFfmpeg();
                if (hasFfmpeg) {
                    console.log(`合并音视频并转换为 ${format} 格式...`);
                    await this.mergeVideoAudio(videoFile, audioFile, outputFile, format);
                    
                    // 清理临时文件
                    try {
                        fs.unlinkSync(videoFile);
                        fs.unlinkSync(audioFile);
                    } catch (e) {}
                    
                    // 发送合并后的文件
                    const stats = fs.statSync(outputFile);
                    const contentType = this.getContentType(format);
                    res.setHeader('Content-Type', contentType);
                    res.setHeader('Content-Length', stats.size);
                    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.${format}"`);
                    
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
            
            // 如果没有音频或没有 ffmpeg，只发送视频
            // 如果指定了格式且不是 m4s，尝试转换
            if (format !== 'm4s' && format !== 'mp4') {
                const hasFfmpeg = await this.checkFfmpeg();
                if (hasFfmpeg) {
                    const convertedFile = path.join(this.downloadDir, `${safeTitle}.${format}`);
                    await this.convertVideoFormat(videoFile, convertedFile, format);
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
            
            // 检查 ffmpeg 并转换为 MP3
            const hasFfmpeg = await this.checkFfmpeg();
            if (hasFfmpeg) {
                console.log('转换音频为 MP3...');
                await this.convertToMp3(audioFile, outputFile);
                
                // 清理临时文件
                try {
                    fs.unlinkSync(audioFile);
                } catch (e) {}
                
                // 发送转换后的文件
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
            } else {
                // 如果没有 ffmpeg，直接发送 m4s 文件
                const stats = fs.statSync(audioFile);
                res.setHeader('Content-Type', 'audio/mp4');
                res.setHeader('Content-Length', stats.size);
                res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.m4s"`);
                
                const fileStream = fs.createReadStream(audioFile);
                fileStream.pipe(res);
                
                fileStream.on('end', () => {
                    setTimeout(() => {
                        try { fs.unlinkSync(audioFile); } catch (e) {}
                    }, 5000);
                });
            }
            
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
