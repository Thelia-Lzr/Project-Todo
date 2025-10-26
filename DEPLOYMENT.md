## 🚀 ToList 项目部署指南

### 📋 项目结构

```
TodoList/
├── server.js              # Node.js Express 主服务器 (端口: 3000)
├── auth.js               # 认证中间件
├── db.js                 # SQLite3 数据库初始化
├── package.json          # Node.js 依赖配置
├── database.db           # SQLite3 数据库文件
│
├── routes/               # API 路由
│   ├── auth.js          # 认证相关: 登录、注册、验证
│   ├── todos.js         # 待办事项 CRUD 操作
│   ├── chat.js          # 聊天历史管理
│   └── permissions.js   # AI 权限管理
│
├── middleware/           # 中间件
├── public/              # 前端静态文件
│   ├── index.html       # 主页面
│   ├── style.css        # 样式表
│   └── script.js        # 前端应用逻辑
│
└── backend/             # Python Flask AI 服务 (端口: 5000)
    ├── main.py          # Flask 应用
    ├── requirements.txt # Python 依赖
    └── venv/            # 虚拟环境

```

### ⚙️ 前提条件

- **Node.js**: v14+ (https://nodejs.org/)
- **Python**: 3.8+ (https://www.python.org/)
- **SQLite3**: 已包含在大多数系统中
- **Git**: 用于版本控制（可选）

### 🔧 安装步骤

#### 1. 安装 Node.js 依赖

```bash
cd TodoList
npm install
```

#### 2. 安装 Python 依赖

```bash
cd backend
pip install -r requirements.txt
cd ..
```

#### 3. 环境配置

创建 `.env` 文件（根目录和 backend 目录都需要）：

**根目录 `.env`:**
```
NODE_ENV=production
JWT_SECRET=your_secret_key_here
JWT_EXPIRY=30d
```

**backend/.env:**
```
FLASK_ENV=production
FLASK_DEBUG=False
GEMINI_API_KEY=your_api_key_here
```

### 🚀 启动服务

#### 方式1: 分别启动两个服务

**终端1 - 启动 Node.js 服务器:**
```bash
node server.js
```
服务器将在 http://localhost:3000 运行

**终端2 - 启动 Python 后端:**
```bash
cd backend
python main.py
```
Python 服务将在 http://localhost:5000 运行

#### 方式2: 使用 PM2（推荐用于生产）

首先安装 PM2：
```bash
npm install -g pm2
```

创建 `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'todolist-node',
      script: 'server.js',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'todolist-python',
      script: 'backend/main.py',
      interpreter: 'python'
    }
  ]
};
```

启动：
```bash
pm2 start ecosystem.config.js
```

### 📊 API 端点

#### 认证相关
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/verify` - 验证 Token

#### 待办事项
- `GET /api/todos` - 获取所有待办事项
- `POST /api/todos` - 创建新待办事项
- `PATCH /api/todos/:id` - 更新待办事项
- `DELETE /api/todos/:id` - 删除待办事项

#### AI 权限
- `GET /api/permissions/info` - 获取用户权限信息
- `GET /api/permissions/check` - 检查是否可以使用 AI
- `POST /api/permissions/set` - 设置用户权限（管理员）

#### AI 聊天
- `POST /api/chat/session` - 创建/获取聊天会话
- `POST /api/chat/message` - 保存聊天消息
- `GET /api/chat/history/:sessionId` - 获取聊天历史
- `GET /api/chat/sessions` - 获取用户所有会话
- `DELETE /api/chat/session/:sessionId` - 删除聊天会话

### 🔐 数据库

项目使用 SQLite3，数据自动保存在 `database.db` 文件中。

#### 预创建用户
- **用户名**: test
- **密码**: 123456
- **权限**: LIMITED (60天)

- **用户名**: Thelia
- **密码**: TheliaThelia123
- **权限**: UNLIMITED

### 🌐 生产部署建议

1. **使用反向代理**（Nginx/Apache）
   ```nginx
   server {
       listen 80;
       server_name your_domain.com;

       location / {
           proxy_pass http://localhost:3000;
       }

       location /api/gemini {
           proxy_pass http://localhost:5000;
       }
   }
   ```

2. **HTTPS 配置**
   - 使用 Let's Encrypt SSL 证书

3. **进程管理**
   - 使用 PM2、Systemd 或其他进程管理工具

4. **日志管理**
   - 配置日志文件轮转

5. **备份策略**
   - 定期备份 `database.db` 文件

6. **性能优化**
   - 启用 gzip 压缩
   - 使用 CDN 加速静态资源
   - 配置合适的超时时间

### 🐛 故障排查

**端口已被占用**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

**数据库锁定**
- 确保只有一个 Node.js 进程在运行
- 检查是否有其他程序访问 database.db

**Python 依赖问题**
```bash
cd backend
pip install --upgrade -r requirements.txt
```

### 📝 监控和维护

- 监控应用日志
- 定期检查数据库大小
- 监控 CPU 和内存使用
- 定期更新依赖

### 📞 技术支持

如有问题，请检查：
1. 所有依赖是否正确安装
2. 环境变量是否正确配置
3. 数据库文件是否存在且可写
4. 两个后端服务是否都在运行
