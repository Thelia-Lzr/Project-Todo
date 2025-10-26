## ✅ ToList 项目最终清单

### 📦 核心应用文件

```
TodoList/
├── 📄 server.js                 # Node.js Express 主服务器
├── 📄 auth.js                   # JWT 认证中间件
├── 📄 db.js                     # SQLite3 数据库初始化
├── 📄 package.json              # Node.js 依赖配置
├── 📄 package-lock.json         # 依赖锁定文件
│
├── 📁 routes/                   # API 路由模块
│   ├── auth.js                  # 认证相关路由
│   ├── todos.js                 # 待办事项 CRUD
│   ├── chat.js                  # 聊天历史管理
│   └── permissions.js           # AI 权限管理
│
├── 📁 middleware/               # Express 中间件
│
├── 📁 public/                   # 前端静态文件
│   ├── index.html               # 主页面 HTML
│   ├── style.css                # 样式表
│   └── script.js                # 前端应用脚本
│
├── 📁 backend/                  # Python Flask AI 后端
│   ├── main.py                  # Flask 应用入口
│   ├── requirements.txt         # Python 依赖
│   ├── gunicorn_config.py      # Gunicorn 配置
│   └── 📁 venv/                # Python 虚拟环境
│
├── 📄 database.db              # SQLite3 数据库
├── 📄 .env                     # 环境变量配置
└── 📄 .gitignore              # Git 忽略文件
```

---

### 📚 部署文档

| 文件 | 描述 | 用途 |
|------|------|------|
| `QUICK_START.md` | ⚡ 5分钟快速启动 | 新手快速上手 |
| `BAOTA_DEPLOYMENT.md` | 🚀 宝塔详细部署 | 宝塔面板部署 |
| `DEPLOYMENT.md` | 📋 通用部署指南 | 通用部署参考 |
| `nginx.conf.example` | ⚙️ Nginx 配置示例 | 反向代理配置 |

---

### 🔧 部署脚本

| 脚本 | 平台 | 功能 |
|------|------|------|
| `deploy.sh` | Linux/Mac | 一键部署 |
| `deploy.bat` | Windows | 一键部署 |

---

### 🌐 服务端口

| 服务 | 端口 | 用途 |
|------|------|------|
| Node.js | 3000 | 主应用 + 前端 |
| Python | 5000 | Gemini AI 后端 |
| Nginx | 80/443 | 反向代理 |

---

### 📊 数据库信息

**SQLite3 数据库**: `database.db`

**表结构**:
- `users` - 用户账户
- `todos` - 待办事项
- `ai_permissions` - AI 权限管理
- `chat_sessions` - 聊天会话
- `chat_history` - 聊天历史

**预设用户**:
| 用户名 | 密码 | 权限 |
|--------|------|------|
| test | 123456 | LIMITED (60天) |
| Thelia | TheliaThelia123 | UNLIMITED |

---

### 🚀 快速部署命令

#### 1. 上传文件
```bash
cd /www/wwwroot/
git clone your_repo todolist
cd todolist
```

#### 2. 运行部署脚本
```bash
bash deploy.sh
```

#### 3. 启动应用
```bash
pm2 start ecosystem.config.js
```

#### 4. 配置 Nginx
在宝塔面板网站配置中参考 `nginx.conf.example`

#### 5. 完成！
访问 https://yourdomain.com

---

### 📋 API 端点列表

#### 认证 API
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/verify` - 验证 Token

#### 待办事项 API
- `GET /api/todos` - 获取所有待办事项
- `POST /api/todos` - 创建新待办事项
- `PATCH /api/todos/:id` - 更新待办事项
- `DELETE /api/todos/:id` - 删除待办事项

#### AI 权限 API
- `GET /api/permissions/info` - 获取权限信息
- `GET /api/permissions/check` - 检查是否可用
- `POST /api/permissions/set` - 设置权限(管理员)

#### AI 聊天 API
- `POST /api/chat/session` - 创建/获取会话
- `POST /api/chat/message` - 保存消息
- `GET /api/chat/history/:sessionId` - 获取历史
- `GET /api/chat/sessions` - 获取所有会话
- `DELETE /api/chat/session/:sessionId` - 删除会话

#### Gemini API
- `POST /api/gemini/init` - 初始化 Gemini
- `POST /api/gemini/chat` - 发送聊天

---

### 🔐 安全特性

✅ JWT 认证
✅ 密码加密存储
✅ CORS 保护
✅ 用户数据隔离
✅ SSL/HTTPS 支持
✅ 权限管理
✅ 会话管理
✅ 防火墙配置

---

### ⚙️ 性能优化

✅ Gzip 压缩
✅ 静态文件缓存
✅ Nginx 反向代理
✅ PM2 进程管理
✅ SQLite 优化
✅ 连接池管理
✅ 日志轮转

---

### 📈 监控指标

```bash
# 查看应用状态
pm2 status

# 监控资源使用
pm2 monit

# 查看实时日志
pm2 logs

# 查看详细日志
tail -f logs/out.log
tail -f backend/logs/access.log
```

---

### 🆘 常见问题快速解决

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 502 Bad Gateway | 后端未运行 | `pm2 restart all` |
| 无法连接 | 防火墙/Nginx 问题 | 检查防火墙和 Nginx 配置 |
| 数据库锁定 | 进程冲突 | 重启应用 |
| 内存溢出 | 应用泄漏 | 增加内存限制 |

---

### ✨ 验证清单

部署完成后，检查以下项目：

- [ ] 应用可以通过浏览器访问
- [ ] 登录功能正常
- [ ] 待办事项能够增删改查
- [ ] AI 聊天功能工作
- [ ] 权限显示正确
- [ ] 日志正常记录
- [ ] SSL 证书有效
- [ ] 性能监控就位

---

### 📞 技术支持

如遇问题，请按照以下顺序排查：

1. **查看日志**
   ```bash
   pm2 logs
   ```

2. **检查服务状态**
   ```bash
   pm2 status
   lsof -i :3000
   lsof -i :5000
   ```

3. **查看 Nginx 配置**
   ```bash
   nginx -t
   tail -f /var/log/nginx/error.log
   ```

4. **重启服务**
   ```bash
   pm2 restart all
   systemctl restart nginx
   ```

---

### 📝 最后提醒

1. **修改默认密钥**: 在 `.env` 中修改 `JWT_SECRET`
2. **配置 Gemini API**: 在 `backend/.env` 中设置 API Key
3. **定期备份**: 备份 `database.db` 文件
4. **监控日志**: 定期检查应用日志
5. **更新依赖**: 定期更新 npm 和 pip 包

---

**项目已准备好部署！** 🎉

更多详细信息请查看 `QUICK_START.md` 或 `BAOTA_DEPLOYMENT.md`
