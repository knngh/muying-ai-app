#!/bin/bash

# 母婴AI日历 - 一键部署脚本
# 在服务器上执行此脚本即可完成部署

echo "========================================="
echo "  母婴AI日历 - 一键部署脚本"
echo "========================================="

# 1. 安装 Node.js（如果未安装）
if ! command -v node &> /dev/null; then
    echo "[1/6] 安装 Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    echo "[1/6] Node.js 已安装: $(node -v)"
fi

# 2. 安装 Git（如果未安装）
if ! command -v git &> /dev/null; then
    echo "[2/6] 安装 Git..."
    apt-get update && apt-get install -y git
else
    echo "[2/6] Git 已安装: $(git --version)"
fi

# 3. 安装 PM2
echo "[3/6] 安装 PM2..."
npm install -g pm2

# 4. 克隆代码（替换为你的仓库地址）
echo "[4/6] 克隆代码..."
cd /www/wwwroot
if [ -d "muying-ai-app" ]; then
    echo "代码目录已存在，更新中..."
    cd muying-ai-app
    git pull origin main
else
    git clone https://github.com/knngh/muying-ai-app.git
    cd muying-ai-app
fi

# 5. 安装依赖
echo "[5/6] 安装依赖..."
npm install
cd server && npm install

# 6. 启动后端服务
echo "[6/6] 启动后端服务..."
cd /www/wwwroot/muying-ai-app/server

# 检查 PM2 进程是否存在
if pm2 describe muying-ai-api &> /dev/null; then
    pm2 restart muying-ai-api
    echo "后端服务已重启"
else
    pm2 start src/index.js --name muying-ai-api
    pm2 save
    echo "后端服务已启动"
fi

# 7. 部署 H5 前端
echo ""
echo "部署 H5 前端..."
cd /www/wwwroot/muying-ai-app
npm run build:h5

# 复制到网站目录
mkdir -p /www/wwwroot/muying-ai
cp -r dist/build/h5/* /www/wwwroot/muying-ai/

# 设置权限
chown -R www:www /www/wwwroot/muying-ai
chown -R www:www /www/wwwroot/muying-ai-app/server

echo ""
echo "========================================="
echo "  部署完成！"
echo "========================================="
echo ""
echo "H5 访问地址: http://你的服务器IP"
echo "API 访问地址: http://你的服务器IP:3000/api"
echo ""
echo "后续更新命令:"
echo "  cd /www/wwwroot/muying-ai-app"
echo "  git pull"
echo "  npm run build:h5"
echo "  pm2 restart muying-ai-api"
echo ""
