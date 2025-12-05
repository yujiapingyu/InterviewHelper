#!/bin/bash

# 部署脚本 - Deploy Script
# 用于更新服务器上的代码

echo "🚀 开始部署..."

# 1. 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 2. 检查环境变量文件
if [ ! -f .env ]; then
  echo "⚠️  警告: .env 文件不存在"
  echo "📝 请根据 .env.example 创建 .env 文件并配置必要的环境变量"
  echo ""
  echo "必需的环境变量："
  echo "  - RESEND_API_KEY: 邮件服务API密钥"
  echo "  - DB_HOST, DB_USER, DB_PASSWORD: 数据库配置"
  echo "  - VITE_GEMINI_API_KEY: Gemini AI API密钥"
  echo ""
  read -p "是否继续部署？(y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# 3. 安装依赖
echo "📦 安装依赖..."
npm install

# 4. 构建前端
echo "🏗️  构建前端..."
npm run build

# 5. 重启服务器
echo "🔄 重启服务器..."
pm2 restart novel-app || pm2 start server/api.js --name novel-app

echo "✅ 部署完成！"
echo ""
echo "💡 提示："
echo "   - 前端已构建到 dist/ 目录"
echo "   - 后端服务已重启"
echo "   - 请清除浏览器缓存以查看最新版本"
echo "   - 确保 .env 文件包含所有必需的环境变量"
echo ""
echo "🌐 访问: http://localhost:3000"
