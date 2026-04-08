# 贝护妈妈 App MVP V2 — 商业化增量方案

> 核心策略：小程序永久免费做获客漏斗，App 做深度服务 + 付费转化

---

## 一、商业逻辑总纲

```
小程序（免费）                          App（免费 + 会员）
┌──────────────┐                    ┌──────────────────────┐
│ 轻量体验      │   引导下载 App      │ 完整体验              │
│ AI 3次/天     │ ──────────────→    │ AI 无限次             │
│ 基础知识库    │                    │ 专家专栏 + 深度内容     │
│ 社区浏览      │                    │ 社区全功能 + 专属圈子   │
│ 基础日历      │                    │ 智能日历 + 周报月报     │
│              │                    │ 成长档案 + 数据导出     │
└──────────────┘                    └──────────────────────┘
     获客入口                             变现引擎
```

### 为什么用户会付费？（核心价值主张）

| 免费用户的痛点 | 付费解决方案 |
|-------------|-----------|
| AI 每天只能问 3 次，不够用 | 无限 AI 问答 + 多轮深度对话 |
| 不知道这周该关注什么 | AI 个性化周报：本周身体变化 + 注意事项 + 饮食建议 |
| 知识太多不知从何看起 | 阶段精准推送 + "本周必读" 专题 |
| 想记录但坚持不下来 | 智能打卡 + 周报回顾 + 成就体系 |
| 社区信息鱼龙混杂 | 专属阶段圈子 + 已验证妈妈标识 |

---

## 二、会员体系设计

### 2.1 双层会员

| 维度 | 免费用户 | 贝护会员（¥19.9/月） |
|-----|---------|-------------------|
| **AI 问答** | 3 次/天 | 无限次 |
| **AI 对话模式** | 单轮问答 | 多轮连续对话 |
| **AI 周报** | 不可用 | 每周一份个性化报告 |
| **知识库** | 全部文章可看 | + 专家专栏（独家深度内容） |
| **社区** | 浏览 + 发帖 | + 阶段专属圈子 + 已验证标识 |
| **日历** | 基础事件管理 | + 智能提醒 + 打卡统计 + 周报月报 |
| **成长档案** | 基础记录 | + 数据图表 + PDF 导出 + 分享 |
| **广告** | 有 | 无 |

### 2.2 定价策略

```
连续包月：¥19.9/月      ← 主推
季度会员：¥49.9/季（¥16.6/月，省17%）
年度会员：¥148/年（¥12.3/月，省38%）  ← 最优惠
```

> 定价逻辑：目标用户（孕妈/新手妈妈）使用周期 9-24 个月，季度和年卡锁定长期价值。
> ¥19.9 是母婴 App 付费的心理舒适区，低于一杯奶茶钱/天。

### 2.3 首月特惠（冷启动）

- 新用户注册 App 送 7 天会员体验
- 首月 ¥9.9（限时）
- 邀请好友各得 7 天会员

---

## 三、功能规划（按优先级排序）

### P0 — 付费闭环（第1期，2周）

不做这些，其他都没意义。

```
┌─────────────────────────────────────────────────┐
│ 1. 会员数据模型                                    │
│    - Subscription 表（用户、套餐、状态、到期时间）      │
│    - PaymentOrder 表（订单号、金额、支付渠道、状态）     │
│    - UserQuota 表（每日 AI 额度、已用次数）            │
│                                                   │
│ 2. AI 问答限次                                     │
│    - 中间件拦截：免费用户 3次/天，会员无限              │
│    - 到达上限时弹出会员引导弹窗                       │
│                                                   │
│ 3. 会员购买页                                      │
│    - 套餐选择（月/季/年）                            │
│    - 权益对比列表                                   │
│    - 支付宝/微信支付对接                             │
│                                                   │
│ 4. Profile 会员卡片                                │
│    - 会员状态展示                                   │
│    - 到期时间 / 续费入口                             │
│    - 权益使用概览（今日已用 AI 次数等）                 │
└─────────────────────────────────────────────────┘
```

### P1 — 付费价值感知（第2期，2周）

让用户觉得"值"。

```
┌─────────────────────────────────────────────────┐
│ 5. AI 个性化周报（会员专属）                         │
│    - 根据孕周/月龄自动生成                           │
│    - 内容：本周身体变化、饮食建议、运动建议、注意事项     │
│    - 每周一推送，可在"我的"页面查看历史                  │
│                                                   │
│ 6. 首页个性化改造                                   │
│    - "今日阶段"卡片（孕X周X天 / 宝宝X月X天）           │
│    - "今日提醒"（产检/疫苗/待办）                     │
│    - "AI 今日建议"（1条，会员看完整版）                 │
│    - 快捷入口重组                                    │
│                                                   │
│ 7. 日历增强                                        │
│    - 每日打卡功能                                   │
│    - 打卡连续天数统计                                │
│    - 本周完成率展示                                  │
└─────────────────────────────────────────────────┘
```

### P2 — 留存与粘性（第3期，2周）

让用户离不开。

```
┌─────────────────────────────────────────────────┐
│ 8. 社区阶段圈子                                    │
│    - 按阶段分组：备孕/孕早/孕中/孕晚/产后恢复/育儿      │
│    - 会员专属"已验证妈妈"标识                        │
│    - 默认展示同阶段内容                              │
│                                                   │
│ 9. 成长档案增强（会员专属）                           │
│    - 记录可视化图表（身高/体重曲线）                    │
│    - PDF 导出（带宝宝照片和里程碑）                    │
│    - 分享到社交平台                                  │
│                                                   │
│ 10. 小程序 → App 引流                              │
│     - 小程序内"解锁更多"引导                         │
│     - AI 问答用完后引导下载 App                       │
│     - 深度内容"App 内查看完整版"                      │
└─────────────────────────────────────────────────┘
```

---

## 四、数据模型变更

在现有 `schema.prisma` 基础上新增：

```prisma
// ============================================
// 会员套餐表
// ============================================
model SubscriptionPlan {
  id            BigInt   @id @default(autoincrement())
  name          String   @db.VarChar(50)    // "月卡"、"季卡"、"年卡"
  code          String   @unique @db.VarChar(30) // monthly, quarterly, yearly
  price         Decimal  @db.Decimal(10, 2)  // 单位：元
  originalPrice Decimal? @db.Decimal(10, 2)  // 划线价
  durationDays  Int                          // 有效天数
  description   String?  @db.VarChar(500)
  features      Json?                        // 权益列表 JSON
  sortOrder     Int      @default(0)
  isActive      Int      @default(1)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  subscriptions Subscription[]
  orders        PaymentOrder[]

  @@map("subscription_plans")
}

// ============================================
// 用户订阅表
// ============================================
model Subscription {
  id          BigInt    @id @default(autoincrement())
  userId      BigInt
  planId      BigInt
  status      String    @db.VarChar(20) // active, expired, cancelled
  startAt     DateTime
  expireAt    DateTime
  autoRenew   Int       @default(1)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan        SubscriptionPlan @relation(fields: [planId], references: [id])

  @@index([userId])
  @@index([status])
  @@index([expireAt])
  @@index([userId, status])
  @@map("subscriptions")
}

// ============================================
// 支付订单表
// ============================================
model PaymentOrder {
  id            BigInt   @id @default(autoincrement())
  userId        BigInt
  planId        BigInt
  orderNo       String   @unique @db.VarChar(64)  // 业务订单号
  tradeNo       String?  @db.VarChar(128)          // 第三方交易号
  amount        Decimal  @db.Decimal(10, 2)
  payChannel    String   @db.VarChar(20)           // wechat, alipay
  status        String   @default("pending") @db.VarChar(20)
                         // pending, paid, refunded, cancelled
  paidAt        DateTime?
  refundedAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan          SubscriptionPlan @relation(fields: [planId], references: [id])

  @@index([userId])
  @@index([orderNo])
  @@index([status])
  @@index([createdAt])
  @@map("payment_orders")
}

// ============================================
// 用户每日额度表
// ============================================
model UserDailyQuota {
  id          BigInt   @id @default(autoincrement())
  userId      BigInt
  quotaDate   DateTime @db.Date
  aiUsed      Int      @default(0)    // 今日已用 AI 次数
  aiLimit     Int      @default(3)    // 今日上限（免费3，会员9999）
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, quotaDate])
  @@index([userId])
  @@index([quotaDate])
  @@map("user_daily_quotas")
}

// ============================================
// AI 周报表（会员专属）
// ============================================
model AiWeeklyReport {
  id          BigInt   @id @default(autoincrement())
  userId      BigInt
  weekStart   DateTime @db.Date         // 周报起始日期
  stageInfo   String   @db.VarChar(50)  // "孕28周" / "宝宝6月3天"
  content     Json                       // 结构化周报内容
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, weekStart])
  @@index([userId])
  @@index([weekStart])
  @@map("ai_weekly_reports")
}
```

User 表需新增关联：

```prisma
// 在 User model 中增加
subscriptions     Subscription[]
paymentOrders     PaymentOrder[]
dailyQuotas       UserDailyQuota[]
weeklyReports     AiWeeklyReport[]
```

---

## 五、API 新增接口

### 5.1 会员相关

```
GET    /api/v1/subscription/plans          获取套餐列表
GET    /api/v1/subscription/status         查询当前会员状态
POST   /api/v1/subscription/check-feature  检查某功能是否可用
```

### 5.2 支付相关

```
POST   /api/v1/payment/create-order        创建支付订单
POST   /api/v1/payment/callback/wechat     微信支付回调
POST   /api/v1/payment/callback/alipay     支付宝支付回调
GET    /api/v1/payment/order/:orderNo      查询订单状态
```

### 5.3 额度相关

```
GET    /api/v1/quota/today                 查询今日 AI 剩余额度
```

### 5.4 周报相关

```
GET    /api/v1/report/weekly/latest        获取最新周报
GET    /api/v1/report/weekly/list          获取周报列表
POST   /api/v1/report/weekly/generate      手动触发生成（定时任务也会自动生成）
```

### 5.5 AI 接口变更

```
现有 POST /api/v1/ai/ask 和 /api/v1/ai/chat 增加中间件：
- quotaCheckMiddleware：检查额度 → 扣减额度 → 放行
- 超额返回 HTTP 429 + { code: "QUOTA_EXCEEDED", upgradeUrl: "..." }
```

---

## 六、关键中间件

### 6.1 会员身份中间件

```typescript
// src/middlewares/subscription.ts
// 注入 req.subscription = { isVip, plan, expireAt }
// 每个请求自动查询并缓存（Redis/内存，5分钟TTL）
```

### 6.2 AI 额度中间件

```typescript
// src/middlewares/quota.ts
// 1. 查询/创建今日 UserDailyQuota
// 2. 会员 → aiLimit = 9999，直接放行
// 3. 免费用户 → aiUsed < aiLimit → aiUsed++ → 放行
// 4. 超额 → 返回 429 + 升级引导
```

### 6.3 功能门控中间件

```typescript
// src/middlewares/featureGate.ts
// featureGate('weekly_report') → 检查会员状态 → 放行或403
```

---

## 七、App 端页面改动清单

### 7.1 新增页面

| 页面 | 路径 | 说明 |
|-----|------|------|
| 会员购买页 | `/screens/MembershipScreen.tsx` | 套餐选择 + 权益对比 + 支付 |
| AI 周报页 | `/screens/WeeklyReportScreen.tsx` | 查看本周/历史周报 |
| 升级引导弹窗 | `/components/UpgradeModal.tsx` | AI 用完 / 功能受限时弹出 |

### 7.2 改动页面

| 页面 | 改动内容 |
|-----|---------|
| **HomeScreen** | 新增"今日阶段"卡片、"今日提醒"卡片、"AI建议"卡片（会员看完整） |
| **ChatScreen** | 顶部显示剩余额度、用完后弹出升级弹窗、会员显示"无限"标识 |
| **ProfileScreen** | 新增会员卡片区域（状态/到期时间/续费按钮/权益概览） |
| **CalendarScreen** | 新增每日打卡按钮、连续打卡天数展示、本周完成率 |
| **CommunityScreen** | 新增阶段分组 tab、会员"已验证"标识 |

---

## 八、小程序引流改动

小程序功能不做删减，但增加 App 引流触点：

| 触点 | 实现方式 |
|-----|---------|
| AI 问答到达上限 | 弹窗："下载 App 每天多3次免费额度" → 实际 App 免费也是3次，但体验更好 |
| 知识库深度文章 | 底部横幅："在 App 中获取本周专属推荐" |
| 社区 | 帖子详情底部："下载 App 加入专属孕期圈子" |
| 我的页面 | 新增"下载 App"入口 + 会员权益预览 |

---

## 九、实施节奏

```
第1期（2周）— 付费闭环 MVP
├── 数据库：新增 4 张表（套餐/订阅/订单/额度）
├── 后端：会员中间件 + 额度中间件 + 支付接口
├── App：会员购买页 + Profile 会员卡片 + 升级弹窗
├── App：ChatScreen 接入额度限制
└── 验收标准：用户可以完成 "注册→使用AI→触达上限→购买会员→解锁" 全流程

第2期（2周）— 价值感知
├── 后端：AI 周报生成服务（定时任务 + 手动触发）
├── App：首页个性化改造（阶段卡片/提醒/AI建议）
├── App：AI 周报查看页
├── App：日历打卡 + 连续统计
└── 验收标准：会员每周收到个性化周报，首页有明显差异化体验

第3期（2周）— 留存增强
├── App：社区阶段圈子 + 会员标识
├── App：成长档案图表 + PDF导出
├── 小程序：引流触点（4个位置）
└── 验收标准：留存率和次日打开率有可衡量提升

第4期（持续）— 数据驱动迭代
├── 埋点分析：付费转化漏斗、各功能使用率
├── A/B 测试：定价、首页布局、升级弹窗时机
├── 用户访谈：每两周 5 个付费用户 + 5 个流失用户
└── 迭代方向：根据数据调整
```

---

## 十、关键指标（北极星 + 辅助）

| 指标 | 目标（上线3个月） | 计算方式 |
|------|----------------|---------|
| **付费转化率** | ≥ 3% | 付费用户 / 注册用户 |
| **月活 MAU** | ≥ 5,000 | 月内至少登录1次 |
| **次日留存** | ≥ 40% | D1 回访 / D0 新增 |
| **7日留存** | ≥ 20% | D7 回访 / D0 新增 |
| **AI 日均使用** | ≥ 2次/活跃用户 | AI调用总数 / DAU |
| **ARPU** | ≥ ¥8/月 | 总收入 / MAU |
| **会员续费率** | ≥ 50% | 续费用户 / 到期用户 |
| **小程序→App 转化** | ≥ 10% | App注册 / 小程序引导点击 |

---

## 十一、风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 用户觉得 AI 3次太少不想用 | 流失 | 首次注册送7天会员体验，让用户先感受价值 |
| 支付对接周期长 | 延期 | P0 先用苹果 IAP + 安卓微信支付，最小化对接 |
| 付费率低于预期 | 收入不达标 | 准备 B 方案：降价至 ¥9.9/月 + 增加免费额度至 5次/天 |
| 小程序审核限制引流 | 获客受阻 | 引流文案用"更多功能"而非"下载App"，避免审核风险 |
| AI 成本随会员增长飙升 | 亏损 | 会员也做软限（50次/天），超出提示"明天再来" |
| 医疗合规风险 | 法律 | 所有 AI 回答保留免责声明，不做诊断性表述 |

---

## 十二、与旧版 MVP 的主要差异

| 维度 | 旧版 MVP | 本版 MVP V2 |
|------|---------|------------|
| **商业模型** | 提到"验证会员付费"但无具体设计 | 完整的双层会员体系 + 定价 + 首月策略 |
| **数据模型** | 无 | 5张新表 + 完整 Prisma Schema |
| **API 设计** | 无 | 12个新接口 + 3个中间件 |
| **优先级** | 先改首页 → 后做会员 | 先做付费闭环 → 再做体验优化 |
| **核心付费点** | 模糊的"会员版" | 明确：AI额度 + 周报 + 成长档案 |
| **小程序策略** | 未提及 | 4个引流触点设计 |
| **指标体系** | 无 | 8个核心指标 + 目标值 |
| **风险预案** | 无 | 6个风险 + 应对方案 |
| **实施周期** | "首期"无时间线 | 4期 × 2周 = 8周明确节奏 |

---

## 十三、不做的事（明确边界）

- **不做电商**：母婴电商竞争太激烈，不碰
- **不做直播/短视频**：资源消耗大，与核心价值无关
- **不做积分系统**：增加复杂度，MVP 阶段用简单的会员体系即可
- **不做社交 IM**：社区够用，不做私聊
- **不改底部导航结构**：保持现有 5 tab，减少迁移成本
- **不重写现有功能**：增量改造，不推翻重来
- **不做 B 端（医生端）**：MVP 验证 C 端付费意愿优先

---

*文档版本：V2.0*
*更新日期：2026-04-05*
*适用范围：贝护妈妈 App 商业化 MVP*
