#!/bin/bash

# 部署脚本 - Deploy Script
# 用于更新服务器上的代码

echo "🚀 开始部署..."

# 1. 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 2. 安装依赖
echo "📦 安装依赖..."
npm install

# 3. 构建前端
echo "🏗️  构建前端..."
npm run build

# 4. 重启服务器
echo "🔄 重启服务器..."
pm2 restart novel-app || pm2 start server/api.js --name novel-app

echo "✅ 部署完成！"
echo ""
echo "💡 提示："
echo "   - 前端已构建到 dist/ 目录"
echo "   - 后端服务已重启"
echo "   - 请清除浏览器缓存以查看最新版本"
echo ""
echo "🌐 访问: http://localhost:3000"
