# 🎬 B站视频解析助手

> 一个功能完整的全栈视频解析下载工具，支持 B站、收藏夹、批量解析等功能

## ✨ 功能特性

- 🎯 **多链接解析**：支持单个、批量、收藏夹、UP主投稿解析
- 🎨 **现代化 UI**：毛玻璃效果、主题切换（白天/黑夜）、二次元背景
- 🔐 **登录系统**：B站扫码登录、VIP 权限检测
- 📥 **多格式下载**：视音完整、分离、仅音频、纯画面、封面
- 🎬 **多画质支持**：4K、1080P60、1080P+、1080P、720P 等
- ⚡ **批量处理**：支持批量解析和下载
- 🌐 **云部署**：支持 Render、Docker 一键部署

## 🏗️ 项目结构

```
.
├── server.js                    # Express 后端服务器
├── services/                    # 服务模块
│   ├── bilibiliService.js      # B站解析服务
│   ├── multiPlatformService.js # 多平台解析服务
│   ├── videoParser.js          # 视频解析服务
│   └── ytdlpService.js         # yt-dlp 下载服务
├── public/                      # 前端静态文件
│   ├── index.html              # 主页面
│   ├── script.js               # 前端逻辑
│   ├── styles.css              # 样式表
│   └── images/                 # 背景图片（可选）
├── package.json                # Node.js 依赖
├── requirements.txt            # Python 依赖（yt-dlp）
├── Dockerfile                  # Docker 配置
├── README.md                   # 项目说明
├── 完整部署指南.md             # 详细部署教程
├── 本地测试安装指南.md         # 本地开发指南
├── 启动应用.bat                # 一键启动脚本
└── 安装依赖-本地.bat           # 一键安装脚本
```

## 🚀 快速开始

### 本地开发

**Windows 用户（推荐）**：
```bash
# 1. 安装依赖
双击运行：安装依赖-本地.bat

# 2. 启动服务器
双击运行：启动应用.bat
```

**手动安装**：
```bash
# 1. 安装 Node.js 依赖
npm install

# 2. 安装 Python 依赖（yt-dlp）
pip install yt-dlp

# 3. 启动服务器
npm start
```

**访问应用**：打开浏览器访问 `http://localhost:3000`

### 云部署

**详细步骤请查看**：**[完整部署指南.md](完整部署指南.md)**

**快速步骤**：
1. 推送代码到 GitHub
2. 在 Render 创建服务（选择 Docker 环境）
3. 配置域名和 SSL
4. 完成！

## 📖 使用说明

### 单链接解析

1. 在搜索框输入 B站视频链接或 BV 号
2. 选择格式和画质
3. 点击"解析下载"

### 批量解析

1. 在搜索框输入多个链接（换行分隔）
2. 系统自动识别并批量解析
3. 点击"全部下载"或单独下载

### 收藏夹解析

1. 输入收藏夹链接或 ID
   - 链接格式：`https://space.bilibili.com/xxx/favlist?fid=xxx`
   - 或直接输入收藏夹 ID：`1765119834`
2. 系统自动解析收藏夹内所有视频
3. 批量下载

### UP主投稿解析

1. 输入 UP主主页链接
   - 格式：`https://space.bilibili.com/522224434`
2. 系统自动解析所有投稿视频
3. 批量下载

## 🎨 主题定制

### 背景图设置

项目已配置**二次元美少女主题**背景，支持白天/黑夜模式自动切换。

**替换背景图**：
1. 准备图片（建议 1920x1080 或更高）
   - 白天：明亮、清新风格
   - 黑夜：深色、星空风格
2. 将图片放入 `public/images/` 目录
   - 推荐命名：`day.jpg`, `night.jpg`
3. 修改 `public/script.js` 中的 `bgConfig`：
   ```javascript
   const bgConfig = {
       day: [
           'images/day.jpg',  // 本地图片
           // 'https://api.ixiaowai.cn/api/api.php', // 或使用在线API
       ],
       night: [
           'images/night.jpg',
       ],
       rotateInterval: 180000 // 3分钟轮换
   };
   ```

**调整背景效果**：
在 `public/index.html` 中搜索 `.background-image` 调整 CSS：
```css
/* 调整模糊度 */
filter: blur(3px); /* 0为清晰 */

/* 调整透明度 */
opacity: 0.7; /* 0-1 */
```

### 主题颜色

主题颜色在 `public/index.html` 的 CSS 变量中定义：
- **白天主题**：蜜桃奶茶色（温暖柔和）
- **黑夜主题**：暗樱粉色（优雅护眼）

## 📡 API 接口

### POST /api/parse
解析视频链接

**请求**：
```json
{
  "url": "https://www.bilibili.com/video/BV1xx411c7mu"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "title": "视频标题",
    "author": "UP主",
    "thumbnail": "缩略图URL",
    "duration": "时长"
  }
}
```

### GET /api/bilibili/favorites
解析收藏夹

**请求**：
```
GET /api/bilibili/favorites?id=1765119834
```

### GET /api/bilibili/user-videos
解析 UP主投稿

**请求**：
```
GET /api/bilibili/user-videos?uid=522224434
```

更多 API 文档请查看代码注释。

## 🛠️ 技术栈

- **后端**：Node.js + Express
- **前端**：原生 JavaScript + HTML + CSS
- **视频处理**：yt-dlp、ffmpeg
- **部署**：Docker、Render

## 📚 文档

- **[完整部署指南.md](完整部署指南.md)** - 从零到上线的完整教程
- **[本地测试安装指南.md](本地测试安装指南.md)** - 本地开发环境搭建

## ⚠️ 注意事项

1. **API 限制**：免费解析 API 可能有调用频率限制
2. **VIP 权限**：部分画质需要大会员，请先登录
3. **法律合规**：请确保使用符合相关法律法规
4. **资源消耗**：大文件下载会消耗服务器资源

## 🔒 安全建议

- 不要在前端代码中硬编码敏感信息
- 使用环境变量管理配置
- 实施适当的速率限制
- 验证和清理用户输入

## 📝 更新日志

### v2.8.2
- ✅ 修复多链接识别问题
- ✅ 修复收藏夹解析功能
- ✅ 优化 UI 布局
- ✅ 添加 VIP 权限检查
- ✅ 优化登录流程

## 📞 技术支持

如有问题，请：
1. 查看 [完整部署指南.md](完整部署指南.md) 的"常见问题排查"部分
2. 检查浏览器控制台和服务器日志
3. 提交 Issue

---

**⭐ 如果这个项目对你有帮助，请给个 Star！**
