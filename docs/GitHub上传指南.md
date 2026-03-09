# GitHub 上传指南

本项目使用 GitHub 托管代码，支持自动部署到服务器。

---

## 一、上传代码到 GitHub

### 1.1 创建 GitHub 仓库

1. 登录 [GitHub](https://github.com/)
2. 点击 **New repository** 创建新仓库
3. 仓库名称：`muying-ai-app`
4. 选择 **Public** 或 **Private**
5. 点击 **Create repository**

### 1.2 本地初始化并推送

在项目根目录执行：

```bash
# 初始化 Git（如果尚未初始化）
git init

# 添加所有文件
git add .

# 提交代码
git commit -m "初始提交：母婴AI日历"

# 添加远程仓库（替换 knngh 为你的用户名）
git remote add origin https://github.com/knngh/muying-ai-app.git

# 推送到 GitHub
git push -u origin main
```

---

## 二、配置自动部署（可选）

### 2.1 添加服务器密钥

在 GitHub 仓库中：

1. **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**，添加：
   - `SERVER_HOST` - 服务器 IP 地址
   - `SERVER_SSH_KEY` - 服务器 SSH 私钥

### 2.2 获取 SSH 密钥

在本地 Mac 终端：

```bash
# 查看是否有 SSH 密钥
ls -la ~/.ssh

# 如果没有，生成新的
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

然后将公钥添加到服务器：

```bash
# 复制公钥
cat ~/.ssh/id_rsa.pub

# 在服务器上添加到 authorized_keys
echo "公钥内容" >> ~/.ssh/authorized_keys
```

### 2.3 触发部署

每次推送到 `main` 分支后，GitHub Actions 会自动：
1. 构建 H5 前端
2. 上传到服务器
3. 重启后端服务

---

## 三、手动部署到服务器

如果不想使用自动部署，可以手动部署：

### 3.1 克隆代码到服务器

```bash
cd /www/wwwroot
git clone https://github.com/knngh/muying-ai-app.git
```

### 3.2 安装依赖

```bash
# 前端依赖
cd /www/wwwroot/muying-ai-app
npm install

# 后端依赖
cd server
npm install
```

### 3.3 构建前端

```bash
cd /www/wwwroot/muying-ai-app
npm run build:h5
```

### 3.4 复制构建产物

```bash
# 复制到网站根目录
cp -r dist/build/h5/* /www/wwwroot/muying-ai/
```

### 3.5 启动后端服务

```bash
cd /www/wwwroot/muying-ai-app/server
pm2 start src/index.js --name muying-ai-api

# 设置开机自启
pm2 save
pm2 startup
```

---

## 四、日常更新流程

```bash
# 1. 在本地修改代码

# 2. 提交更新
git add .
git commit -m "更新描述"

# 3. 推送到 GitHub
git push origin main

# 4. 自动部署触发后，在服务器上查看状态
pm2 status
```

---

## 五、常见问题

### 1. 推送被拒绝

```bash
# 如果远程有更新，先拉取
git pull origin main --rebase

# 然后再推送
git push origin main
```

### 2. SSH 密钥权限

确保本地密钥权限正确：

```bash
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
```

### 3. 服务器权限

确保网站目录权限正确：

```bash
chown -R www:www /www/wwwroot/muying-ai
```

---

## 六、仓库地址

- **GitHub 仓库**: https://github.com/knngh/muying-ai-app
- **推送命令**: `git push origin main`
