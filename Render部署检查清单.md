# ✅ Render 部署检查清单

## 📋 部署前检查

### 1. 代码已推送到 GitHub
- [x] ✅ 代码已推送到：https://github.com/1662187689/bilibili-parser
- [x] ✅ 所有文件都已提交
- [x] ✅ 包含 Dockerfile

### 2. 项目文件检查
- [x] ✅ `Dockerfile` - 存在且正确
- [x] ✅ `package.json` - 存在且包含所有依赖
- [x] ✅ `server.js` - 使用 `process.env.PORT || 3000`
- [x] ✅ `public/` - 前端文件完整
- [x] ✅ `services/` - 服务模块完整

### 3. Dockerfile 检查
- [x] ✅ 基于 `node:18`
- [x] ✅ 安装 Python3、pip、ffmpeg、yt-dlp
- [x] ✅ 复制所有必需文件
- [x] ✅ 暴露端口 3000
- [x] ✅ 启动命令正确

---

## 🚀 Render 部署步骤

### 步骤 1：登录 Render
1. 访问：https://render.com/
2. 点击 `Get Started for Free`
3. 使用 GitHub 账号登录（推荐）

### 步骤 2：创建 Web Service
1. 点击 **"New +"** → **"Web Service"**

2. **连接 GitHub 仓库**
   - 点击 `Connect account`（如果还没连接）
   - 选择你的 GitHub 账号：`1662187689`
   - 授权 Render 访问仓库
   - 选择仓库：**`bilibili-parser`**

3. **配置服务**（重要！）
   ```
   Name: bilibili-parser（或自定义）
   Region: Singapore（离中国最近，或选择其他）
   Branch: main
   Root Directory: （留空）
   Environment: Docker ⚠️ 必须选择 Docker！
   Dockerfile Path: （留空，默认使用根目录的 Dockerfile）
   Docker Context: （留空）
   ```

4. **环境变量（可选）**
   - 点击 `Advanced` → `Add Environment Variable`
   - `NODE_ENV`: `production`
   - `PORT`: （Render 会自动设置，无需手动配置）

5. **点击 "Create Web Service"**
   - Render 会自动开始构建
   - 首次部署需要 5-10 分钟

### 步骤 3：等待部署完成
1. **查看构建日志**
   - 在服务页面点击 `Logs` 标签
   - 查看构建进度
   - 等待状态变为 `Live`

2. **获取服务 URL**
   - 部署完成后，Render 会提供 URL
   - 格式：`https://bilibili-parser.onrender.com`
   - 或：`https://你的服务名.onrender.com`

### 步骤 4：验证部署
1. **访问应用**
   - 打开 Render 提供的 URL
   - 应该能看到应用界面

2. **测试功能**
   - 解析一个 B站视频链接
   - 测试下载功能
   - 检查控制台是否有错误

---

## ⚠️ 常见问题

### 问题 1：构建失败
**检查**：
- Dockerfile 语法是否正确
- 所有依赖是否在 package.json 中
- 查看 Render Logs 中的具体错误

**解决**：
- 检查构建日志中的错误信息
- 确保所有文件都已推送到 GitHub

### 问题 2：服务无法启动
**检查**：
- server.js 是否使用 `process.env.PORT`
- 查看 Render Logs 中的错误信息

**解决**：
- 确认 PORT 配置正确
- 检查是否有语法错误

### 问题 3：找不到仓库
**解决**：
- 确认 GitHub 仓库是公开的（或已授权 Render 访问）
- 重新连接 GitHub 账号

---

## 📝 部署后操作

### 1. 测试功能
- [ ] 访问应用 URL
- [ ] 测试视频解析
- [ ] 测试下载功能
- [ ] 测试批量解析
- [ ] 测试收藏夹解析

### 2. 配置自定义域名（可选）
- [ ] 在腾讯云配置 DNS 解析
- [ ] 在 Render 添加自定义域名
- [ ] 等待 SSL 证书自动配置

### 3. 监控和维护
- [ ] 定期查看 Render Logs
- [ ] 监控服务状态
- [ ] 更新代码后自动重新部署

---

## 🔗 相关链接

- **Render 控制台**: https://dashboard.render.com/
- **GitHub 仓库**: https://github.com/1662187689/bilibili-parser
- **完整部署指南**: 查看 `完整部署指南.md`

---

**部署完成后，你的应用将在 Render 上运行！** 🎉

