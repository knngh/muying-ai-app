#!/bin/bash

# 母婴 AI 日历 - 自动部署脚本
# 使用方法: ./deploy.sh

# 加载配置
source deploy.config.sh

echo "=========================================="
echo "开始部署母婴 AI 日历 H5 到宝塔服务器"
echo "=========================================="

# 1. 构建 H5 版本
echo ""
echo "[1/5] 正在构建 H5 版本..."
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

npm run build:h5

if [ $? -ne 0 ]; then
    echo "❌ 构建失败！"
    exit 1
fi

echo "✅ 构建完成"

# 2. 创建备份
echo ""
echo "[2/5] 正在创建备份..."

# 生成备份文件名
BACKUP_NAME="muying-ai-backup-$(date +%Y%m%d-%H%M%S).tar.gz"

# 使用 SSH 密钥创建远程备份
ssh -i "$SERVER_KEY" -o StrictHostKeyChecking=no -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "
    if [ -d '$REMOTE_ROOT' ]; then
        cd $REMOTE_ROOT && tar -czf /tmp/$BACKUP_NAME ./* 2>/dev/null
        mkdir -p $BACKUP_DIR
        mv /tmp/$BACKUP_NAME $BACKUP_DIR/
        echo '备份已保存到: $BACKUP_DIR/$BACKUP_NAME'
    else
        echo '远程目录不存在，跳过备份'
    fi
"

if [ $? -eq 0 ]; then
    echo "✅ 备份完成: $BACKUP_NAME"
else
    echo "⚠️ 备份失败或目录不存在，继续部署..."
fi

# 3. 清空远程目录
echo ""
echo "[3/5] 正在清空远程目录..."

ssh -i "$SERVER_KEY" -o StrictHostKeyChecking=no -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "
    mkdir -p $REMOTE_ROOT
    rm -rf $REMOTE_ROOT/*
    echo '远程目录已清空'
"

echo "✅ 远程目录已清空"

# 4. 上传文件
echo ""
echo "[4/5] 正在上传文件..."

scp -i "$SERVER_KEY" -o StrictHostKeyChecking=no -P $SERVER_PORT -r $LOCAL_DIST/* $SERVER_USER@$SERVER_HOST:$REMOTE_ROOT/

if [ $? -eq 0 ]; then
    echo "✅ 文件上传完成"
else
    echo "❌ 文件上传失败！"
    exit 1
fi

# 5. 重启 Nginx
echo ""
echo "[5/5] 正在重启 Nginx..."

if [ "$RESTART_NGINX" = "true" ]; then
    ssh -i "$SERVER_KEY" -o StrictHostKeyChecking=no -p $SERVER_PORT $SERVER_USER@$SERVER_HOST "
        /etc/init.d/nginx reload
        echo 'Nginx 已重载'
    "
    echo "✅ Nginx 已重启"
else
    echo "⚠️ 已跳过 Nginx 重启"
fi

echo ""
echo "=========================================="
echo "🎉 部署完成！"
echo "=========================================="
echo "访问地址: http://$SERVER_HOST"
echo ""
