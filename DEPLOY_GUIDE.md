# 🚀 YiQingBili 1.0 部署指南

## 📋 目录
1. [腾讯云域名部署](#腾讯云域名部署)
2. [微信小程序接入](#微信小程序接入)
3. [常见问题](#常见问题)

---

## 🌐 腾讯云域名部署

### 方案一：腾讯云 Serverless（推荐，免费额度）

#### 1. 准备工作
- 腾讯云账号（实名认证）
- 已备案的域名（或使用腾讯云提供的免费域名）
- Node.js 16+ 环境

#### 2. 部署步骤

**步骤1：安装 Serverless Framework**
```bash
npm install -g serverless
```

**步骤2：登录腾讯云**
```bash
serverless login
```

**步骤3：创建 serverless.yml 配置文件**
在项目根目录创建 `serverless.yml`：

```yaml
component: scf
name: yiqingbili
inputs:
  name: yiqingbili
  runtime: Nodejs16.13
  region: ap-guangzhou
  handler: index.handler
  memorySize: 512
  timeout: 60
  environment:
    variables:
      NODE_ENV: production
  events:
    - apigw:
        parameters:
          protocols:
            - https
            - http
          serviceName: yiqingbili-api
          description: YiQingBili API Gateway
          environment: release
          endpoints:
            - path: /
              method: ANY
            - path: /{proxy+}
              method: ANY
```

**步骤4：创建入口文件**
创建 `index.js`（用于 Serverless）：

```javascript
const express = require('express');
const app = require('./server');

// Serverless 入口
exports.handler = async (event, context) => {
    // 将 API Gateway 事件转换为 Express 请求
    const { httpMethod, path, headers, queryStringParameters, body } = event;
    
    return new Promise((resolve) => {
        const req = {
            method: httpMethod,
            url: path,
            headers: headers || {},
            query: queryStringParameters || {},
            body: body ? JSON.parse(body) : {}
        };
        
        const res = {
            statusCode: 200,
            headers: {},
            body: '',
            setHeader: (key, value) => { res.headers[key] = value; },
            status: (code) => { res.statusCode = code; return res; },
            json: (data) => { res.body = JSON.stringify(data); resolve(res); },
            send: (data) => { res.body = data; resolve(res); }
        };
        
        app(req, res, () => {
            resolve(res);
        });
    });
};
```

**步骤5：部署**
```bash
serverless deploy
```

**步骤6：绑定域名**
1. 登录 [腾讯云 API Gateway 控制台](https://console.cloud.tencent.com/apigateway)
2. 找到创建的服务
3. 进入"自定义域名" → "添加域名"
4. 输入你的域名（如：bili.yourdomain.com）
5. 配置 SSL 证书（可使用腾讯云免费证书）
6. 配置 CNAME 解析

---

### 方案二：腾讯云 CVM（云服务器）

#### 1. 购买服务器
- 推荐配置：2核4G，带宽5M
- 系统：Ubuntu 20.04 或 CentOS 7

#### 2. 服务器配置

**连接服务器**
```bash
ssh root@your_server_ip
```

**安装 Node.js**
```bash
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS
curl -fsSL https://rpm.nodesource.com/setup_16.x | sudo bash -
sudo yum install -y nodejs
```

**安装 PM2（进程管理）**
```bash
npm install -g pm2
```

**安装 Nginx**
```bash
# Ubuntu
sudo apt-get update
sudo apt-get install -y nginx

# CentOS
sudo yum install -y nginx
```

#### 3. 部署应用

**上传代码到服务器**
```bash
# 在本地打包
git clone https://github.com/YiQing-House/bilibili-parser.git
cd bilibili-parser
npm install --production

# 上传到服务器（使用 scp 或 FTP）
scp -r . root@your_server_ip:/var/www/yiqingbili
```

**在服务器上启动**
```bash
cd /var/www/yiqingbili
npm install --production
pm2 start server.js --name yiqingbili
pm2 save
pm2 startup
```

#### 4. 配置 Nginx

创建配置文件 `/etc/nginx/sites-available/yiqingbili`：

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL 证书路径（使用腾讯云免费证书）
    ssl_certificate /etc/nginx/ssl/yourdomain.com.crt;
    ssl_certificate_key /etc/nginx/ssl/yourdomain.com.key;
    
    # SSL 配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 日志
    access_log /var/log/nginx/yiqingbili_access.log;
    error_log /var/log/nginx/yiqingbili_error.log;

    # 静态文件
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**启用配置**
```bash
sudo ln -s /etc/nginx/sites-available/yiqingbili /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. 配置域名解析

在腾讯云 DNS 解析控制台：
1. 添加 A 记录：`@` → 服务器IP
2. 添加 A 记录：`www` → 服务器IP
3. 等待解析生效（通常几分钟）

#### 6. 配置 SSL 证书

1. 登录 [腾讯云 SSL 证书控制台](https://console.cloud.tencent.com/ssl)
2. 申请免费证书（TrustAsia 或 Let's Encrypt）
3. 下载证书文件
4. 上传到服务器 `/etc/nginx/ssl/`
5. 重启 Nginx

---

## 📱 微信小程序接入

### 方案一：WebView 嵌入（最简单）

#### 1. 创建小程序项目

在微信开发者工具中创建新项目，选择"小程序"。

#### 2. 配置合法域名

在 `project.config.json` 或小程序后台配置：

```json
{
  "networkTimeout": {
    "request": 60000,
    "downloadFile": 60000
  }
}
```

在小程序后台 → 开发 → 开发管理 → 开发设置 → 服务器域名：
- **request合法域名**：添加你的域名（如：https://bili.yourdomain.com）
- **downloadFile合法域名**：添加你的域名

#### 3. 创建页面

**pages/webview/webview.wxml**
```xml
<web-view src="{{url}}"></web-view>
```

**pages/webview/webview.js**
```javascript
Page({
  data: {
    url: 'https://bili.yourdomain.com' // 你的网站地址
  },
  
  onLoad(options) {
    // 可以传递参数
    if (options.url) {
      this.setData({
        url: decodeURIComponent(options.url)
      });
    }
  }
});
```

**pages/webview/webview.json**
```json
{
  "navigationBarTitleText": "B站解析助手",
  "navigationBarBackgroundColor": "#FB7299",
  "navigationBarTextStyle": "white"
}
```

#### 4. 配置路由

在 `app.json` 中添加：

```json
{
  "pages": [
    "pages/index/index",
    "pages/webview/webview"
  ],
  "window": {
    "navigationBarTitleText": "YiQingBili",
    "navigationBarBackgroundColor": "#FB7299",
    "navigationBarTextStyle": "white"
  }
}
```

---

### 方案二：原生小程序开发（推荐，体验更好）

#### 1. 项目结构

```
miniprogram/
├── pages/
│   ├── index/          # 首页
│   ├── parse/          # 解析页面
│   └── download/       # 下载页面
├── utils/
│   └── api.js          # API 封装
├── app.js
├── app.json
└── app.wxss
```

#### 2. API 封装

**utils/api.js**
```javascript
const API_BASE = 'https://bili.yourdomain.com'; // 你的域名

// 解析视频
function parseVideo(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}/api/parse`,
      method: 'POST',
      data: { url },
      header: {
        'content-type': 'application/json'
      },
      success: (res) => {
        if (res.data.success) {
          resolve(res.data.data);
        } else {
          reject(new Error(res.data.error));
        }
      },
      fail: reject
    });
  });
}

// 下载视频
function downloadVideo(url, qn, format) {
  return new Promise((resolve, reject) => {
    wx.downloadFile({
      url: `${API_BASE}/api/bilibili/download?url=${encodeURIComponent(url)}&qn=${qn}&format=${format}`,
      success: (res) => {
        if (res.statusCode === 200) {
          // 保存到相册
          wx.saveVideoToPhotosAlbum({
            filePath: res.tempFilePath,
            success: resolve,
            fail: reject
          });
        } else {
          reject(new Error('下载失败'));
        }
      },
      fail: reject
    });
  });
}

module.exports = {
  parseVideo,
  downloadVideo
};
```

#### 3. 解析页面

**pages/parse/parse.wxml**
```xml
<view class="container">
  <view class="input-section">
    <input 
      class="url-input" 
      placeholder="粘贴B站视频链接" 
      bindinput="onInput"
      value="{{videoUrl}}"
    />
    <button class="parse-btn" bindtap="handleParse">解析</button>
  </view>
  
  <view class="result-section" wx:if="{{videoInfo}}">
    <image class="cover" src="{{videoInfo.thumbnail}}" />
    <view class="info">
      <text class="title">{{videoInfo.title}}</text>
      <text class="author">{{videoInfo.author}}</text>
    </view>
    
    <view class="quality-section">
      <text class="label">选择画质：</text>
      <view class="quality-list">
        <view 
          class="quality-item {{selectedQuality === item.qn ? 'active' : ''}}"
          wx:for="{{videoInfo.downloadLinks}}" 
          wx:key="qn"
          bindtap="selectQuality"
          data-qn="{{item.qn}}"
        >
          {{item.quality}}
        </view>
      </view>
    </view>
    
    <button class="download-btn" bindtap="handleDownload">下载视频</button>
  </view>
</view>
```

**pages/parse/parse.js**
```javascript
const api = require('../../utils/api');

Page({
  data: {
    videoUrl: '',
    videoInfo: null,
    selectedQuality: 80
  },
  
  onInput(e) {
    this.setData({
      videoUrl: e.detail.value
    });
  },
  
  async handleParse() {
    if (!this.data.videoUrl) {
      wx.showToast({
        title: '请输入视频链接',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '解析中...'
    });
    
    try {
      const videoInfo = await api.parseVideo(this.data.videoUrl);
      this.setData({
        videoInfo,
        selectedQuality: videoInfo.downloadLinks[0]?.qn || 80
      });
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '解析失败',
        icon: 'none'
      });
    }
  },
  
  selectQuality(e) {
    this.setData({
      selectedQuality: e.currentTarget.dataset.qn
    });
  },
  
  async handleDownload() {
    if (!this.data.videoInfo) return;
    
    wx.showLoading({
      title: '下载中...'
    });
    
    try {
      await api.downloadVideo(
        this.data.videoUrl,
        this.data.selectedQuality,
        'mp4'
      );
      wx.hideLoading();
      wx.showToast({
        title: '下载成功',
        icon: 'success'
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: error.message || '下载失败',
        icon: 'none'
      });
    }
  }
});
```

#### 4. 配置权限

在 `app.json` 中添加：

```json
{
  "permission": {
    "scope.writePhotosAlbum": {
      "desc": "保存视频到相册"
    }
  }
}
```

#### 5. 小程序发布

1. 在微信开发者工具中点击"上传"
2. 登录 [微信公众平台](https://mp.weixin.qq.com)
3. 版本管理 → 开发版本 → 提交审核
4. 填写审核信息
5. 等待审核通过后发布

---

## ❓ 常见问题

### Q1: 域名需要备案吗？
**A:** 
- 使用腾讯云 CVM：必须备案
- 使用 Serverless：如果只使用 API Gateway，可以不备案；如果绑定自定义域名，需要备案

### Q2: 小程序审核不通过怎么办？
**A:** 
- 确保功能符合小程序规范
- 不要涉及视频播放（只能下载）
- 添加用户协议和隐私政策
- 确保域名已备案且配置合法域名

### Q3: 如何提高下载速度？
**A:**
- 使用 CDN 加速静态资源
- 服务器选择离用户近的区域
- 增加服务器带宽
- 使用腾讯云 COS 存储

### Q4: 如何监控服务器状态？
**A:**
- 使用 PM2 监控：`pm2 monit`
- 配置腾讯云云监控
- 使用日志服务查看错误

---

## 📞 技术支持

如有问题，请提交 Issue：
https://github.com/YiQing-House/bilibili-parser/issues

---

**祝部署顺利！🎉**

