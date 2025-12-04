# 🎭 隐藏 GitHub 网页上的用户名显示

## 问题

GitHub 网页上显示 `1662187689`（QQ号），想要隐藏或更改显示。

## 解决方案

### 方案 1：更改 GitHub 显示名称（推荐，最简单）

**显示名称（Display Name）** 和 **用户名（Username）** 是不同的：
- **用户名**：用于 URL，例如 `github.com/1662187689`
- **显示名称**：在网页上显示的名称

#### 步骤：

1. **访问 GitHub 设置**
   - 访问：https://github.com/settings/profile

2. **更改显示名称**
   - 找到 "Name" 字段
   - 输入你想要的显示名称，例如：
     - `B站解析助手`
     - `Video Parser`
     - `你的昵称`
   - 点击 "Update profile"

3. **效果**
   - ✅ 网页上显示的是你设置的名称
   - ✅ URL 仍然是 `github.com/1662187689`（不影响现有链接）
   - ✅ 所有功能正常

### 方案 2：更改 GitHub 用户名（彻底但影响大）

如果想完全改变 URL 中的用户名：

1. **访问用户名设置**
   - 访问：https://github.com/settings/admin
   - 点击 "Change username"

2. **输入新用户名**
   - 例如：`bilibili-parser`、`video-downloader` 等
   - 确认更改

3. **更新所有引用**
   - 运行 `更新GitHub用户名.bat` 脚本
   - 更新代码和文档中的引用

**⚠️ 注意**：
- 所有仓库 URL 会改变
- 需要更新远程仓库地址
- 需要更新代码中的引用

### 方案 3：使用 GitHub 组织账号（高级）

创建一个组织账号，将仓库转移到组织下：

1. **创建组织**
   - 访问：https://github.com/organizations/new
   - 创建组织（例如：`bilibili-tools`）

2. **转移仓库**
   - 进入仓库设置
   - 点击 "Transfer ownership"
   - 转移到组织

3. **效果**
   - URL 变为 `github.com/bilibili-tools/bilibili-parser`
   - 个人账号不再显示在仓库 URL 中

## 🎯 推荐方案

**推荐使用方案 1（更改显示名称）**：
- ✅ 最简单，只需 1 分钟
- ✅ 不影响现有链接和配置
- ✅ 网页上显示友好名称
- ✅ 不需要更新代码

## 📝 快速操作

### 更改显示名称（推荐）

1. 访问：https://github.com/settings/profile
2. 在 "Name" 字段输入：`B站解析助手` 或你喜欢的名称
3. 点击 "Update profile"
4. 完成！

### 更改用户名（如果需要）

1. 访问：https://github.com/settings/admin
2. 点击 "Change username"
3. 输入新用户名（例如：`bilibili-parser`）
4. 运行 `更新GitHub用户名.bat` 更新所有引用

## 🔍 验证效果

更改后，访问你的 GitHub 主页：
- 显示名称：你设置的新名称
- URL：`github.com/1662187689`（如果只改显示名称）
- 或：`github.com/新用户名`（如果改了用户名）

## 💡 其他建议

1. **添加头像**：上传一个头像，让账号更个性化
2. **添加简介**：在 "Bio" 中添加项目描述
3. **添加网站**：如果有个人网站，可以添加
4. **固定仓库**：在个人主页固定重要仓库

