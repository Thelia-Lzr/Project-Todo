## 🚀 宝塔部署快速指南

### 📋 项目信息

- **项目名称**: ToList - 待办事项管理系统 + AI 助手
- **技术栈**: Node.js + Python Flask + SQLite3
- **前端端口**: 3000
- **后端端口**: 5000

---

## ⚡ 快速启动（5分钟）

### 步骤 1: 上传项目文件

```bash
# 通过 SSH 连接到服务器
ssh root@your_server_ip

# 进入部署目录
cd /www/wwwroot/

# 上传项目（使用 git 或 FTP）
git clone your_repo_url todolist
# 或通过宝塔文件管理器上传

cd todolist
```

### 步骤 2: 运行部署脚本

```bash
# Linux/Mac
bash deploy.sh

# 或者手动执行
npm install --production
cd backend && pip install -r requirements.txt && cd ..
npm install -g pm2
pm2 start ecosystem.config.js
```

### 步骤 3: 配置 Nginx（宝塔面板）

1. **添加网站** → 选择你的域名
2. **配置文件** → 复制 `nginx.conf.example` 中的内容
3. **保存** → **重启 Nginx**

### 步骤 4: 验证应用

```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs

# 测试本地访问
curl http://127.0.0.1:3000
```

---

## 📝 详细配置

### Nginx 配置（宝塔面板）

在宝塔面板中，选择你的网站 → **配置文件**，添加以下内容：

```nginx
# 上游服务定义
upstream nodejs_backend {
    server 127.0.0.1:3000;
}

upstream python_backend {
    server 127.0.0.1:5000;
}

server {
    # Python API 代理
    location /api/gemini/ {
        proxy_pass http://python_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # Node.js 应用代理
    location / {
        proxy_pass http://nodejs_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

保存后重启 Nginx。

### 环境变量配置

**项目根目录 `.env` 文件：**
```
NODE_ENV=production
JWT_SECRET=your_very_secure_secret_key_here
JWT_EXPIRY=30d
PORT=3000
```

**Backend `.env` 文件 (`backend/.env`)：**
```
FLASK_ENV=production
FLASK_DEBUG=False
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
```

---

## 🔧 常用命令

```bash
# 启动应用
pm2 start ecosystem.config.js

# 停止应用
pm2 stop all

# 重启应用
pm2 restart all

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 删除应用
pm2 delete all

# 设置开机自启
pm2 startup
pm2 save

# 监控应用
pm2 monit
```

---

## 🔐 SSL 配置（推荐）

### 在宝塔面板中配置 SSL

1. 选择网站 → **SSL**
2. 选择 **Let's Encrypt** 或其他免费 SSL
3. 点击 **申请**
4. 自动配置完成

### 强制 HTTPS（自动重定向）

Nginx 配置文件中已包含此功能。

---

## 📊 默认用户

应用预包含两个测试用户：

| 用户名 | 密码 | 权限 | 天数 |
|--------|------|------|------|
| test | 123456 | LIMITED | 60天 |
| Thelia | TheliaThelia123 | UNLIMITED | 无限 |

---

## ✅ 测试清单

- [ ] 应用已启动
- [ ] 可以通过浏览器访问
- [ ] 登录功能正常
- [ ] 待办事项 CRUD 正常
- [ ] AI 聊天功能正常
- [ ] 权限显示正确
- [ ] SSL 证书已配置
- [ ] 日志正常记录

---

## 🐛 常见问题

### 问题 1: 502 Bad Gateway

**原因**: 后端服务未运行或端口错误

**解决方案**:
```bash
# 检查服务状态
pm2 status

# 重启服务
pm2 restart all

# 检查端口
lsof -i :3000
lsof -i :5000
```

### 问题 2: 无法连接到应用

**原因**: 防火墙未开放端口或 Nginx 未启动

**解决方案**:
```bash
# 检查防火墙
sudo ufw status
sudo ufw allow 80
sudo ufw allow 443

# 重启 Nginx
systemctl restart nginx

# 检查 Nginx 错误
nginx -t
cat /var/log/nginx/error.log
```

### 问题 3: 数据库锁定

**原因**: 多个进程同时访问数据库

**解决方案**:
```bash
# 重启应用
pm2 restart all

# 或者检查进程
ps aux | grep node
ps aux | grep python
```

### 问题 4: 内存溢出

**原因**: 应用占用内存过多

**解决方案**:
```bash
# 在 ecosystem.config.js 中添加内存限制
max_memory_restart: "500M"

# 重启应用
pm2 restart all
```

---

## 📈 性能优化

### 1. 启用 Gzip 压缩

在 Nginx 配置中添加：
```nginx
gzip on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/json;
```

### 2. 启用缓存

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 3. 增加 PM2 进程数

```bash
pm2 start ecosystem.config.js -i max
```

### 4. 定期备份

```bash
# 创建备份脚本
crontab -e

# 每天凌晨 2 点备份
0 2 * * * cp /www/wwwroot/todolist/database.db /backup/database.db.$(date +%Y%m%d)
```

---

## 📚 更多资源

- **完整部署指南**: 查看 `BAOTA_DEPLOYMENT.md`
- **项目架构**: 查看 `DEPLOYMENT.md`
- **宝塔文档**: https://www.bt.cn
- **PM2 文档**: https://pm2.keymetrics.io

---

## 🆘 需要帮助？

1. **查看应用日志**:
   ```bash
   pm2 logs
   tail -f logs/out.log
   tail -f backend/logs/error.log
   ```

2. **检查 Nginx 配置**:
   ```bash
   nginx -t
   tail -f /var/log/nginx/error.log
   ```

3. **检查防火墙**:
   ```bash
   sudo ufw status
   ```

4. **重启所有服务**:
   ```bash
   pm2 restart all
   systemctl restart nginx
   ```

---

## ✨ 完成标志

当你看到以下信息时，说明部署成功：

```
pm2 status 输出:
┌─────┬──────────────────┬─────────┬─────────┬──────────┬────────┐
│ id  │ name             │ version │ mode    │ uptime   │ status │
├─────┼──────────────────┼─────────┼─────────┼──────────┼────────┤
│ 0   │ todolist-server  │ 1.0.0   │ fork    │ 1m       │ online │
│ 1   │ todolist-python  │ 1.0.0   │ fork    │ 1m       │ online │
└─────┴──────────────────┴─────────┴─────────┴──────────┴────────┘

能通过浏览器访问应用
登录成功
待办事项 CRUD 正常
AI 聊天功能正常
权限显示正确
```

---

**祝您部署顺利！** 🎉
