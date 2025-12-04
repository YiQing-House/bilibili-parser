/**
 * 自动更新 GitHub Gist 公告脚本
 * 使用方法：node update-announcement.js "更新内容"
 * 或者在 git commit 后运行：node update-announcement.js
 */

const https = require('https');
const { execSync } = require('child_process');

// Gist 配置（与前端保持一致）
const GIST_CONFIG = {
    username: '1662187689',
    gistId: 'ae97ddcecaaf2f3dea622ef7b2520c67',
    filename: 'gistfile1.txt',
    // 需要 GitHub Personal Access Token（有 gist 权限）
    token: process.env.GITHUB_TOKEN || ''
};

// 获取最新的 git commit 信息
function getLatestCommit() {
    try {
        const message = execSync('git log -1 --pretty=format:"%s"', { encoding: 'utf8' }).trim();
        const date = execSync('git log -1 --pretty=format:"%ai"', { encoding: 'utf8' }).trim();
        const hash = execSync('git log -1 --pretty=format:"%h"', { encoding: 'utf8' }).trim();
        return { message, date, hash };
    } catch (error) {
        console.error('获取 commit 信息失败:', error.message);
        return null;
    }
}

// 读取现有的 Gist 内容
function getGistContent(callback) {
    const options = {
        hostname: 'api.github.com',
        path: `/gists/${GIST_CONFIG.gistId}`,
        method: 'GET',
        headers: {
            'User-Agent': 'Node.js',
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `token ${GIST_CONFIG.token}`
        }
    };

    https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                const gist = JSON.parse(data);
                const file = gist.files[GIST_CONFIG.filename];
                callback(null, file ? file.content : '');
            } else {
                callback(new Error(`获取 Gist 失败: ${res.statusCode}`), null);
            }
        });
    }).on('error', (err) => {
        callback(err, null);
    });
}

// 更新 Gist 内容
function updateGist(newContent) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            files: {
                [GIST_CONFIG.filename]: {
                    content: newContent
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
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201) {
                    console.log('✅ 公告更新成功！');
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`更新失败: ${res.statusCode} - ${data}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.write(postData);
        req.end();
    });
}

// 解析现有公告内容
function parseAnnouncement(content) {
    try {
        return JSON.parse(content);
    } catch (e) {
        // 如果不是 JSON，创建新的公告结构
        return {
            id: Date.now().toString(),
            title: '公告通知',
            message: content || '',
            date: new Date().toLocaleDateString('zh-CN'),
            isActive: true,
            history: []
        };
    }
}

// 格式化更新内容
function formatUpdateEntry(commit, customMessage) {
    const message = customMessage || commit.message;
    const date = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    return `• ${date} - ${message}`;
}

// 主函数
async function main() {
    if (!GIST_CONFIG.token) {
        console.error('❌ 错误: 需要设置 GITHUB_TOKEN 环境变量');
        console.log('\n设置方法:');
        console.log('1. 访问 https://github.com/settings/tokens');
        console.log('2. 生成新的 token，勾选 "gist" 权限');
        console.log('3. 设置环境变量:');
        console.log('   Windows: set GITHUB_TOKEN=your_token_here');
        console.log('   Linux/Mac: export GITHUB_TOKEN=your_token_here');
        process.exit(1);
    }

    // 获取自定义消息或 commit 信息
    const customMessage = process.argv[2];
    const commit = getLatestCommit();
    
    if (!customMessage && !commit) {
        console.error('❌ 错误: 无法获取更新信息');
        process.exit(1);
    }

    console.log('📝 正在更新公告...');

    // 获取现有内容
    getGistContent(async (err, currentContent) => {
        if (err) {
            console.error('❌ 获取现有公告失败:', err.message);
            process.exit(1);
        }

        // 解析现有公告
        const announcement = parseAnnouncement(currentContent);
        
        // 添加更新记录到历史
        if (!announcement.history) {
            announcement.history = [];
        }
        
        const updateEntry = formatUpdateEntry(commit || {}, customMessage);
        announcement.history.unshift(updateEntry);
        
        // 限制历史记录数量（保留最近20条）
        if (announcement.history.length > 20) {
            announcement.history = announcement.history.slice(0, 20);
        }

        // 更新公告内容
        announcement.id = Date.now().toString();
        announcement.date = new Date().toLocaleDateString('zh-CN');
        announcement.isActive = true;
        
        // 生成完整的公告消息
        const historyText = announcement.history.join('\n');
        announcement.message = `## 📢 最新更新\n\n${updateEntry}\n\n## 📜 更新历史\n\n${historyText}`;

        // 更新 Gist
        try {
            await updateGist(JSON.stringify(announcement, null, 2));
            console.log('✅ 公告已更新到 GitHub Gist');
        } catch (error) {
            console.error('❌ 更新失败:', error.message);
            process.exit(1);
        }
    });
}

main();

