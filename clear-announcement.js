/**
 * 清除公告历史，只保留最新一条
 * 使用方法：node clear-announcement.js "新公告内容"
 */

const https = require('https');

// Gist 配置
const GIST_CONFIG = {
    username: 'YiQing-House',
    gistId: 'ae97ddcecaaf2f3dea622ef7b2520c67',
    filename: 'gistfile1.txt',
    token: process.env.GITHUB_TOKEN || ''
};

// 更新 Gist 内容
function updateGist(newMessage) {
    const date = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const announcement = {
        id: Date.now().toString(),
        title: 'YiQingBili 1.0 发布公告',
        message: `## 🎉 YiQingBili 1.0 横空出世\n\n${date} - ${newMessage}\n\n---\n\n### ✨ 主要功能\n\n- 🎬 多画质视频下载（未登录支持1080P）\n- 📦 批量下载（收藏夹、合集、分P视频）\n- 🎵 音频分离（统一MP3格式）\n- 📱 完美移动端适配\n- 🎨 精美UI设计（毛玻璃效果）\n- ⚡ 下载进度实时显示\n- 🔐 扫码登录支持\n- 📊 智能画质推荐\n\n### 🚀 立即体验\n\n访问网站开始使用，支持批量解析和下载！`,
        date: new Date().toLocaleDateString('zh-CN'),
        isActive: true,
        history: [] // 清空历史
    };

    const content = JSON.stringify(announcement, null, 2);
    const postData = JSON.stringify({
        files: {
            [GIST_CONFIG.filename]: {
                content: content
            }
        }
    });

    const options = {
        hostname: 'api.github.com',
        path: `/gists/${GIST_CONFIG.gistId}`,
        method: 'PATCH',
        headers: {
            'User-Agent': 'Node.js',
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${GIST_CONFIG.token}`,
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(postData, 'utf8')
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    resolve(data);
                } else {
                    reject(new Error(`更新失败: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData, 'utf8');
        req.end();
    });
}

// 主函数
async function main() {
    if (!GIST_CONFIG.token) {
        console.error('❌ 错误: 需要设置 GITHUB_TOKEN 环境变量');
        console.log('\n设置方法:');
        console.log('Windows: set GITHUB_TOKEN=your_token_here');
        console.log('Linux/Mac: export GITHUB_TOKEN=your_token_here');
        process.exit(1);
    }

    const newMessage = process.argv[2] || 'YiQingBili1.0横空出世 - 全新B站视频解析下载工具，支持多画质、批量下载、收藏夹解析等功能';

    console.log('🧹 正在清除旧公告历史...');
    console.log('📝 设置新公告:', newMessage);

    try {
        await updateGist(newMessage);
        console.log('✅ 公告已清除并更新！');
        console.log('📢 新公告内容已设置为:', newMessage);
    } catch (error) {
        console.error('❌ 更新失败:', error.message);
        process.exit(1);
    }
}

main();

