const axios = require('axios');
const { URL } = require('url');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * 通用视频解析服务
 * 支持多平台视频解析
 */
class VideoParser {
    constructor() {
        this.supportedPlatforms = {
            douyin: {
                name: '抖音',
                pattern: /(?:douyin|tiktok)\.com/,
                parser: this.parseDouyin.bind(this)
            },
            kuaishou: {
                name: '快手',
                pattern: /kuaishou\.com/,
                parser: this.parseKuaishou.bind(this)
            },
            bilibili: {
                name: 'B站',
                pattern: /bilibili\.com|b23\.tv/,
                parser: this.parseBilibili.bind(this)
            },
            weibo: {
                name: '微博',
                pattern: /weibo\.com/,
                parser: this.parseWeibo.bind(this)
            },
            youtube: {
                name: 'YouTube',
                pattern: /(?:youtube\.com|youtu\.be)/,
                parser: this.parseYouTube.bind(this)
            },
            xigua: {
                name: '西瓜视频',
                pattern: /ixigua\.com/,
                parser: this.parseXigua.bind(this)
            },
            pipixia: {
                name: '皮皮虾',
                pattern: /pipix\.com/,
                parser: this.parsePipixia.bind(this)
            },
            xiaohongshu: {
                name: '小红书',
                pattern: /xiaohongshu\.com|xhslink\.com/,
                parser: this.parseXiaohongshu.bind(this)
            }
        };
    }

    /**
     * 检测平台
     */
    detectPlatform(url) {
        for (const [key, platform] of Object.entries(this.supportedPlatforms)) {
            if (platform.pattern.test(url.toLowerCase())) {
                return { key, platform };
            }
        }
        return null;
    }

    /**
     * 主解析方法
     */
    async parse(url) {
        const detected = this.detectPlatform(url);
        
        if (!detected) {
            throw new Error('不支持的视频平台，请检查链接是否正确');
        }

        const { key, platform } = detected;
        
        try {
            const result = await platform.parser(url);
            return {
                ...result,
                platform: platform.name,
                platformKey: key
            };
        } catch (error) {
            throw new Error(`解析 ${platform.name} 视频失败: ${error.message}`);
        }
    }

    /**
     * 获取支持的平台列表
     */
    getSupportedPlatforms() {
        return Object.entries(this.supportedPlatforms).map(([key, platform]) => ({
            key,
            name: platform.name
        }));
    }

    /**
     * 解析抖音视频
     */
    async parseDouyin(url) {
        try {
            // 尝试使用第三方解析API
            const apiUrls = [
                `https://api.douyin.wtf/api?url=${encodeURIComponent(url)}`,
            ];

            for (const apiUrl of apiUrls) {
                try {
                    const response = await axios.get(apiUrl, {
                        timeout: 15000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        }
                    });

                    if (response.data && response.data.video_data) {
                        const data = response.data.video_data;
                        return {
                            title: data.title || '抖音视频',
                            author: data.author?.nickname || '未知作者',
                            duration: this.formatDuration(data.duration || 0),
                            thumbnail: data.cover || '',
                            videoUrl: data.nwm_video_url || data.video_url || url,
                            downloadLinks: [{
                                quality: '无水印',
                                url: data.nwm_video_url || data.video_url || url,
                                size: null
                            }]
                        };
                    }
                } catch (e) {
                    console.log('抖音API请求失败:', e.message);
                }
            }

            // 如果API失败，返回基本信息
            return {
                title: '抖音视频',
                author: '未知作者',
                duration: '00:00',
                thumbnail: '',
                videoUrl: url,
                downloadLinks: [{
                    quality: '原始视频',
                    url: url,
                    size: null
                }]
            };
        } catch (error) {
            throw new Error('抖音视频解析失败: ' + error.message);
        }
    }

    /**
     * 解析快手视频
     */
    async parseKuaishou(url) {
        return {
            title: '快手视频',
            author: '快手用户',
            duration: '00:00',
            thumbnail: '',
            videoUrl: url,
            downloadLinks: [{
                quality: '原始视频',
                url: url,
                size: null
            }]
        };
    }

    /**
     * 解析 B站视频 (基本方法，主要由 bilibiliService 处理)
     */
    async parseBilibili(url) {
        try {
            const bvMatch = url.match(/BV([a-zA-Z0-9]+)/);
            const avMatch = url.match(/av(\d+)/);
            
            if (!bvMatch && !avMatch) {
                throw new Error('无法从链接中提取视频ID');
            }

            const videoId = bvMatch ? `BV${bvMatch[1]}` : `av${avMatch[1]}`;
            
            // 获取视频信息
            const apiUrl = bvMatch 
                ? `https://api.bilibili.com/x/web-interface/view?bvid=${videoId}`
                : `https://api.bilibili.com/x/web-interface/view?aid=${avMatch[1]}`;
            
            const response = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Referer': 'https://www.bilibili.com/'
                },
                timeout: 10000
            });
            
            if (response.data && response.data.code === 0) {
                const data = response.data.data;
                return {
                    title: data.title || 'B站视频',
                    author: data.owner?.name || '未知UP主',
                    duration: this.formatDuration(data.duration),
                    thumbnail: data.pic || '',
                    videoUrl: url,
                    downloadLinks: [
                        { quality: '1080P', qn: 80, url: url, needYtdlp: true },
                        { quality: '720P', qn: 64, url: url, needYtdlp: true },
                        { quality: '480P', qn: 32, url: url, needYtdlp: true }
                    ]
                };
            }
            
            throw new Error('获取视频信息失败');
        } catch (error) {
            throw new Error('B站视频解析失败: ' + error.message);
        }
    }

    /**
     * 解析微博视频
     */
    async parseWeibo(url) {
        return {
            title: '微博视频',
            author: '微博用户',
            duration: '00:00',
            thumbnail: '',
            videoUrl: url,
            downloadLinks: [{
                quality: '原始视频',
                url: url,
                size: null
            }]
        };
    }

    /**
     * 解析 YouTube 视频
     */
    async parseYouTube(url) {
        try {
            const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
            
            if (!videoIdMatch) {
                throw new Error('无法从链接中提取视频ID');
            }

            const videoId = videoIdMatch[1];
            
            // 尝试使用 yt-dlp 获取信息
            try {
                const { stdout } = await execAsync(`yt-dlp --dump-json "${url}"`, {
                    timeout: 30000
                });
                const videoInfo = JSON.parse(stdout);
                
                return {
                    title: videoInfo.title || 'YouTube 视频',
                    author: videoInfo.uploader || videoInfo.channel || '未知频道',
                    duration: this.formatDuration(videoInfo.duration),
                    thumbnail: videoInfo.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                    videoUrl: url,
                    downloadLinks: [{
                        quality: '原始视频',
                        url: url,
                        size: null,
                        needYtdlp: true
                    }]
                };
            } catch (ytdlpError) {
                console.log('yt-dlp 不可用，使用备用方法');
            }

            // 备用: 使用 oEmbed API
            try {
                const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
                const oembedResponse = await axios.get(oembedUrl, { timeout: 10000 });
                const oembedData = oembedResponse.data;

                return {
                    title: oembedData.title || 'YouTube 视频',
                    author: oembedData.author_name || '未知频道',
                    duration: '00:00',
                    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                    videoUrl: url,
                    downloadLinks: [{
                        quality: '原始视频',
                        url: url,
                        size: null,
                        needYtdlp: true
                    }]
                };
            } catch (oembedError) {
                console.log('oEmbed 失败:', oembedError.message);
            }

            return {
                title: 'YouTube 视频',
                author: '未知频道',
                duration: '00:00',
                thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                videoUrl: url,
                downloadLinks: [{
                    quality: '原始视频',
                    url: url,
                    size: null,
                    needYtdlp: true
                }]
            };
        } catch (error) {
            throw new Error('YouTube 视频解析失败: ' + error.message);
        }
    }

    /**
     * 解析西瓜视频
     */
    async parseXigua(url) {
        return {
            title: '西瓜视频',
            author: '西瓜用户',
            duration: '00:00',
            thumbnail: '',
            videoUrl: url,
            downloadLinks: [{
                quality: '原始视频',
                url: url,
                size: null
            }]
        };
    }

    /**
     * 解析皮皮虾
     */
    async parsePipixia(url) {
        return {
            title: '皮皮虾视频',
            author: '皮皮虾用户',
            duration: '00:00',
            thumbnail: '',
            videoUrl: url,
            downloadLinks: [{
                quality: '原始视频',
                url: url,
                size: null
            }]
        };
    }

    /**
     * 解析小红书
     */
    async parseXiaohongshu(url) {
        return {
            title: '小红书视频',
            author: '小红书用户',
            duration: '00:00',
            thumbnail: '',
            videoUrl: url,
            downloadLinks: [{
                quality: '原始视频',
                url: url,
                size: null
            }]
        };
    }

    /**
     * 格式化时长
     */
    formatDuration(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (!bytes) return null;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    }
}

module.exports = new VideoParser();

