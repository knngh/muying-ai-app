# 网页认证升级评估

2026-09-28；用户优先级：完善账号密码登录、找回密码、设备会话。
状态：已完成源码及官方资料评估，尚未安装认证框架、迁移账号或启用邮件找回。

## 方案

优先采用 Better Auth 做独立认证模块，网页保留自身 React 界面。它支持 Express、用户名插件、自定义密码校验、密码重置与会话管理，与当前 TypeScript 技术栈匹配。

| 方案 | 适用性与成本 |
| --- | --- |
| Better Auth | 推荐。框架能力符合本期三个需求；需要完成旧账号适配和界面，不能仅替换登录表单。 |
| Casdoor | 自带可定制认证界面、找回密码和统一身份管理；需要增加独立服务。未来网页、App、管理后台统一登录时值得考虑。 |
| Sa-Token | 主项目面向 Java；当前 Node.js 后端接入需增加 Java 服务。其 README 有社区 Node.js 实现，但不等同主项目维护与功能保证。 |

## 已核实的现状

- Express 4 + Prisma 5 / MySQL，TypeScript NodeNext 编译为 CommonJS；Better Auth 官方 Express 集成要求 ESM。
- `User.id` 为 BigInt，与宝宝记录、日历、积分及聊天等大量数据关联；身份迁移不能改业务用户 ID。
- 密码保存在 `User.passwordHash`，bcrypt cost 10。Better Auth 支持自定义 hash/verify，可兼容旧密码。
- 旧账号的邮箱可为空，现有邮箱字段也没有验证状态。不得将已有邮箱直接视为已验证，或凭同名邮箱自动合并身份。
- 当前 JWT 无服务端会话记录，退出仅清本机凭据。真实的设备下线需要服务端每次验证会话，不能仅增加一个设备列表页面。
- 当前 Worker 为旧接口删除 Origin；新认证路径必须保留并校验 Origin，配置准确的可信网页来源，不能沿用此处理。
- 仓库尚无邮件发送服务配置。找回密码上线需要发信服务、已验证发信域名/地址及环境密钥；密钥不得写入仓库。

## 实施边界和顺序

1. 在单独升级分支建立 ESM 认证模块，选择与运行环境匹配并锁定的 Better Auth 版本；先用隔离数据库验证 Express/Prisma 适配，不将整个现有后端一次性切到 ESM。
2. 新增认证用户、凭据、会话、验证令牌表，与原业务 `User.id` 建立唯一映射。迁移脚本必须可重复运行，先输出只读核对结果，再执行事务写入；保留旧密码 hash，禁止导出明文密码。
3. 完善登录/注册界面：用户名或邮箱、显示密码、注册确认密码、字段级提示、提交中防重复、失败保留输入。新增账号绑定邮箱，旧账号登录后补充并验证邮箱。
4. 找回密码：统一返回不泄露账号是否存在的提示；一次性、限时令牌；固定站内回跳地址；失败限流；重置后撤销全部会话。无验证邮箱的旧账号需先正常登录绑定，或走人工核验流程。
5. 设备会话：展示当前设备、浏览器/系统、登录时间、最近活动；允许撤销单个其他会话或退出其他设备。设备名称来自 User-Agent，只作提示，不能作为可信设备证明。
6. 网页改用 HttpOnly / Secure / SameSite Cookie，配套 CSRF 校验。旧客户端 JWT 采用明确截止期的兼容策略；迁移完成后撤销旧通道，避免被撤销设备通过旧刷新接口重新获得凭据。
7. 验收：旧账号原密码、无邮箱账号、错误密码不泄露身份、重置过期/重复使用、跨账号会话撤销拒绝、修改密码后旧设备 401、跨标签页退出、撤销后的在途响应、Worker 同源代理与 CSRF。

本轮网页稳定性修复可独立发布。认证迁移会改变数据库和全部会话生命周期，单独交付和回滚，避免将其混入已验证的 P0/P1 修复。

## 官方依据

- [Sa-Token](https://github.com/dromara/Sa-Token)：Java 主项目及社区语言实现。
- [Better Auth Express](https://better-auth.com/docs/integrations/express)：ESM、handler 在 body parser 之前、会话读取。
- [Better Auth Username](https://better-auth.com/docs/plugins/username)：用户名插件、注册仍需要邮箱。
- [Better Auth Email & Password](https://better-auth.com/docs/authentication/email-password)：自定义密码 hash/verify、邮件回调、重置时撤销会话。
- [Better Auth Database](https://better-auth.com/docs/concepts/database)：身份、凭据、会话、验证表及映射配置。
- [Casdoor Overview](https://casdoor.org/docs/overview)：可定制界面、找回密码、多种认证渠道和独立身份服务。
