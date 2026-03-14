# 母婴AI助手 - 前端项目

基于 React + Vite + TypeScript 构建的母婴AI助手前端应用。

## 技术栈

- **框架**: React 18
- **构建工具**: Vite 5
- **语言**: TypeScript 5
- **路由**: React Router 6
- **状态管理**: Zustand
- **UI 组件库**: Ant Design 5
- **HTTP 客户端**: Axios
- **代码规范**: ESLint + Prettier

## 项目结构

```
src/
├── api/              # API 接口封装
│   ├── index.ts      # Axios 实例配置
│   └── modules.ts    # API 模块定义
├── components/       # 公共组件
│   └── Layout/       # 布局组件
├── hooks/            # 自定义 Hooks
├── pages/            # 页面组件
│   ├── Home/         # 首页
│   ├── Knowledge/    # 知识库
│   ├── Calendar/     # 日历
│   └── Profile/      # 个人中心
├── stores/           # 状态管理
├── styles/           # 全局样式
├── utils/            # 工具函数
├── App.tsx           # 根组件
└── main.tsx          # 入口文件
```

## 快速开始

### 安装依赖

```bash
npm install
# 或
pnpm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 代码检查

```bash
npm run lint
npm run lint:fix
```

### 代码格式化

```bash
npm run format
```

## 功能模块

### 首页
- AI 智能问答入口
- 功能导航
- 推荐内容展示

### 知识库
- 孕期知识分类浏览
- 育儿知识搜索
- 文章详情展示

### 日历
- 孕期里程碑记录
- 产检提醒
- 疫苗接种计划

### 个人中心
- 用户信息管理
- 孕期信息设置
- 偏好设置

## 开发规范

- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码
- 组件使用函数式组件 + Hooks
- 样式使用 CSS Modules

## 环境变量

创建 `.env.local` 文件配置本地环境变量：

```
VITE_API_BASE_URL=http://localhost:3000/api
```

## License

MIT