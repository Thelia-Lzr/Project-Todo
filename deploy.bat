@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ================================
echo 🚀 ToList 快速部署脚本 (Windows)
echo ================================
echo.

REM 检查必要的文件
if not exist "server.js" (
    echo ❌ 错误: 这不是有效的 ToList 项目目录
    echo    请确保在项目根目录运行此脚本
    pause
    exit /b 1
)

set "PROJECT_PATH=%cd%"
echo 📍 项目路径: %PROJECT_PATH%
echo.

echo 1️⃣  安装 Node.js 依赖...
call npm install --production
if errorlevel 1 (
    echo ❌ Node.js 依赖安装失败
    pause
    exit /b 1
)
echo ✅ Node.js 依赖安装完成
echo.

echo 2️⃣  安装 Python 依赖...
cd backend
if not exist "venv" (
    echo    创建虚拟环境...
    call python -m venv venv
)
call venv\Scripts\activate.bat
call pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Python 依赖安装失败
    pause
    exit /b 1
)
call venv\Scripts\deactivate.bat
cd ..
echo ✅ Python 依赖安装完成
echo.

echo 3️⃣  创建日志目录...
if not exist "logs" mkdir logs
if not exist "backend\logs" mkdir backend\logs
echo ✅ 日志目录已创建
echo.

echo 4️⃣  创建 ecosystem.config.js...
(
echo module.exports = {
echo   apps: [
echo     {
echo       name: 'todolist-server',
echo       script: 'server.js',
echo       instances: 1,
echo       exec_mode: 'fork',
echo       env: {
echo         NODE_ENV: 'production',
echo         PORT: 3000
echo       },
echo       error_file: './logs/err.log',
echo       out_file: './logs/out.log',
echo       log_file: './logs/combined.log',
echo       time_format: 'YYYY-MM-DD HH:mm:ss Z'
echo     },
echo     {
echo       name: 'todolist-python',
echo       script: 'backend\\start_python.bat',
echo       exec_mode: 'fork',
echo       env: {
echo         PORT: 5000
echo       },
echo       error_file: './backend/logs/error.log',
echo       out_file: './backend/logs/out.log'
echo     }
echo   ]
echo };
) > ecosystem.config.js
echo ✅ ecosystem.config.js 已创建
echo.

echo 5️⃣  创建 Python 启动脚本...
(
echo @echo off
echo cd /d "%PROJECT_PATH%\backend"
echo call venv\Scripts\activate.bat
echo gunicorn -c gunicorn_config.py main:app
echo pause
) > backend\start_python.bat
echo ✅ start_python.bat 已创建
echo.

echo 6️⃣  创建 Python Gunicorn 配置...
(
echo import multiprocessing
echo import os
echo.
echo bind = "127.0.0.1:5000"
echo workers = min(multiprocessing.cpu_count() * 2 + 1, 8^)
echo worker_class = "sync"
echo timeout = 30
echo keepalive = 2
echo max_requests = 1000
echo max_requests_jitter = 100
echo.
echo os.makedirs('logs', exist_ok=True^)
echo accesslog = "logs/access.log"
echo errorlog = "logs/error.log"
echo loglevel = "info"
) > backend\gunicorn_config.py
echo ✅ gunicorn_config.py 已创建
echo.

echo 7️⃣  检查并安装 PM2...
where pm2 >nul 2>&1
if errorlevel 1 (
    echo    安装 PM2...
    call npm install -g pm2
    echo ✅ PM2 已安装
) else (
    echo ✅ PM2 已存在
)
echo.

echo ================================
echo ✅ 部署准备完成！
echo ================================
echo.
echo 📋 接下来的步骤：
echo.
echo 1. 启动应用:
echo    pm2 start ecosystem.config.js
echo.
echo 2. 查看应用状态:
echo    pm2 status
echo.
echo 3. 查看日志:
echo    pm2 logs
echo.
echo 4. 停止应用:
echo    pm2 stop all
echo.
echo 5. 重启应用:
echo    pm2 restart all
echo.
echo 🌐 应用将在以下地址运行:
echo    Node.js: http://127.0.0.1:3000
echo    Python:  http://127.0.0.1:5000
echo.
echo 📝 配置 Nginx 代理:
echo    将所有请求代理到 http://127.0.0.1:3000
echo    将 /api/gemini 代理到 http://127.0.0.1:5000
echo.
pause
