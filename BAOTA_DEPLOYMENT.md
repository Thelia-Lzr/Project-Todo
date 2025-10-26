## 🚀 ToList 项目在宝塔面板上的部署指南

### 📋 部署前准备

- 宝塔面板已安装
- Node.js 已通过宝塔安装
- Python 已通过宝塔安装
- SQLite3 支持已启用

---

## 第一步：上传项目文件

### 1.1 使用宝塔面板文件管理器上传

1. 登录宝塔面板
2. 点击 **文件** → 找到需要部署的目录（建议 `/www/wwwroot/`)
3. 上传项目文件到服务器
   - 建议使用 FTP 或宝塔面板的文件管理器
   - 或使用 `git clone` 命令

### 1.2 使用 SSH 上传（推荐）

```bash
# 连接到服务器
ssh root@your_server_ip

# 进入部署目录
cd /www/wwwroot/

# 克隆或上传项目
git clone https://your_repo_url.git todolist
# 或使用 SCP/FTP 上传

cd todolist
```

---

## 第二步：配置 Node.js 应用

### 2.1 在宝塔面板中添加 Node.js 应用

1. 登录宝塔面板
2. 点击 **Node.js项目** 或 **应用**
3. 点击 **添加项目**
4. 填写以下信息：

```
项目名称: ToList
项目路径: /www/wwwroot/todolist
启动文件: server.js
Node版本: v14+ (根据你安装的版本选择)
监听端口: 3000
启用SSL: 根据需要选择
```

### 2.2 手动配置（如果宝塔不支持自动管理）

1. SSH 连接到服务器
2. 进入项目目录：
   ```bash
   cd /www/wwwroot/todolist
   ```

3. 安装 Node.js 依赖：
   ```bash
   npm install --production
   ```

4. 创建 PM2 启动脚本
   
   创建文件 `/www/wwwroot/todolist/ecosystem.config.js`:
   ```javascript
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
         error_file: '/www/wwwroot/todolist/logs/err.log',
         out_file: '/www/wwwroot/todolist/logs/out.log',
         log_file: '/www/wwwroot/todolist/logs/combined.log',
         time_format: 'YYYY-MM-DD HH:mm:ss Z'
       }
     ]
   };
   ```

5. 在宝塔 SSH 终端中运行：
   ```bash
   # 全局安装 PM2
   npm install -g pm2
   
   # 启动应用
   pm2 start ecosystem.config.js
   
   # 设置开机自启
   pm2 startup
   pm2 save
   ```

---

## 第三步：配置 Python Flask 后端

### 3.1 在宝塔面板中添加 Python 应用

1. 点击 **Python项目** 或相关选项
2. 点击 **添加项目**
3. 填写以下信息：

```
项目名称: ToList-Backend
项目路径: /www/wwwroot/todolist/backend
启动文件: main.py
Python版本: 3.8+ (根据你安装的版本)
监听端口: 5000
启用SSL: 根据需要选择
```

### 3.2 手动配置 Python 应用

1. SSH 连接并进入后端目录：
   ```bash
   cd /www/wwwroot/todolist/backend
   ```

2. 创建 Python 虚拟环境：
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # Linux/Mac
   # 或 venv\Scripts\activate (Windows)
   ```

3. 安装依赖：
   ```bash
   pip install -r requirements.txt
   ```

4. 创建 Gunicorn 配置文件 `gunicorn_config.py`:
   ```python
   import multiprocessing
   
   bind = "127.0.0.1:5000"
   workers = multiprocessing.cpu_count() * 2 + 1
   worker_class = "sync"
   timeout = 30
   keepalive = 2
   max_requests = 1000
   max_requests_jitter = 100
   
   # 日志配置
   accesslog = "/www/wwwroot/todolist/backend/logs/access.log"
   errorlog = "/www/wwwroot/todolist/backend/logs/error.log"
   loglevel = "info"
   ```

5. 使用 Gunicorn 启动应用：
   ```bash
   gunicorn -c gunicorn_config.py main:app
   ```

6. 或使用 PM2 启动 Python 应用
   
   创建启动脚本 `/www/wwwroot/todolist/start_python.sh`:
   ```bash
   #!/bin/bash
   cd /www/wwwroot/todolist/backend
   source venv/bin/activate
   gunicorn -c gunicorn_config.py main:app
   ```

   给脚本执行权限：
   ```bash
   chmod +x /www/wwwroot/todolist/start_python.sh
   ```

   创建 PM2 配置 `/www/wwwroot/todolist/ecosystem.config.js` (更新):
   ```javascript
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
         }
       },
       {
         name: 'todolist-python',
         script: './start_python.sh',
         exec_mode: 'fork',
         env: {
           PORT: 5000
         }
       }
     ]
   };
   ```

---

## 第四步：配置 Nginx 反向代理

### 4.1 通过宝塔面板配置

1. 点击 **网站** → 选择你的域名
2. 点击 **配置文件**
3. 找到 `upstream` 部分，添加以下配置：

```nginx
upstream nodejs_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

upstream python_backend {
    server 127.0.0.1:5000;
    keepalive 64;
}

server {
    listen 80;
    listen 443 ssl;
    server_name yourdomain.com;
    
    # SSL 证书配置（如果启用了 HTTPS）
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # 主应用代理
    location / {
        proxy_pass http://nodejs_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Python 后端代理
    location /api/gemini/ {
        proxy_pass http://python_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

4. 点击 **保存** 并重启 Nginx

### 4.2 手动配置 Nginx

编辑 Nginx 配置文件：
```bash
nano /etc/nginx/conf.d/todolist.conf
```

填入上述配置内容，然后测试和重启：
```bash
nginx -t
systemctl restart nginx
```

---

## 第五步：环境变量配置

### 5.1 创建 .env 文件

1. 项目根目录 `.env`:
   ```bash
   NODE_ENV=production
   JWT_SECRET=your_very_secure_random_string_here_change_this
   JWT_EXPIRY=30d
   PORT=3000
   ```

2. 后端目录 `backend/.env`:
   ```bash
   FLASK_ENV=production
   FLASK_DEBUG=False
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=5000
   ```

### 5.2 在宝塔面板中设置环境变量

1. 进入项目目录
2. 创建 `.env` 文件
3. 添加必要的环境变量

---

## 第六步：启动和测试

### 6.1 使用宝塔面板启动

1. 点击 **Node.js项目** 或 **Python项目**
2. 找到你的应用
3. 点击 **启动** 按钮

### 6.2 使用 SSH 启动

```bash
# 进入项目目录
cd /www/wwwroot/todolist

# 安装依赖
npm install --production
cd backend
pip install -r requirements.txt
cd ..

# 使用 PM2 启动
pm2 start ecosystem.config.js

# 查看运行状态
pm2 status

# 查看日志
pm2 logs
```

### 6.3 测试应用

```bash
# 测试 Node.js 服务
curl http://127.0.0.1:3000

# 测试 Python 服务
curl http://127.0.0.1:5000/api/gemini/init

# 通过域名测试
curl http://yourdomain.com
```

---

## 第七步：数据库初始化

首次运行时，应用会自动创建 SQLite 数据库：

```bash
# 预创建用户（可选）
# test / 123456 (LIMITED 60天)
# Thelia / TheliaThelia123 (UNLIMITED)
```

---

## 第八步：SSL 配置（强烈推荐）

### 8.1 使用宝塔面板申请 SSL

1. 点击 **网站** → 选择域名
2. 点击 **SSL**
3. 选择 **Let's Encrypt** 或其他免费 SSL
4. 点击 **申请** 即可自动配置

### 8.2 强制 HTTPS

在 Nginx 配置中添加：
```nginx
# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## 第九步：性能优化

### 9.1 启用 Gzip 压缩

在 Nginx 配置中添加：
```nginx
gzip on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss;
gzip_vary on;
```

### 9.2 启用缓存

```nginx
# 缓存 API 响应（可选）
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=1g inactive=60m use_temp_path=off;

location /api/ {
    proxy_cache api_cache;
    proxy_cache_valid 200 10m;
    proxy_pass http://nodejs_backend;
}
```

### 9.3 数据库优化

```bash
# 定期备份数据库
cp /www/wwwroot/todolist/database.db /backup/database.db.$(date +%Y%m%d)
```

---

## 第十步：监控和维护

### 10.1 在宝塔面板中监控

1. 点击 **监控** 查看系统资源使用情况
2. 点击 **日志** 查看应用日志
3. 点击 **安全** 配置防火墙规则

### 10.2 查看应用日志

```bash
# 查看 PM2 日志
pm2 logs

# 查看 Node.js 日志
tail -f /www/wwwroot/todolist/logs/out.log

# 查看 Python 日志
tail -f /www/wwwroot/todolist/backend/logs/access.log
```

### 10.3 定期备份

```bash
# 创建备份脚本
crontab -e

# 添加每天凌晨 2 点备份
0 2 * * * cp -r /www/wwwroot/todolist /backup/todolist.$(date +\%Y\%m\%d)
0 2 * * * cp /www/wwwroot/todolist/database.db /backup/database.db.$(date +\%Y\%m\%d)
```

---

## 故障排查

### 问题 1: 应用无法启动

```bash
# 检查端口是否被占用
lsof -i :3000
lsof -i :5000

# 检查日志
pm2 logs
cat /var/log/nginx/error.log

# 检查权限
chmod -R 755 /www/wwwroot/todolist
```

### 问题 2: 连接被拒绝

```bash
# 检查防火墙规则
sudo ufw status
sudo ufw allow 3000
sudo ufw allow 5000

# 或在宝塔面板中配置防火墙
```

### 问题 3: 数据库锁定

```bash
# 检查进程
ps aux | grep node
ps aux | grep python

# 重启应用
pm2 restart all
```

### 问题 4: 内存溢出

```bash
# 增加 PM2 内存限制
pm2 start ecosystem.config.js --max-memory-restart 1G

# 或在 ecosystem.config.js 中添加
max_memory_restart: "1G"
```

---

## 常用命令

```bash
# 启动应用
pm2 start ecosystem.config.js

# 停止应用
pm2 stop all

# 重启应用
pm2 restart all

# 删除应用
pm2 delete all

# 查看状态
pm2 status

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs

# 监控
pm2 monit
```

---

## 安全建议

1. **更改默认端口密码**
   ```bash
   # 修改宝塔面板密码
   # 修改 MySQL/数据库密码
   ```

2. **设置 SSH 密钥认证**
   ```bash
   # 禁用密码登录
   # 只允许密钥登录
   ```

3. **配置防火墙**
   - 只开放必要的端口（80, 443）
   - 限制对管理端口的访问

4. **定期更新**
   ```bash
   apt update && apt upgrade -y
   npm update
   pip install --upgrade -r requirements.txt
   ```

5. **监控和告警**
   - 配置宝塔面板告警
   - 监控磁盘空间
   - 监控内存使用

---

## 成功标志

✅ 应用已启动
✅ 可以通过浏览器访问
✅ 登录功能正常
✅ 待办事项 CRUD 操作正常
✅ AI 聊天功能正常
✅ 权限显示正确
✅ SSL 证书已配置
✅ 日志记录正常

---

## 需要帮助？

- 检查宝塔面板文档：https://www.bt.cn
- 查看项目日志获取详细错误信息
- 确保两个后端服务都在运行
- 检查防火墙和 Nginx 配置
