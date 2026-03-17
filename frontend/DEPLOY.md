# 前端部署指南

## 项目信息

- **项目名称**: 母婴AI助手前端
- **技术栈**: React 18 + Vite 5 + TypeScript
- **部署路径**: `hiclaw/hiclaw-storage/shared/deploy/frontend/`

## 部署步骤

### 1. 从 MinIO 下载代码

```bash
mc mirror hiclaw/hiclaw-storage/shared/deploy/frontend/ ./frontend/ --overwrite
cd frontend
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

创建 `.env.production` 文件：

```
VITE_API_BASE_URL=http://212.64.29.211/api
```

### 4. 构建生产版本

```bash
npm run build
```

构建后的文件在 `dist/` 目录。

### 5. 部署到服务器

#### 方式一：宝塔面板

1. 登录宝塔面板（212.64.29.211:11156/ad5ffab7）
2. 进入网站管理
3. 找到前端站点
4. 删除旧版静态文件
5. 上传 `dist/` 目录内容
6. 配置 Nginx：
   ```nginx
   server {
       listen 80;
       server_name 212.64.29.211;
       
       root /www/wwwroot/frontend;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       location /api {
           proxy_pass http://localhost:3000/api;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

#### 方式二：命令行

```bash
# 上传 dist 目录
scp -r dist/* root@212.64.29.211:/www/wwwroot/frontend/
```

### 6. 验证部署

- 前端访问: http://212.64.29.211
- API 健康检查: http://212.64.29.211/api/health

## 功能检查清单

- [ ] 首页正常显示
- [ ] 知识库页面可浏览
- [ ] 日历页面正常
- [ ] AI 问答页面可访问
- [ ] API 请求正常

## 注意事项

1. 确保 `.env` 文件中 `VITE_API_BASE_URL` 指向正确的后端 API 地址
2. 确保 Nginx 配置了 SPA 路由回退（`try_files $uri $uri/ /index.html`）
3. 确保后端 API 已启动并监听 3000 端口

## 功能列表

### 已实现功能

| 功能 | 路由 | 描述 |
|------|------|------|
| 首页 | `/` | 功能导航、推荐文章 |
| AI问答 | `/chat` | AI智能问答、紧急检测、免责声明 |
| 知识库 | `/knowledge` | 文章列表、分类筛选、搜索 |
| 文章详情 | `/knowledge/:id` | 文章内容、点赞收藏 |
| 日历 | `/calendar` | 孕期日历、事件管理 |
| 个人中心 | `/profile` | 用户信息 |

### 特殊功能

- **紧急关键词检测**: 自动检测出血、疼痛、昏迷等紧急关键词，显示"请立即就医"提示
- **免责声明**: 每个页面展示免责声明
- **响应式设计**: 支持移动端访问