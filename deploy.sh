#!/bin/bash

# ToList 项目在宝塔面板上的快速部署脚本
# 使用方法: bash deploy.sh

set -e

echo "================================"
echo "🚀 ToList 快速部署脚本"
echo "================================"

# 获取项目路径
PROJECT_PATH=$(pwd)
echo "📍 项目路径: $PROJECT_PATH"

# 检查必要的文件
if [ ! -f "server.js" ] || [ ! -f "package.json" ]; then
    echo "❌ 错误: 这不是有效的 ToList 项目目录"
    echo "   请确保在项目根目录运行此脚本"
    exit 1
fi

echo ""
echo "1️⃣  安装 Node.js 依赖..."
npm install --production
echo "✅ Node.js 依赖安装完成"

echo ""
echo "2️⃣  安装 Python 依赖..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "   ✅ 虚拟环境已创建"
fi

source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null
pip install -r requirements.txt
deactivate
cd ..
echo "✅ Python 依赖安装完成"

echo ""
echo "3️⃣  创建日志目录..."
mkdir -p logs
mkdir -p backend/logs
chmod 755 logs backend/logs
echo "✅ 日志目录已创建"

echo ""
echo "4️⃣  创建 PM2 启动脚本..."

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'todolist-server',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'todolist-python',
      script: './start_python.sh',
      exec_mode: 'fork',
      env: {
        PORT: 5000
      },
      error_file: './backend/logs/error.log',
      out_file: './backend/logs/out.log'
    }
  ]
};
EOF

echo "✅ ecosystem.config.js 已创建"

echo ""
echo "5️⃣  创建 Python 启动脚本..."

cat > start_python.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")/backend"
source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null
gunicorn -c gunicorn_config.py main:app
EOF

chmod +x start_python.sh
echo "✅ start_python.sh 已创建并赋予执行权限"

echo ""
echo "6️⃣  创建 Python Gunicorn 配置..."

cat > backend/gunicorn_config.py << 'EOF'
import multiprocessing
import os

bind = "127.0.0.1:5000"
workers = min(multiprocessing.cpu_count() * 2 + 1, 8)
worker_class = "sync"
timeout = 30
keepalive = 2
max_requests = 1000
max_requests_jitter = 100

# 日志配置
os.makedirs('logs', exist_ok=True)
accesslog = "logs/access.log"
errorlog = "logs/error.log"
loglevel = "info"
EOF

echo "✅ gunicorn_config.py 已创建"

echo ""
echo "7️⃣  安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    echo "✅ PM2 已安装"
else
    echo "✅ PM2 已存在"
fi

echo ""
echo "================================"
echo "✅ 部署准备完成！"
echo "================================"
echo ""
echo "📋 接下来的步骤："
echo ""
echo "1. 启动应用:"
echo "   pm2 start ecosystem.config.js"
echo ""
echo "2. 设置开机自启:"
echo "   pm2 startup"
echo "   pm2 save"
echo ""
echo "3. 在宝塔面板中配置 Nginx 反向代理"
echo "   将所有请求代理到 http://127.0.0.1:3000"
echo "   将 /api/gemini 代理到 http://127.0.0.1:5000"
echo ""
echo "4. 查看应用状态:"
echo "   pm2 status"
echo ""
echo "5. 查看日志:"
echo "   pm2 logs"
echo ""
echo "🌐 应用将在以下地址运行:"
echo "   Node.js: http://127.0.0.1:3000"
echo "   Python:  http://127.0.0.1:5000"
echo ""
