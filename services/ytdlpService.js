const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const os = require('os');

const execAsync = promisify(exec);

/**
 * yt-dlp 服务
 * 提供基于 yt-dlp 的视频下载功能
 */
class YtdlpService {
    constructor() {
        this.downloadDir = path.join(os.tmpdir(), 'ytdlp-downloads');
        this.ensureDownloadDir();
        
        // 缓存 yt-dlp 可用性状态
        this.ytdlpAvailable = null;
        this.ytdlpCommand = null;
        this.ffmpegAvailable = null;
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
     * 检查 yt-dlp 是否可用
     */
    async checkAvailable() {
        // 如果已检查过，返回缓存结果
        if (this.ytdlpAvailable !== null) {
            return {
                available: this.ytdlpAvailable,
                command: this.ytdlpCommand,
                ffmpegAvailable: this.ffmpegAvailable
            };
        }

        const commands = ['yt-dlp', 'youtube-dl'];
        
        for (const cmd of commands) {
            try {
                const { stdout } = await execAsync(`${cmd} --version`, { timeout: 10000 });
                this.ytdlpAvailable = true;
                this.ytdlpCommand = cmd;
                
                // 检查 ffmpeg
                try {
                    await execAsync('ffmpeg -version', { timeout: 5000 });
                    this.ffmpegAvailable = true;
                } catch {
                    this.ffmpegAvailable = false;
                }
                
                return {
                    available: true,
                    version: stdout.trim(),
                    command: cmd,
                    ffmpegAvailable: this.ffmpegAvailable
                };
            } catch (error) {
                // 继续尝试下一个命令
            }
        }

        this.ytdlpAvailable = false;
        return {
            available: false,
            error: 'yt-dlp 或 youtube-dl 未安装'
        };
    }

    /**
     * 获取视频信息
     */
    async getVideoInfo(url) {
        const check = await this.checkAvailable();
        if (!check.available) {
            throw new Error('yt-dlp 不可用');
        }

        try {
            const { stdout } = await execAsync(
                `${check.command} --dump-json --no-playlist "${url}"`,
                { timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
            );
            
            return JSON.parse(stdout);
        } catch (error) {
            throw new Error(`获取视频信息失败: ${error.message}`);
        }
    }

    /**
     * 获取可用格式列表
     */
    async getFormats(url) {
        const info = await this.getVideoInfo(url);
        return info.formats || [];
    }

    /**
     * 流式下载视频
     */
    async downloadVideoStream(url, format = 'best', res) {
        const check = await this.checkAvailable();
        if (!check.available) {
            throw new Error('yt-dlp 不可用，请联系管理员安装');
        }

        try {
            // 先获取视频信息
            const info = await this.getVideoInfo(url);
            const safeTitle = (info.title || 'video').replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
            
            // 设置响应头
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeTitle)}.mp4"`);

            // 构建下载命令
            let formatOption = format;
            if (format === 'best') {
                formatOption = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
            }

            const args = [
                '-f', formatOption,
                '--merge-output-format', 'mp4',
                '-o', '-', // 输出到 stdout
                url
            ];

            const ytdlp = spawn(check.command, args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            ytdlp.stdout.pipe(res);

            ytdlp.stderr.on('data', (data) => {
                console.log('yt-dlp:', data.toString());
            });

            ytdlp.on('error', (error) => {
                console.error('yt-dlp 执行错误:', error);
                if (!res.headersSent) {
                    res.status(500).json({ success: false, error: error.message });
                }
            });

            ytdlp.on('close', (code) => {
                if (code !== 0) {
                    console.error(`yt-dlp 退出码: ${code}`);
                }
            });

        } catch (error) {
            throw new Error(`下载失败: ${error.message}`);
        }
    }

    /**
     * 下载视频到文件
     */
    async downloadToFile(url, outputPath, format = 'best') {
        const check = await this.checkAvailable();
        if (!check.available) {
            throw new Error('yt-dlp 不可用');
        }

        let formatOption = format;
        if (format === 'best') {
            formatOption = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
        }

        const command = `${check.command} -f "${formatOption}" --merge-output-format mp4 -o "${outputPath}" "${url}"`;
        
        try {
            await execAsync(command, { timeout: 600000 }); // 10分钟超时
            return outputPath;
        } catch (error) {
            throw new Error(`下载失败: ${error.message}`);
        }
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

    /**
     * 清理临时文件
     */
    cleanupTempFiles() {
        try {
            const files = fs.readdirSync(this.downloadDir);
            const now = Date.now();
            const maxAge = 30 * 60 * 1000; // 30分钟

            files.forEach(file => {
                const filePath = path.join(this.downloadDir, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > maxAge) {
                    fs.unlinkSync(filePath);
                }
            });
        } catch (error) {
            console.error('清理临时文件失败:', error);
        }
    }
}

module.exports = new YtdlpService();

