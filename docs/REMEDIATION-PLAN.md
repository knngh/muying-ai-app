# muying-ai-app 整改推进计划方案

> 基于 2026-03-24 全面审查结果制定，共识别 33 项问题，分 4 个阶段推进。

---

## 一、整改总览

| 阶段 | 主题 | 问题数 | 预计工期 | 优先级 |
|------|------|--------|----------|--------|
| 第一阶段 | 安全加固 & 关键缺陷 | 8 项 | 3 天 | P0 紧急 |
| 第二阶段 | 健壮性 & 数据层优化 | 10 项 | 5 天 | P1 重要 |
| 第三阶段 | 前端加固 & 测试补全 | 8 项 | 5 天 | P2 必要 |
| 第四阶段 | 架构升级 & 运维完善 | 7 项 | 5 天 | P3 增强 |

---

## 二、第一阶段：安全加固 & 关键缺陷（P0 紧急，3 天）

> 目标：消除所有可能被直接利用的安全漏洞，阻止越权访问和数据泄露。

### 任务 1.1 环境变量安全校验

**问题**：JWT_SECRET 存在 `'default-secret'` 硬编码回退，启动时不校验必需变量。

**改动文件**：
- `src/app.ts` — 新增启动校验逻辑
- `src/middlewares/auth.middleware.ts` — 移除回退值
- `src/controllers/auth.controller.ts` — 移除回退值
- `src/services/websocket.service.ts` — 移除回退值

**具体方案**：
```typescript
// src/config/env.ts（新建）
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'] as const;

export function validateEnv() {
  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`缺少必需环境变量: ${missing.join(', ')}`);
    process.exit(1);
  }
}

export const env = {
  get JWT_SECRET(): string { return process.env.JWT_SECRET!; },
  get DATABASE_URL(): string { return process.env.DATABASE_URL!; },
  get PORT(): number { return Number(process.env.PORT) || 3000; },
  get NODE_ENV(): string { return process.env.NODE_ENV || 'development'; },
  get CORS_ORIGIN(): string { return process.env.CORS_ORIGIN || 'http://localhost:5173'; },
} as const;
```

```typescript
// src/app.ts 入口处
import { validateEnv, env } from './config/env';
validateEnv(); // 校验不通过直接退出

// 所有引用 process.env.JWT_SECRET 的地方改为 env.JWT_SECRET
```

**验收标准**：未设置 JWT_SECRET 时服务拒绝启动，无任何硬编码密钥回退。

---

### 任务 1.2 资源所有权校验（防越权）

**问题**：删除收藏/点赞、修改日历事件等操作未校验资源归属。

**改动文件**：
- `src/controllers/article.controller.ts` — like/favorite 操作
- `src/controllers/calendar.controller.ts` — update/delete 事件
- `src/controllers/community.controller.ts` — delete 帖子/评论
- `src/controllers/user.controller.ts` — 收藏删除

**具体方案**：
```typescript
// 新增通用所有权校验工具函数 src/utils/ownership.ts
import { AppError, ErrorCodes } from '../middlewares/error.middleware';

export function assertOwnership(resourceUserId: string, requestUserId: string) {
  if (resourceUserId !== requestUserId) {
    throw new AppError('无权操作此资源', ErrorCodes.FORBIDDEN, 403);
  }
}
```

在每个 update/delete 操作中：
```typescript
// 示例：calendar.controller.ts
const event = await prisma.calendarEvent.findUnique({ where: { id } });
if (!event) throw new AppError('事件不存在', ErrorCodes.NOT_FOUND, 404);
assertOwnership(event.userId, req.userId!);
// 然后执行 update/delete
```

**验收标准**：用户 A 无法修改/删除用户 B 的任何资源，返回 403。

---

### 任务 1.3 统一输入校验中间件

**问题**：zod 已安装但未使用，多数端点无输入校验。

**改动文件**：
- `src/middlewares/validate.middleware.ts`（新建）
- `src/schemas/`（新建目录，各模块 schema）
- 所有 route 文件 — 挂载校验中间件

**具体方案**：
```typescript
// src/middlewares/validate.middleware.ts（新建）
import { ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCodes } from './error.middleware';

export function validate(schema: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.query) req.query = schema.query.parse(req.query) as any;
      if (schema.params) req.params = schema.params.parse(req.params) as any;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`);
        next(new AppError(messages.join('; '), ErrorCodes.PARAM_ERROR, 400));
      } else {
        next(err);
      }
    }
  };
}
```

```typescript
// src/schemas/common.ts — 通用分页 schema
import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
```

```typescript
// src/schemas/auth.schema.ts
import { z } from 'zod';

export const registerSchema = z.object({
  username: z.string().min(2).max(20),
  password: z.string().min(8).max(64)
    .regex(/[A-Z]/, '需包含大写字母')
    .regex(/[0-9]/, '需包含数字')
    .regex(/[^A-Za-z0-9]/, '需包含特殊字符'),
  phone: z.string().regex(/^1[3-9]\d{9}$/, '手机号格式错误').optional(),
  email: z.string().email('邮箱格式错误').optional(),
});

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
```

```typescript
// src/schemas/calendar.schema.ts
export const createEventSchema = z.object({
  title: z.string().min(1).max(100),
  date: z.string().datetime(),
  type: z.enum(['checkup', 'vaccine', 'reminder', 'custom']),
  description: z.string().max(500).optional(),
});
```

路由挂载示例：
```typescript
// src/routes/auth.routes.ts
router.post('/register', authRateLimiter, validate({ body: registerSchema }), register);
router.post('/login', authRateLimiter, validate({ body: loginSchema }), login);
```

**验收标准**：所有端点入参都经过 Zod 校验，pageSize 上限 100，无效输入返回清晰错误信息。

---

### 任务 1.4 PrismaClient 统一使用单例

**问题**：每个 controller 都 `new PrismaClient()`，`src/config/database.ts` 已有单例但未被使用。

**改动文件**：全部 10 个 controller 文件

**具体方案**：
```typescript
// 所有 controller 中替换：
// 删除: const prisma = new PrismaClient();
// 替换为:
import { prisma } from '../config/database';
```

需确认 `src/config/database.ts` 导出名为 `prisma` 的单例实例。

**验收标准**：全局搜索 `new PrismaClient()` 只存在于 `src/config/database.ts` 一处。

---

### 任务 1.5 .env 文件安全处理

**问题**：`.env` 和 `.env.production` 已被提交到仓库。

**操作步骤**：
```bash
# 1. 确认 .gitignore 已包含 .env（已确认包含）
# 2. 从 git 追踪中移除（不删除本地文件）
git rm --cached .env .env.production
# 3. 提交
git commit -m "chore: remove .env files from tracking"
# 4. 如果曾包含真实密钥，需要轮换所有密钥
```

**验收标准**：`git ls-files | grep '\.env'` 只显示 `.env.example`。

---

## 三、第二阶段：健壮性 & 数据层优化（P1 重要，5 天）

> 目标：消除数据竞态、优化查询性能、统一错误处理。

### 任务 2.1 注册接口竞态条件修复

**改动文件**：`src/controllers/auth.controller.ts`

**方案**：移除"先查后建"模式，直接 create 并捕获唯一约束错误：
```typescript
try {
  const user = await prisma.user.create({ data: { ... } });
} catch (err: any) {
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0];
    throw new AppError(`${field}已被注册`, ErrorCodes.USER_EXISTS, 409);
  }
  throw err;
}
```

---

### 任务 2.2 N+1 查询优化

**改动文件**：`src/controllers/article.controller.ts`

**方案**：将文章详情的 like/favorite 查询合并到主查询：
```typescript
const article = await prisma.article.findFirst({
  where: { slug },
  include: {
    category: { select: { id: true, name: true, slug: true } },
    author: { select: { id: true, name: true, avatar: true } },
    tags: { include: { tag: { select: { id: true, name: true, slug: true } } } },
    // 合并用户交互状态
    ...(userId ? {
      likes: { where: { userId }, select: { id: true }, take: 1 },
      favorites: { where: { userId }, select: { id: true }, take: 1 },
    } : {}),
  },
});
```

---

### 任务 2.3 查询字段精简（select 优化）

**改动文件**：所有 controller 中的列表查询

**方案**：列表接口只返回必要字段：
```typescript
// 文章列表 - 不返回 content 全文
const articles = await prisma.article.findMany({
  select: {
    id: true, title: true, slug: true, summary: true,
    coverImage: true, viewCount: true, likeCount: true,
    publishedAt: true, category: { select: { name: true, slug: true } },
  },
  skip, take: pageSize,
});
```

---

### 任务 2.4 统一响应格式

**改动文件**：`src/controllers/ai.controller.ts` 及其他不一致的 controller

**方案**：所有端点统一使用 `successResponse()` 包装：
```typescript
// 修改前
return res.json({ code: 0, data: { answer } });
// 修改后
return res.json(successResponse({ answer }));
```

---

### 任务 2.5 错误处理中间件增强

**改动文件**：`src/middlewares/error.middleware.ts`

**方案**：
```typescript
// 1. 增加请求上下文
console.error(`[${req.method} ${req.path}] Error:`, err);

// 2. 生产环境生成错误 ID 供用户反馈
const errorId = crypto.randomUUID().slice(0, 8);
return res.status(500).json({
  code: ErrorCodes.SERVER_ERROR,
  message: `服务器内部错误 (ID: ${errorId})`,
});
```

---

### 任务 2.6 消除 any 类型（关键路径）

**改动文件**：
- `src/middlewares/auth.middleware.ts` — `user?: any` → 定义 `JwtPayload` 接口
- `src/controllers/article.controller.ts` — `where: any` → 使用 `Prisma.ArticleWhereInput`

**方案**：
```typescript
// src/types/auth.ts（新建或扩展已有类型）
export interface JwtPayload {
  userId: string;
  username: string;
  iat: number;
  exp: number;
}

// auth.middleware.ts
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: JwtPayload;
    }
  }
}
```

---

### 任务 2.7 魔法数字枚举化

**改动文件**：`src/types/enums.ts`（新建）+ 涉及的 controller

**方案**：
```typescript
// src/types/enums.ts
export enum Gender {
  UNKNOWN = 0,
  MALE = 1,
  FEMALE = 2,
}

export enum PregnancyStatus {
  NONE = 0,
  PREPARING = 1,
  PREGNANT = 2,
  POSTPARTUM = 3,
}

export enum UserStatus {
  DISABLED = 0,
  ACTIVE = 1,
}
```

---

### 任务 2.8 JSON 请求体大小限制收紧

**改动文件**：`src/app.ts`

**方案**：
```typescript
// 全局默认 1MB
app.use(express.json({ limit: '1mb' }));

// 仅知识库导入等特殊端点使用大限制
router.post('/import', express.json({ limit: '10mb' }), importHandler);
```

---

### 任务 2.9 密码强度校验增强

**改动文件**：`src/controllers/auth.controller.ts`（改密码接口）

**方案**：已在 1.3 的 Zod schema 中定义，改密码接口复用同一 schema：
```typescript
export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8).max(64)
    .regex(/[A-Z]/, '需包含大写字母')
    .regex(/[0-9]/, '需包含数字')
    .regex(/[^A-Za-z0-9]/, '需包含特殊字符'),
});
```

---

### 任务 2.10 用户枚举防护

**改动文件**：`src/routes/auth.routes.ts`

**方案**：对 `/check/username`、`/check/phone` 接口施加更严格的限速：
```typescript
const checkRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 15 分钟只允许 10 次
  message: { code: 4003, message: '请求过于频繁' },
});

router.get('/check/username', checkRateLimiter, checkUsername);
router.get('/check/phone', checkRateLimiter, checkPhone);
```

---

## 四、第三阶段：前端加固 & 测试补全（P2 必要，5 天）

> 目标：前端容错增强，核心业务逻辑有测试覆盖。

### 任务 3.1 React Error Boundary

**新建文件**：`frontend/src/components/ErrorBoundary.tsx`

**方案**：
```tsx
import { Component, ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error: Error) {
    console.error('Uncaught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="页面出错了"
          subTitle="请刷新页面重试"
          extra={<Button onClick={() => window.location.reload()}>刷新页面</Button>}
        />
      );
    }
    return this.props.children;
  }
}
```

在 `App.tsx` 中包裹路由：
```tsx
<ErrorBoundary>
  <RouterProvider router={router} />
</ErrorBoundary>
```

---

### 任务 3.2 Token 刷新竞态修复

**改动文件**：`frontend/src/api/index.ts`

**方案**：用 Promise 锁替代布尔标志：
```typescript
let refreshPromise: Promise<string> | null = null;

async function refreshToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = axios.post('/api/v1/auth/refresh', {
    token: localStorage.getItem('token'),
  }).then(res => {
    const newToken = res.data.data.token;
    localStorage.setItem('token', newToken);
    return newToken;
  }).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}
```

---

### 任务 3.3 localStorage 安全访问封装

**新建文件**：`frontend/src/utils/storage.ts`

**方案**：
```typescript
class SafeStorage {
  private fallback = new Map<string, string>();

  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return this.fallback.get(key) ?? null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      this.fallback.set(key, value);
    }
  }

  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      this.fallback.delete(key);
    }
  }
}

export const storage = new SafeStorage();
```

全局替换 `localStorage.getItem/setItem` 为 `storage.getItem/setItem`。

---

### 任务 3.4 后端核心单元测试

**目标覆盖率**：核心 controller ≥ 70%

**改动文件**：
- `tests/auth.controller.test.ts` — 扩充已有测试
- `tests/article.controller.test.ts`（新建）
- `tests/calendar.controller.test.ts`（新建）
- `tests/validate.middleware.test.ts`（新建）
- `tests/ownership.test.ts`（新建）

**测试重点**：
```
auth:
  ✓ 注册成功 / 重复注册 409 / 弱密码 400
  ✓ 登录成功 / 错误密码 401
  ✓ token 过期刷新
  ✓ 改密码校验

article:
  ✓ 列表分页 / pageSize 上限 / 负数 page
  ✓ 详情 slug 查询
  ✓ 收藏越权校验 403

calendar:
  ✓ CRUD 正常流程
  ✓ 修改他人事件 403
  ✓ 无效日期 400

validate middleware:
  ✓ 合法输入通过
  ✓ 非法输入返回 400 + 清晰错误
  ✓ 分页上限生效
```

---

### 任务 3.5 集成测试（API 层）

**新建文件**：`tests/integration/api.test.ts`

**方案**：使用 supertest 对关键接口做端到端测试：
```typescript
import request from 'supertest';
import app from '../src/app';

describe('Auth API', () => {
  it('POST /api/v1/auth/register → 201', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ username: 'testuser', password: 'Test123!@#' });
    expect(res.status).toBe(201);
  });
});
```

---

### 任务 3.6 前端输入消毒

**改动文件**：
- `frontend/package.json` — 添加 `dompurify` 依赖
- `frontend/src/utils/sanitize.ts`（新建）
- 社区发帖、评论等用户输入组件

**方案**：
```typescript
import DOMPurify from 'dompurify';
export const sanitize = (dirty: string) => DOMPurify.sanitize(dirty);
```

---

### 任务 3.7 fire-and-forget 操作改为可靠模式

**改动文件**：`src/controllers/article.controller.ts`（viewCount 递增等）

**方案**：
```typescript
// 修改前
prisma.article.update({ ... }).catch(err => console.error(err));

// 修改后：仍然不阻塞主流程，但使用结构化日志
prisma.article.update({
  where: { id: article.id },
  data: { viewCount: { increment: 1 } },
}).catch(err => {
  console.error(`[Article:${article.id}] viewCount increment failed:`, err.message);
});
```

---

### 任务 3.8 SSE 流式 buffer 限制

**改动文件**：`src/services/ai-gateway.service.ts`

**方案**：
```typescript
const MAX_BUFFER_SIZE = 512 * 1024; // 512KB

while (true) {
  const { done, value } = await reader.read();
  buffer += decoder.decode(value, { stream: true });
  if (buffer.length > MAX_BUFFER_SIZE) {
    throw new AppError('AI 响应超出限制', ErrorCodes.SERVER_ERROR, 500);
  }
  // ...处理 lines
}
```

---

## 五、第四阶段：架构升级 & 运维完善（P3 增强，5 天）

> 目标：生产级运维能力，长期可维护性。

### 任务 4.1 Token 失效机制

**方案**：实现简单的内存 token 黑名单（后续迁移 Redis）：
```typescript
// src/services/token-blacklist.service.ts
const blacklist = new Map<string, number>(); // token -> expiry timestamp

export function blacklistToken(token: string, expiresAt: number) {
  blacklist.set(token, expiresAt);
}

export function isBlacklisted(token: string): boolean {
  const expiry = blacklist.get(token);
  if (!expiry) return false;
  if (Date.now() / 1000 > expiry) { blacklist.delete(token); return false; }
  return true;
}

// 定期清理过期条目
setInterval(() => {
  const now = Date.now() / 1000;
  for (const [token, exp] of blacklist) {
    if (now > exp) blacklist.delete(token);
  }
}, 60 * 1000);
```

---

### 任务 4.2 健康检查增强

**改动文件**：`src/app.ts`

**方案**：
```typescript
app.get('/health', async (_req, res) => {
  const checks = {
    server: 'ok',
    database: 'unknown',
    cache: cacheService.getStats(),
    uptime: process.uptime(),
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }
  const healthy = checks.database === 'ok';
  res.status(healthy ? 200 : 503).json(checks);
});
```

---

### 任务 4.3 优雅关机

**改动文件**：`src/app.ts`

**方案**：
```typescript
const server = app.listen(PORT);

async function gracefulShutdown(signal: string) {
  console.log(`收到 ${signal}，开始优雅关机...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('服务已关闭');
    process.exit(0);
  });
  // 10 秒强制退出
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

### 任务 4.4 Swagger API 文档

**方案**：安装 `swagger-jsdoc` + `swagger-ui-express`，为所有端点添加 JSDoc 注释：
```typescript
// src/app.ts
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

---

### 任务 4.5 HTTPS 强制 & Helmet 优化

**改动文件**：`src/app.ts`

**方案**：
```typescript
// HTTPS 强制（生产环境）
if (env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
  });
}

// Helmet 细化配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

---

### 任务 4.6 敏感操作审计日志

**方案**：在 Prisma schema 中新增 AuditLog 模型：
```prisma
model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String   // login, logout, password_change, profile_update
  detail    String?  @db.Text
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  @@index([userId, createdAt])
  @@map("audit_logs")
}
```

---

### 任务 4.7 SearchLog 索引优化

**改动文件**：`prisma/schema.prisma`

**方案**：
```prisma
model SearchLog {
  // ...existing fields
  @@index([keyword])
  @@index([createdAt])
}
```

---

## 六、改动文件清单汇总

| 文件 | 阶段 | 操作 |
|------|------|------|
| `src/config/env.ts` | 1 | 新建 |
| `src/utils/ownership.ts` | 1 | 新建 |
| `src/middlewares/validate.middleware.ts` | 1 | 新建 |
| `src/schemas/*.ts` | 1 | 新建(5个) |
| `src/types/enums.ts` | 2 | 新建 |
| `src/types/auth.ts` | 2 | 新建 |
| `src/services/token-blacklist.service.ts` | 4 | 新建 |
| `frontend/src/components/ErrorBoundary.tsx` | 3 | 新建 |
| `frontend/src/utils/storage.ts` | 3 | 新建 |
| `frontend/src/utils/sanitize.ts` | 3 | 新建 |
| `tests/*.test.ts` | 3 | 新建(4个) |
| `src/app.ts` | 1-4 | 修改 |
| `src/middlewares/auth.middleware.ts` | 1-2 | 修改 |
| `src/controllers/*.ts` (全部10个) | 1-2 | 修改 |
| `src/routes/*.ts` (全部9个) | 1-2 | 修改 |
| `src/services/ai-gateway.service.ts` | 3 | 修改 |
| `frontend/src/api/index.ts` | 3 | 修改 |
| `frontend/src/App.tsx` | 3 | 修改 |
| `prisma/schema.prisma` | 4 | 修改 |

---

## 七、里程碑 & 验收标准

| 里程碑 | 完成标志 |
|--------|----------|
| M1：安全加固完成 | 无硬编码密钥；所有写操作有所有权校验；所有入参经 Zod 校验 |
| M2：健壮性达标 | 全局无 `new PrismaClient()`；响应格式 100% 统一；无 `any` 关键路径 |
| M3：测试覆盖 | 核心 controller 测试覆盖 ≥ 70%；前端 ErrorBoundary 生效 |
| M4：生产就绪 | 健康检查覆盖 DB；优雅关机生效；API 文档可访问 |

---

## 八、注意事项

1. **每个阶段完成后做一次回归测试**，确保改动不破坏现有功能
2. **第一阶段是阻塞项**，必须在任何生产部署前完成
3. 数据库 schema 变更（第四阶段）需要 `prisma migrate dev` 生成迁移文件
4. 前端改动需同步验证移动端和小程序端的兼容性
5. 所有新增文件遵循项目现有的代码风格和目录约定
