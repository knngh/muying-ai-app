# 后端 API 部署教程

本文档介绍如何在宝塔上部署 Node.js 后端服务，实现前后端分离架构。

---

## 一、项目结构

```
muying-ai-app/
├── server/                 # 后端服务
│   ├── src/
│   │   ├── index.js       # 主入口
│   │   └── routes/        # API 路由
│   │       ├── calendar.js
│   │       ├── qa.js
│   │       └── recommend.js
│   └── package.json
├── dist/                  # 前端构建产物
│   └── build/h5/
└── .env.production        # 生产环境配置
```

---

## 二、本地开发

### 2.1 启动后端服务

```bash
cd server
npm install
npm run dev
```

后端服务启动在 `http://localhost:3000`

### 2.2 启动前端开发

```bash
npm run dev
```

前端开发在 `http://localhost:5173`

---

## 三、宝塔部署后端

### 3.1 安装 Node.js

在宝塔面板中：

1. **软件商店** → 搜索 **Node.js** → 安装
2. 或者通过 SSH 安装：

```bash
# 使用 nvm 安装
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# 验证
node -v
npm -v
```

### 3.2 上传后端代码

方式 A：通过宝塔文件管理器上传 `server` 目录

方式 B：通过 Git 克隆：

```bash
cd /www/wwwroot
git clone <你的仓库地址> muying-ai-app
cd muying-ai-app/server
npm install
```

### 3.3 使用 PM2 管理进程

安装 PM2：

```bash
npm install -g pm2
```

启动服务：

```bash
cd /www/wwwroot/muying-ai-app/server
pm start src/index.js --name muying-ai-api
```

常用命令：

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs muying-ai-api

# 重启
pm2 restart muying-ai-api

# 停止
pm2 stop muying-ai-api
```

### 3.4 配置 Nginx 反向代理

在宝塔面板中：

1. **网站** → 添加站点（如 `api.xxx.com`）
2. **设置** → **配置文件**

添加反向代理配置：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_bypass $http_upgrade;
    
    # CORS 头（允许小程序请求）
    add_header Access-Control-Allow-Origin $http_origin always;
    add_header Access-Control-Allow-Credentials true always;
}
```

### 3.5 配置 SSL 证书

1. **网站** → **SSL** → **Let's Encrypt**
2. 申请域名证书
3. 开启强制 HTTPS

---

## 四、修改前端配置

### 4.1 修改生产环境配置

编辑 `.env.production`：

```bash
# 替换为你的实际域名
VITE_API_BASE=https://api.xxx.com
VITE_H5_URL=https://h5.xxx.com
```

### 4.2 修改 web-view 地址

编辑 `src/pages/webview/webview.vue`：

```javascript
url: 'https://h5.xxx.com'  // 替换为你的 H5 域名
```

### 4.3 重新构建前端

```bash
npm run build:h5
```

### 4.4 上传前端构建产物

将 `dist/build/h5` 目录内容上传到 H5 站点根目录。

---

## 五、微信小程序配置

### 5.1 配置 request 合法域名

在微信公众平台：

1. **设置与开发** → **开发管理** → **开发设置**
2. 找到 **服务器域名**
3. 在 **request 合法域名** 中添加：
   - `https://api.xxx.com`（后端 API 域名）

### 5.2 配置业务域名

如果使用 web-view 嵌入 H5：

1. 在 **业务域名** 中添加：
   - `https://h5.xxx.com`（H5 前端域名）

### 5.3 下载验证文件

微信会提供验证文件（如 `MP_verify_xxxx.txt`），上传到 H5 站点根目录。

---

## 六、验证部署

### 6.1 测试 API

```bash
# 测试日历 API
curl https://api.xxx.com/api/calendar

# 测试问答 API
curl -X POST https://api.xxx.com/api/qa \
  -H "Content-Type: application/json" \
  -d '{"question":"宝宝发烧怎么办"}'

# 测试推荐 API
curl https://api.xxx.com/api/recommend
```

### 6.2 测试 H5 页面

在浏览器中访问：`https://h5.xxx.com`

### 6.3 在小程序中测试

1. 在微信开发者工具中刷新
2. 检查是否能正常获取数据

---

## 七、常见问题

### 1. 小程序请求失败

- 检查是否配置了 request 合法域名
- 检查是否使用 HTTPS
- 检查 SSL 证书是否有效

### 2. API 返回 502

- 检查 PM2 进程是否运行
- 检查端口是否被占用
- 查看 PM2 日志：`pm2 logs muying-ai-api`

### 3. CORS 错误

确保 Nginx 配置了正确的 CORS 头：

```nginx
add_header Access-Control-Allow-Origin $http_origin always;
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
add_header Access-Control-Allow-Headers "Content-Type" always;
```

### 4. 宝塔防火墙

确保在宝塔和云服务器安全组中开放端口：
- 443（HTTPS）
- 3000（Node.js 后端，可只对内开放）

---

## 八、目录权限

确保目录权限正确：

```bash
chown -R www:www /www/wwwroot/muying-ai-app/server
chmod -R 755 /www/wwwroot/muying-ai-app/server
```

---

## 九、自动启动（开机自启）

创建启动脚本：

```bash
pm2 startup
pm2 save
```

这样服务器重启后会自动启动后端服务。
