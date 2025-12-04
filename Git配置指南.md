# 🔧 Git 配置完整指南

## 📋 目录

1. [安装 Git](#安装-git)
2. [首次配置](#首次配置)
3. [验证配置](#验证配置)
4. [常用配置](#常用配置)
5. [SSH 密钥配置（可选）](#ssh-密钥配置可选)

---

## 📥 安装 Git

### Windows 用户

#### 方法一：官方安装包（推荐）

1. **下载 Git**
   - 访问：https://git-scm.com/download/win
   - 点击下载（会自动下载最新版本）

2. **安装 Git**
   - 双击下载的安装包
   - **安装选项**（推荐设置）：
     - ✅ 使用默认编辑器（或选择 VS Code）
     - ✅ Git from the command line and also from 3rd-party software
     - ✅ Use bundled OpenSSH
     - ✅ Use the OpenSSL library
     - ✅ Checkout Windows-style, commit Unix-style line endings
     - ✅ Use MinTTY（默认终端）
     - ✅ Enable file system caching
     - ✅ Enable Git Credential Manager
   - 点击 "Next" 完成安装

3. **验证安装**
   - 打开 PowerShell 或 CMD
   - 运行：
     ```bash
     git --version
     ```
   - 应该显示版本号，如：`git version 2.42.0`

#### 方法二：使用包管理器

**使用 Chocolatey**：
```bash
choco install git
```

**使用 Winget**：
```bash
winget install Git.Git
```

### Mac 用户

```bash
# 使用 Homebrew
brew install git

# 或下载安装包
# https://git-scm.com/download/mac
```

### Linux 用户

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install git

# CentOS/RHEL
sudo yum install git

# Fedora
sudo dnf install git
```

---

## ⚙️ 首次配置

### 步骤 1：配置用户名和邮箱

**这是必需的配置！** Git 使用这些信息标识你的提交。

```bash
# 设置全局用户名（替换为你的 GitHub 用户名）
git config --global user.name "你的GitHub用户名"

# 设置全局邮箱（使用 GitHub 注册邮箱）
git config --global user.email "你的邮箱@example.com"
```

**示例**：
```bash
git config --global user.name "zhangsan"
git config --global user.email "zhangsan@example.com"
```

### 步骤 2：配置默认编辑器（可选）

```bash
# 使用 VS Code（推荐）
git config --global core.editor "code --wait"

# 使用记事本
git config --global core.editor "notepad"

# 使用 Vim
git config --global core.editor "vim"

# 使用 Nano
git config --global core.editor "nano"
```

### 步骤 3：配置默认分支名（可选）

```bash
# 设置默认分支为 main（推荐）
git config --global init.defaultBranch main

# 或使用 master（旧版本默认）
git config --global init.defaultBranch master
```

### 步骤 4：配置行尾符（Windows 用户）

```bash
# 自动转换行尾符（推荐）
git config --global core.autocrlf true

# Mac/Linux 用户使用
git config --global core.autocrlf input
```

---

## ✅ 验证配置

### 查看所有配置

```bash
# 查看所有配置
git config --list

# 查看全局配置
git config --global --list

# 查看本地配置（需要在 Git 仓库中）
git config --local --list
```

### 查看特定配置

```bash
# 查看用户名
git config user.name

# 查看邮箱
git config user.email

# 查看编辑器
git config core.editor
```

### 预期输出示例

```bash
$ git config --list
user.name=zhangsan
user.email=zhangsan@example.com
core.editor=code --wait
init.defaultBranch=main
core.autocrlf=true
```

---

## 🛠️ 常用配置

### 1. 配置别名（简化命令）

```bash
# 简化常用命令
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit

# 使用示例
git st    # 等同于 git status
git co    # 等同于 git checkout
git br    # 等同于 git branch
git ci    # 等同于 git commit
```

### 2. 配置颜色输出

```bash
# 启用颜色输出（默认已启用）
git config --global color.ui auto

# 配置特定命令的颜色
git config --global color.branch auto
git config --global color.diff auto
git config --global color.status auto
```

### 3. 配置推送行为

```bash
# 设置默认推送行为（推荐）
git config --global push.default simple

# 或使用 current（推送当前分支）
git config --global push.default current
```

### 4. 配置凭证存储

**Windows 用户**（推荐）：
```bash
# 使用 Windows Credential Manager（默认）
git config --global credential.helper manager-core
```

**Mac 用户**：
```bash
# 使用 macOS Keychain
git config --global credential.helper osxkeychain
```

**Linux 用户**：
```bash
# 使用缓存（15分钟）
git config --global credential.helper cache

# 或使用文件存储（不推荐，不安全）
git config --global credential.helper store
```

### 5. 配置忽略文件大小写

```bash
# Windows 用户（推荐）
git config --global core.ignorecase true

# Mac/Linux 用户
git config --global core.ignorecase false
```

---

## 🔐 SSH 密钥配置（可选）

如果你不想每次推送都输入密码，可以配置 SSH 密钥。

### 步骤 1：检查是否已有 SSH 密钥

```bash
# 检查 .ssh 目录
ls ~/.ssh

# 或 Windows
dir C:\Users\你的用户名\.ssh
```

如果看到 `id_rsa` 或 `id_ed25519` 文件，说明已有密钥。

### 步骤 2：生成新的 SSH 密钥

```bash
# 使用 Ed25519 算法（推荐）
ssh-keygen -t ed25519 -C "你的邮箱@example.com"

# 或使用 RSA 算法（兼容性更好）
ssh-keygen -t rsa -b 4096 -C "你的邮箱@example.com"
```

**提示**：
- 按 Enter 使用默认路径
- 设置密码（可选，但推荐）
- 再次输入密码确认

### 步骤 3：复制公钥

**Windows**：
```bash
# 使用 PowerShell
type C:\Users\你的用户名\.ssh\id_ed25519.pub

# 或使用记事本
notepad C:\Users\你的用户名\.ssh\id_ed25519.pub
```

**Mac/Linux**：
```bash
cat ~/.ssh/id_ed25519.pub
```

**复制输出的内容**（以 `ssh-ed25519` 或 `ssh-rsa` 开头）

### 步骤 4：添加到 GitHub

1. **登录 GitHub**
   - 访问：https://github.com/settings/keys

2. **添加 SSH 密钥**
   - 点击 `New SSH key`
   - **Title**: `My Computer`（自定义名称）
   - **Key**: 粘贴刚才复制的公钥
   - 点击 `Add SSH key`

3. **验证连接**
   ```bash
   ssh -T git@github.com
   ```
   - 输入 `yes` 确认
   - 应该看到：`Hi 你的用户名! You've successfully authenticated...`

### 步骤 5：使用 SSH 地址

```bash
# 如果之前使用 HTTPS，改为 SSH
git remote set-url origin git@github.com:你的用户名/仓库名.git

# 验证
git remote -v
```

---

## 📝 完整配置示例

### 最小配置（必需）

```bash
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的邮箱@example.com"
```

### 推荐配置（完整）

```bash
# 基本信息
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的邮箱@example.com"

# 编辑器
git config --global core.editor "code --wait"

# 默认分支
git config --global init.defaultBranch main

# 行尾符（Windows）
git config --global core.autocrlf true

# 颜色输出
git config --global color.ui auto

# 推送行为
git config --global push.default simple

# 凭证存储（Windows）
git config --global credential.helper manager-core

# 别名
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
```

---

## 🔍 常见问题

### 问题 1：Git 命令找不到

**原因**：Git 未安装或未添加到 PATH

**解决方法**：
1. 确认 Git 已安装：访问 https://git-scm.com/download/win
2. 重新安装，确保勾选 "Add to PATH"
3. 重启终端/PowerShell

### 问题 2：配置错误

**查看配置**：
```bash
git config --list
```

**删除错误配置**：
```bash
# 删除全局配置
git config --global --unset user.name
git config --global --unset user.email

# 重新配置
git config --global user.name "正确的用户名"
git config --global user.email "正确的邮箱"
```

### 问题 3：每次推送都要输入密码

**解决方法**：
1. 配置 SSH 密钥（见上方）
2. 或使用个人访问令牌（GitHub）

### 问题 4：中文乱码

```bash
# 配置 Git 支持中文
git config --global core.quotepath false
git config --global gui.encoding utf-8
git config --global i18n.commitencoding utf-8
git config --global i18n.logoutputencoding utf-8
```

---

## ✅ 配置检查清单

配置完成后，确认：

- [ ] Git 已安装（`git --version` 有输出）
- [ ] 用户名已配置（`git config user.name` 有输出）
- [ ] 邮箱已配置（`git config user.email` 有输出）
- [ ] 可以正常使用 Git 命令
- [ ] （可选）SSH 密钥已配置并添加到 GitHub

---

## 📚 下一步

配置完成后，可以：

1. **初始化 Git 仓库**：
   ```bash
   git init
   ```

2. **查看完整部署指南**：
   参考 `完整部署指南.md` 中的 "GitHub 代码管理" 部分

3. **开始使用 Git**：
   - 添加文件：`git add .`
   - 提交：`git commit -m "描述"`
   - 推送：`git push`

---

**配置完成后，你就可以开始使用 Git 管理代码了！** 🎉

