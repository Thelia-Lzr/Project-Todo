#!/usr/bin/env bash
# 一键部署脚本（宝塔/通用 Linux）
# 用法：sudo ./deploy_bt.sh <DOMAIN> [GIT_REPO] [BRANCH] [SITE_DIR]
# 例如：sudo ./deploy_bt.sh todo.thelia.site https://github.com/Thelia-Lzr/Project-Todo.git main /www/wwwroot/todo.thelia.site

set -euo pipefail
IFS=$'\n\t'

DOMAIN=${1:-}
GIT_REPO=${2:-https://github.com/Thelia-Lzr/Project-Todo.git}
BRANCH=${3:-main}
SITE_DIR=${4:-/www/wwwroot/${DOMAIN}}

if [ -z "$DOMAIN" ]; then
  echo "Usage: sudo $0 <DOMAIN> [GIT_REPO] [BRANCH] [SITE_DIR]"
  exit 1
fi

echo "部署信息："
echo "  DOMAIN: $DOMAIN"
echo "  GIT_REPO: $GIT_REPO"
echo "  BRANCH: $BRANCH"
echo "  SITE_DIR: $SITE_DIR"

# 检查是否 root
if [ "$EUID" -ne 0 ]; then
  echo "请以 root 或 sudo 权限运行此脚本" >&2
  exit 1
fi

# 安装系统依赖（Ubuntu/Debian）
echo "更新并安装系统依赖..."
apt update
apt install -y git curl wget unzip build-essential nginx certbot python3-certbot-nginx python3 python3-venv python3-pip sqlite3

# 安装 Node.js 18+（如果未安装）
if ! command -v node >/dev/null 2>&1; then
  echo "安装 Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt install -y nodejs
fi

# 安装 pm2 全局
if ! command -v pm2 >/dev/null 2>&1; then
  echo "安装 pm2..."
  npm install -g pm2
fi

# 创建网站目录并拉取代码
echo "创建站点目录并克隆仓库..."
mkdir -p "$SITE_DIR"
chown -R $SUDO_USER:$SUDO_USER "$SITE_DIR"
cd "$SITE_DIR"
if [ -d ".git" ]; then
  echo "已有 git 仓库，拉取并切换分支..."
  git fetch --all
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  echo "克隆仓库到 $SITE_DIR ..."
  rm -rf "$SITE_DIR"/* || true
  git clone --depth 1 -b "$BRANCH" "$GIT_REPO" "$SITE_DIR"
fi

# 前端部署（如果有 build 脚本则构建静态）
cd "$SITE_DIR"
if [ -f package.json ] && grep -q '"build"' package.json; then
  echo "检测到 build 脚本，构建前端静态文件..."
  npm install --unsafe-perm
  npm run build
  BUILD_DIR="$(node -p "require('./package.json').homepage ? 'build' : 'build'" 2>/dev/null || echo build)"
  # 通常是 build/ 或 dist/；尝试常用目录
  if [ -d "$SITE_DIR/build" ]; then
    FRONTEND_ROOT="$SITE_DIR/build"
  elif [ -d "$SITE_DIR/dist" ]; then
    FRONTEND_ROOT="$SITE_DIR/dist"
  else
    FRONTEND_ROOT="$SITE_DIR/build"
  fi
  echo "前端构建完成，静态目录：$FRONTEND_ROOT"
else
  echo "未检测到 build 脚本，改用 pm2 启动 Node（npm start）"
  npm install --unsafe-perm || true
  pm2 start npm --name todo-node -- start || true
  pm2 save || true
fi

# Python 后端准备
cd "$SITE_DIR/backend"
if [ ! -d ".venv" ]; then
  echo "创建 Python 虚拟环境..."
  python3 -m venv .venv
fi
source .venv/bin/activate
if [ -f requirements.txt ]; then
  pip install -r requirements.txt
else
  pip install --upgrade pip
  pip install flask gunicorn google-generativeai
fi

# 创建 .env 模板（注意：不要把真实密钥写入脚本）
ENV_FILE="$SITE_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "创建 backend/.env 模板（请手动编辑真实密钥）"
  cat > "$ENV_FILE" <<EOF
# 请在此文件中填写你的敏感信息，不要提交到 git
GEMINI_API_KEY=REPLACE_ME
JWT_SECRET=REPLACE_WITH_RANDOM_STRING
FLASK_ENV=production
EOF
  chmod 600 "$ENV_FILE"
else
  echo ".env 已存在，跳过创建"
fi

# 生成 systemd 单元文件
SERVICE_FILE="/etc/systemd/system/todo-backend.service"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=TodoList Python Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=$SITE_DIR/backend
EnvironmentFile=$SITE_DIR/backend/.env
ExecStart=$SITE_DIR/backend/.venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 main:app
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

# 设置权限，重载并启动服务
chmod 644 "$SERVICE_FILE"
systemctl daemon-reload
systemctl enable todo-backend
# 尝试启动（失败时不 exit，后面会打印日志帮助排查）
if systemctl start todo-backend; then
  echo "todo-backend 已启动"
else
  echo "启动 todo-backend 失败，请检查日志: sudo journalctl -u todo-backend -n 200 --no-pager"
fi

# Nginx 配置（静态或代理）
NGINX_SITE_CONF="/etc/nginx/sites-available/$DOMAIN"
if [ -d "$FRONTEND_ROOT" ]; then
  echo "生成 Nginx 配置：静态文件提供 + /api/ 反代到 Python"
  cat > "$NGINX_SITE_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    root $FRONTEND_ROOT;
    index index.html index.htm;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF
else
  echo "生成 Nginx 配置：代理到 Node(3000) + /api/ 反代到 Python"
  cat > "$NGINX_SITE_CONF" <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
fi

# 启用 nginx 配置
ln -sf "$NGINX_SITE_CONF" /etc/nginx/sites-enabled/$DOMAIN
nginx -t && systemctl reload nginx || echo "Nginx 配置测试或重载失败，请检查 /var/log/nginx/error.log"

# pm2 处理（如果未构建静态）
if [ ! -d "$FRONTEND_ROOT" ]; then
  echo "确保 pm2 启动 Node（如需）"
  su - $SUDO_USER -c "cd $SITE_DIR && npm install --unsafe-perm && pm2 start npm --name todo-node -- start || true; pm2 save || true"
fi

# 申请 SSL（可选）
read -p "是否现在用 certbot/Let's Encrypt 为 $DOMAIN 申请 SSL？(y/N): " APPLY_SSL
if [[ "$APPLY_SSL" =~ ^[Yy]$ ]]; then
  certbot --nginx -d "$DOMAIN"
fi

echo "部署脚本执行完成。请："
echo "  1) 编辑 $SITE_DIR/backend/.env 填入真实的 GEMINI_API_KEY 和 JWT_SECRET 等。"
echo "  2) 如果 todo-backend 无法启动，请运行: sudo journalctl -u todo-backend -n 200 --no-pager" 
echo "  3) 如果使用静态模式，请确保 Nginx root 指向正确的构建目录。"

echo "脚本结束。"
