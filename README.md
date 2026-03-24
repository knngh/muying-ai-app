# 母婴AI助手 (Muying AI App)

专为孕妇和新手妈妈打造的全栈 AI 健康助手，提供智能问答、孕育日历、知识库、社区交流等一站式母婴服务。

## 技术架构

```
┌─────────────────────────────────────────────────┐
│                    Nginx                        │
│              (反向代理 + SPA)                    │
├────────────────────┬────────────────────────────┤
│     Frontend       │         Backend            │
│   React + Vite     │      Express.js            │
│   Port: 3000       │      Port: 3000            │
├────────────────────┼────────────────────────────┤
│                    │        MySQL                │
│                    │      (Prisma ORM)           │
└────────────────────┴────────────────────────────┘
```

### 后端技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Express.js 4 + TypeScript 5 |
| ORM | Prisma 5 (MySQL) |
| 认证 | JWT (jsonwebtoken) + bcrypt |
| AI | RAG 增强问答 + SSE 流式响应 |
| 安全 | Helmet + CORS + Rate Limiting |
| 缓存 | 内存缓存 (LRU, TTL) |
| 验证 | Zod |

### 前端技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 18 + TypeScript 5 |
| 构建 | Vite 5 |
| UI | Ant Design 5 |
| 状态管理 | Zustand |
| 路由 | React Router v6 |
| HTTP | Axios (拦截器 + 401 自动刷新) |

## 功能模块

### AI 智能问答
- RAG 增强回答（知识库 5000+ QA 对）
- 支持流式响应 (SSE) 和非流式模式
- 紧急关键词检测（出血、破水、昏迷等），自动触发急救警告
- 多模型支持（GLM-4、Gemini、GPT-4o、DeepSeek）
- 医疗免责声明

### 知识库
- 文章浏览、全文搜索、分类/标签/阶段过滤
- 文章详情（按 slug 访问）、点赞/收藏
- 阅读历史追踪
- 服务端缓存（热门文章 5 分钟 TTL）

### 孕育日历
- 周视图/日视图日历
- 事件 CRUD（产检、疫苗、提醒、运动、饮食等）
- 拖拽更新、批量操作
- 事件提醒设置

### 社区交流
- 帖子发布（支持匿名）、编辑、删除
- 评论/回复（支持嵌套评论）
- 点赞/取消点赞（防重复）
- 分类筛选、排序（最新/最热/最多赞）
- 置顶、精选帖子

### 用户系统
- 用户名 + 密码注册/登录（支持手机号/邮箱作为登录名）
- JWT 认证 + Token 自动刷新（401 队列模式）
- 个人资料管理（昵称、孕期状态、预产期、宝宝信息）
- 收藏、阅读历史、用户统计

## 项目结构

```
muying-ai-app/
├── src/                          # 后端源码
│   ├── app.ts                    # Express 入口 + 中间件 + 路由挂载 + 优雅关机
│   ├── config/                   # 配置
│   │   ├── env.ts                # 环境变量集中管理 + 启动校验
│   │   └── database.ts           # PrismaClient 全局单例
│   ├── controllers/              # 控制器
│   │   ├── auth.controller.ts    # 认证（注册/登录/刷新Token/资料管理）
│   │   ├── ai.controller.ts      # AI 问答（单轮/多轮/流式）
│   │   ├── article.controller.ts # 文章（列表/详情/搜索/点赞/收藏）
│   │   ├── calendar.controller.ts# 日历事件 CRUD
│   │   ├── community.controller.ts# 社区帖子/评论
│   │   ├── category.controller.ts# 分类管理
│   │   ├── tag.controller.ts     # 标签管理
│   │   ├── user.controller.ts    # 用户收藏/阅读历史/统计
│   │   ├── vaccine.controller.ts # 疫苗信息
│   │   └── wechat.controller.ts  # 微信登录
│   ├── schemas/                  # Zod 输入校验 Schema
│   │   ├── common.schema.ts      # 通用分页/ID/slug 校验
│   │   ├── auth.schema.ts        # 注册/登录/改密码
│   │   ├── article.schema.ts     # 文章列表/搜索
│   │   ├── calendar.schema.ts    # 日历事件
│   │   ├── community.schema.ts   # 社区帖子/评论
│   │   └── ai.schema.ts          # AI 问答/反馈
│   ├── routes/                   # 路由定义（RESTful + 校验中间件）
│   ├── middlewares/              # 中间件
│   │   ├── auth.middleware.ts    # JWT 验证 + 可选认证
│   │   ├── error.middleware.ts   # 统一错误处理 + 响应格式 + 错误追踪ID
│   │   ├── rateLimiter.middleware.ts # 分级速率限制
│   │   └── validate.middleware.ts# Zod 统一输入校验
│   ├── services/                 # 业务服务
│   │   ├── ai-gateway.service.ts # AI 网关（多模型 + 流式 + buffer 限制）
│   │   ├── knowledge.service.ts  # 知识库（5000 QA 检索）
│   │   ├── rag.service.ts        # RAG 增强服务
│   │   ├── cache.service.ts      # 内存缓存（LRU + TTL）
│   │   └── websocket.service.ts  # WebSocket（小程序/App 流式对话）
│   ├── types/                    # 类型定义
│   │   └── enums.ts              # 业务枚举（Gender/PregnancyStatus/...）
│   └── utils/                    # 工具函数
│       ├── pregnancy.ts          # 孕期计算
│       └── ownership.ts          # 资源所有权校验
├── frontend/                     # 前端源码
│   ├── src/
│   │   ├── api/                  # API 客户端
│   │   │   ├── index.ts          # Axios 实例 + 拦截器 + Token 刷新（Promise 锁）
│   │   │   ├── modules.ts        # 文章/日历/用户/认证 API
│   │   │   ├── community.ts      # 社区 API
│   │   │   └── ai.ts             # AI 问答 API + 紧急检测
│   │   ├── stores/               # Zustand 状态管理
│   │   ├── pages/                # 页面组件
│   │   ├── components/           # 公共组件
│   │   │   ├── Layout/           # 导航布局
│   │   │   ├── ErrorBoundary.tsx # 全局错误边界（防白屏）
│   │   │   └── ChatMessage/      # 聊天消息
│   │   ├── utils/
│   │   │   └── storage.ts        # 安全 localStorage 封装
│   │   └── App.tsx               # 路由配置 + 路由守卫 + ErrorBoundary
│   └── vite.config.ts
├── prisma/
│   └── schema.prisma             # 数据库模型（16 张表）
├── data/
│   └── expanded-qa-data-5000.json # AI 知识库数据
├── docs/
│   └── REMEDIATION-PLAN.md       # 安全整改方案
├── Dockerfile                    # 后端 Docker 镜像
└── .env.example                  # 环境变量模板
```

## API 接口

所有接口前缀: `/api/v1`

### 认证 `/auth`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/register` | - | 用户注册 |
| POST | `/login` | - | 登录（支持 username/phone/email） |
| POST | `/refresh` | Bearer | 刷新 Token |
| GET | `/me` | Bearer | 获取当前用户 |
| PUT | `/profile` | Bearer | 更新资料 |
| PUT | `/password` | Bearer | 修改密码 |

### 文章 `/articles`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/` | - | 文章列表（分页/筛选/排序） |
| GET | `/search` | - | 全文搜索 |
| GET | `/:slug` | - | 文章详情 |
| POST | `/:id/like` | Bearer | 点赞 |
| POST | `/:id/favorite` | Bearer | 收藏 |

### AI `/ai`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/ask` | Bearer | 单轮问答 |
| POST | `/ask/stream` | Bearer | 单轮流式 |
| POST | `/chat` | Bearer | 多轮对话 |
| POST | `/chat/stream` | Bearer | 多轮流式 |

### 日历 `/calendar`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/events` | Bearer | 事件列表 |
| GET | `/week` | Bearer | 周视图 |
| POST | `/events` | Bearer | 创建事件 |
| PUT | `/events/:id` | Bearer | 更新事件 |
| DELETE | `/events/:id` | Bearer | 删除事件 |
| POST | `/events/:id/complete` | Bearer | 标记完成 |

### 社区 `/community`

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/posts` | 可选 | 帖子列表 |
| GET | `/posts/:id` | 可选 | 帖子详情 |
| POST | `/posts` | Bearer | 发帖 |
| POST | `/posts/:id/like` | Bearer | 点赞 |
| GET | `/posts/:postId/comments` | - | 评论列表 |
| POST | `/posts/:postId/comments` | Bearer | 发评论 |

### 统一响应格式

```json
// 成功
{ "code": 0, "message": "success", "data": { ... } }

// 分页
{ "code": 0, "message": "success", "data": { "list": [...], "pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 } } }

// 错误
{ "code": 2001, "message": "用户不存在" }
```

## 快速开始

### 环境要求

- Node.js >= 18
- MySQL 8.0+
- npm >= 9

### 1. 克隆项目

```bash
git clone https://github.com/knngh/muying-ai-app.git
cd muying-ai-app
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
DATABASE_URL="mysql://user:password@localhost:3306/muying_web"
JWT_SECRET=your-secure-jwt-secret
CORS_ORIGIN=http://localhost:3000
```

### 3. 启动后端

```bash
# 安装依赖
npm install

# 生成 Prisma Client
npx prisma generate

# 创建数据库表
npx prisma db push

# 启动开发服务器
npm run dev
```

后端运行在 http://localhost:3000

### 4. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端运行在 http://localhost:3000（Vite 开发服务器）

### 5. 构建生产版本

```bash
# 后端
npm run build

# 前端
cd frontend && npm run build
```

## Docker 部署

```bash
# 构建后端镜像
docker build -t muying-backend .

# 运行
docker run -p 3000:3000 \
  -e DATABASE_URL="mysql://..." \
  -e JWT_SECRET="your-secret" \
  muying-backend
```

## 数据库模型

Prisma 定义了 16 张核心表：

| 模型 | 说明 |
|------|------|
| User | 用户（孕期状态、宝宝信息） |
| Article | 文章（分类、标签、医学验证） |
| Category | 分类（树形结构） |
| Tag | 标签 |
| CalendarEvent | 日历事件（6种类型、提醒） |
| Vaccine | 疫苗信息 |
| CommunityPost | 社区帖子（匿名、置顶） |
| CommunityComment | 评论（嵌套回复） |
| CommunityPostLike | 帖子点赞 |
| UserFavorite | 用户收藏 |
| UserReadHistory | 阅读历史 |
| UserLike | 文章点赞 |
| SearchLog | 搜索日志 |

## 安全策略

- **环境变量校验**: 启动时强制校验 `JWT_SECRET`、`DATABASE_URL`，缺失则拒绝启动
- **认证**: JWT Bearer Token，7 天过期，支持自动刷新
- **密码**: bcrypt 加密（10 轮 salt）
- **输入验证**: 全端点 Zod Schema 校验（分页上限 100、请求体上限 1MB）
- **速率限制**: 认证 20次/15分钟、AI 10次/分钟、用户枚举检查 10次/15分钟
- **安全头**: Helmet（XSS、CSRF、Clickjacking 防护）
- **权限控制**: 资源所有权校验，事件更新字段白名单，帖子/评论仅作者可编辑删除
- **数据库**: PrismaClient 全局单例，唯一约束防竞态注册
- **软删除**: 帖子和评论使用 deletedAt 软删除
- **错误处理**: 统一响应格式，生产环境错误 ID 追踪（不泄露堆栈）
- **运维**: SIGTERM/SIGINT 优雅关机，健康检查覆盖数据库连通性，SSE buffer 512KB 上限
- **前端**: ErrorBoundary 防白屏，Token 刷新 Promise 锁防竞态，安全 localStorage 封装

## 开发规范

- TypeScript strict mode
- RESTful API 设计
- 统一错误码体系（1xxx 参数、2xxx 用户、3xxx 内容、4xxx 权限、5xxx 服务器）
- Zod Schema 集中定义于 `src/schemas/`，路由层统一挂载校验
- 响应拦截器自动解包 `{ code, data }` 格式
- ESLint + Prettier 代码规范
- 函数式组件 + Hooks + Zustand

## License

MIT
