# 母婴网页 API 测试报告

## 测试环境
- **后端服务**: Express.js + TypeScript
- **数据库**: MySQL
- **测试日期**: 2026-03-14

---

## 一、认证 API 测试

### 1.1 用户注册
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "testuser2",
  "password": "Test123456!",
  "phone": "13900139000"
}
```

**预期响应**: 201 Created
```json
{
  "code": 0,
  "message": "注册成功",
  "data": {
    "user": { "id": 1, "username": "testuser2" },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 1.2 用户登录
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "Test123456!"
}
```

**预期响应**: 200 OK

### 1.3 获取当前用户
```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

**预期响应**: 200 OK

---

## 二、分类 API 测试

### 2.1 获取分类列表
```http
GET /api/v1/categories
```

**预期响应**:
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "name": "孕期知识",
        "slug": "pregnancy",
        "children": [...]
      }
    ]
  }
}
```

### 2.2 获取分类详情
```http
GET /api/v1/categories/pregnancy
```

**预期响应**: 200 OK

---

## 三、文章 API 测试

### 3.1 获取文章列表
```http
GET /api/v1/articles?page=1&pageSize=10&sort=latest
```

**预期响应**: 200 OK, 分页数据

### 3.2 搜索文章
```http
GET /api/v1/search?q=孕早期
```

**预期响应**: 200 OK, 搜索结果

### 3.3 点赞文章 (需认证)
```http
POST /api/v1/articles/1/like
Authorization: Bearer <token>
```

**预期响应**: 200 OK

---

## 四、日历 API 测试 (需认证)

### 4.1 获取日历事件
```http
GET /api/v1/calendar/events?startDate=2026-03-01&endDate=2026-03-31
Authorization: Bearer <token>
```

### 4.2 创建日历事件
```http
POST /api/v1/calendar/events
Authorization: Bearer <token>

{
  "title": "四维彩超",
  "eventType": "checkup",
  "eventDate": "2026-04-15"
}
```

---

## 五、疫苗 API 测试

### 5.1 获取疫苗列表
```http
GET /api/v1/vaccines
```

### 5.2 按月龄筛选
```http
GET /api/v1/vaccines?monthAge=2
```

---

## 六、测试检查清单

| API | 端点 | 认证 | 状态 |
|-----|------|------|------|
| 注册 | POST /auth/register | 否 | ⬜ |
| 登录 | POST /auth/login | 否 | ⬜ |
| 用户信息 | GET /auth/me | 是 | ⬜ |
| 分类列表 | GET /categories | 否 | ⬜ |
| 文章列表 | GET /articles | 否 | ⬜ |
| 文章搜索 | GET /search | 否 | ⬜ |
| 点赞 | POST /articles/:id/like | 是 | ⬜ |
| 日历事件 | GET /calendar/events | 是 | ⬜ |
| 疫苗列表 | GET /vaccines | 否 | ⬜ |

---

## 七、运行测试

```bash
# 1. 安装依赖
npm install

# 2. 配置数据库
cp .env.example .env

# 3. 数据库迁移
npx prisma migrate dev

# 4. 种子数据
npx prisma db seed

# 5. 启动服务
npm run dev

# 6. 健康检查
curl http://localhost:3000/health
```