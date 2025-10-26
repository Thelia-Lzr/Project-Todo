# Project Todo

一个现代化的全栈待办事项管理应用，集成了 AI 智能助手功能。使用 Node.js + SQLite 构建后端，支持用户认证、待办事项 CRUD 操作，并通过 Google Gemini AI 提供智能任务管理建议。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![Python](https://img.shields.io/badge/python-%3E%3D3.8-blue.svg)

## ✨ 主要功能

### 📝 待办事项管理
- ✅ 创建、编辑、删除待办事项
- ✅ 设置截止时间并自动显示时间状态（逾期/今天/未来）
- ✅ 一键标记完成/未完成
- ✅ 智能排序（按截止时间自动排序）
- ✅ 统计数据展示（总数/待完成/已完成）

### 🤖 AI 智能助手
- 🎯 基于 Google Gemini 2.5 Flash 的智能对话
- 🔧 支持通过自然语言操作待办事项
- 📋 AI 可执行命令：
  - `ADD` - 添加新任务（支持同时设置截止时间）
  - `COMPLETE` - 标记任务完成
  - `DELETE` - 删除任务
  - `UPDATE` - 更新任务名称
  - `SETDUEDATE` - 设置/修改截止时间
- 💡 主动分析任务列表并给出优化建议
- 🎨 Markdown 渲染支持（代码高亮、表格、列表等）
- 💬 会话历史保存

### 👥 用户系统
- 🔐 用户注册/登录（JWT 认证）
- 👤 多用户支持，数据隔离
- 🔑 安全的密码加密存储
- 🎫 管理员权限系统
- 👨‍💼 管理员面板（用户管理、权限控制）

### 🔐 管理员功能
- 👀 查看所有用户列表
- 🎫 AI 权限管理：
  - 授予用户 AI 使用权限
  - 设置权限类型（无限制/限时/按天数）
  - 查看权限过期时间
  - 撤销权限
- 📊 用户统计信息
- 🗑️ 删除用户账号

### 📱 响应式设计
- 💻 桌面端：左右分栏布局（待办事项 2/3 + AI 聊天 1/3）
- 📱 移动端：底部导航栏切换视图
- 🎨 现代化 UI 设计，支持浅色主题
- ⌨️ 多行输入支持（Shift+Enter 换行，Enter 发送）

## 🛠️ 技术栈

### 前端
- **HTML5 / CSS3** - 原生实现，无框架依赖
- **JavaScript (ES6+)** - 模块化代码组织
- **Fetch API** - 异步数据交互
- **响应式设计** - 移动优先，多断点适配

### 后端
- **Node.js + Express** - RESTful API 服务器
- **SQLite3** - 轻量级数据库
- **JWT** - 用户认证
- **bcryptjs** - 密码加密

### AI 服务
- **Python + Flask** - Gemini API 代理服务
- **Google Generative AI** - Gemini 2.5 Flash 模型
- **CORS** - 跨域支持

## 📦 安装与运行

### 环境要求
- Node.js >= 14.0.0
- Python >= 3.8
- npm 或 yarn

### 1. 克隆项目
```bash
git clone https://github.com/Thelia-Lzr/Project-Todo.git
cd Project-Todo
```

## 📫 作者与仓库

本项目由 GitHub 用户 `Thelia-Lzr` 维护。仓库地址：https://github.com/Thelia-Lzr/Project-Todo

### 2. 配置环境变量

#### 2.1 Node.js 后端配置
```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑 .env 文件，设置 JWT 密钥
# JWT_SECRET=your-secret-key-here
```

#### 2.2 Python 后端配置
```bash
# 进入 backend 目录
cd backend

# 复制环境变量示例文件
cp .env.example .env

# 编辑 .env 文件，添加你的 Gemini API Key
# GEMINI_API_KEY=your_gemini_api_key_here
```

**获取 Gemini API Key：**
1. 访问 [Google AI Studio](https://ai.google.dev/)
2. 登录 Google 账号
3. 创建 API Key
4. 将 API Key 填入 `backend/.env` 文件

### 3. 安装依赖

#### 3.1 安装 Node.js 依赖
```bash
# 返回项目根目录
cd ..

# 安装依赖
npm install
```

#### 3.2 安装 Python 依赖
```bash
# 进入 backend 目录
cd backend

# 创建虚拟环境（可选但推荐）
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 4. 启动服务

#### 方法一：分别启动（推荐开发时使用）

**终端 1 - 启动 Node.js 服务器：**
```bash
# 在项目根目录
npm start
# 服务器运行在 http://localhost:3000
```

**终端 2 - 启动 Python AI 服务：**
```bash
# 在 backend 目录
cd backend
python main.py
# AI 服务运行在 http://localhost:5000
```

#### 方法二：一键启动（需要配置）
```bash
# 可以使用 concurrently 或 pm2 同时启动两个服务
npm run dev
```

### 5. 访问应用
打开浏览器访问：`http://localhost:3000`

## 📖 使用指南

### 注册/登录
1. 首次使用需要注册账号
2. 输入用户名、密码（可选邮箱）
3. 登录后即可使用全部功能

### 添加待办事项
- 在输入框中输入任务内容
- （可选）选择截止时间
- 点击"添加"按钮

### 使用 AI 助手

#### 配置 API Key（仅首次）
1. 点击"设置 API Key"
2. 输入你的 Gemini API Key
3. 点击保存

#### 与 AI 对话
- **自然语言创建任务**：
  - "帮我创建一个任务：明天下午3点完成项目报告"
  - AI 会自动解析并创建带截止时间的任务

- **管理任务**：
  - "把第一个任务标记为完成"
  - "删除所有已完成的任务"
  - "将任务3的截止时间改为后天"

- **获取建议**：
  - "分析一下我的任务列表"
  - "哪些任务最紧急？"
  - "帮我整理一下待办事项"

### 管理员功能

#### 成为管理员
- **第一个注册的用户自动成为管理员**
- 管理员账号（用户ID = 1）拥有以下特权：
  - 无限制使用AI功能（永久有效）
  - 访问管理员面板
  - 创建新用户账号
  - 管理所有用户的权限
  - 删除用户账号（不能删除自己）

#### 访问管理员面板
1. 确保你是第一个注册的用户（管理员）
2. 登录后访问 `http://localhost:3000/admin.html`
3. 输入管理员密码验证身份

#### 用户管理

**创建新用户**
1. 点击"+ 添加用户"按钮
2. 填写用户信息：
   - **用户名**：必填，不能与已有用户重复
   - **密码**：必填，至少6个字符
   - **邮箱**：可选
   - **AI 权限类型**：
     - **无限制**：永久使用AI功能
     - **有限期**（默认）：限制使用期限
   - **有效天数**：如果选择"有限期"，设置天数（默认30天）
3. 点击"添加"完成创建

**注意**：注册功能仅在数据库为空时开放（用于创建管理员）。之后所有用户必须由管理员在管理面板中创建。

**查看用户列表**
- 显示所有注册用户及其基本信息
- 显示AI权限状态和过期时间

**编辑 AI 权限**
- 点击用户旁的"编辑权限"按钮
- 修改权限类型或有效天数
- 保存更改

**删除用户**
- 点击"删除"按钮（需确认）
- 管理员账号不能被删除

#### API Key 管理
管理员可以在管理面板中管理 Gemini API Key：

**查看当前 API Key**
- API Key 默认隐藏显示（显示前8位和后4位）
- 点击眼睛图标可显示/隐藏完整的 API Key

**修改 API Key**
1. 点击"修改 API Key"按钮
2. 输入新的 API Key（需要以 `AIza` 开头）
3. 再次输入确认
4. 保存后需要重启后端服务才能生效

**查看使用配额**
- 点击"🔄 刷新配额"按钮检查当前 API 状态
- 显示 API Key 是否有效
- 显示当前使用的模型信息
- **使用限制（Gemini 2.0 Flash 免费版）**：
  - 每分钟请求数（RPM）：15次
  - 每分钟Token数（TPM）：1,000,000 tokens
  - 每天请求数（RPD）：1,500次
- 显示支持的功能列表

**注意**：
- API Key 保存在服务器端的 `backend/.env` 文件中，不会暴露给普通用户
- Gemini API 免费版主要受请求频率限制，而非月度配额
- 如果遇到 429 错误，说明达到了速率限制，需要等待1分钟后重试

#### AI 权限类型说明
- **无限制（UNLIMITED）**：用户可永久使用AI功能，无时间限制
- **有限期（LIMITED）**：权限在指定天数后自动过期，需要管理员重新授予

## 🏗️ 项目结构

```
Project-Todo/
├── backend/                 # Python AI 服务
│   ├── main.py             # Flask 应用入口
│   ├── requirements.txt    # Python 依赖
│   ├── .env.example        # 环境变量示例
│   └── venv/               # Python 虚拟环境（git忽略）
├── public/                 # 前端静态文件
│   ├── index.html          # 主页面
│   ├── admin.html          # 管理员面板
│   ├── script.js           # 前端逻辑
│   ├── admin-script.js     # 管理员面板逻辑
│   ├── style.css           # 样式文件
│   ├── admin-style.css     # 管理员面板样式
│   └── time-utils.js       # 时间处理工具
├── routes/                 # Node.js 路由
│   ├── auth.js             # 认证路由
│   ├── todos.js            # 待办事项路由
│   ├── chat.js             # 聊天路由
│   ├── permissions.js      # 权限管理路由
│   └── admin.js            # 管理员路由
├── auth.js                 # JWT 认证中间件
├── db.js                   # 数据库初始化
├── server.js               # Node.js 服务器入口
├── package.json            # Node.js 依赖配置
├── .env.example            # 环境变量示例
├── .gitignore              # Git 忽略文件
└── README.md               # 项目说明文档
```

## 🔧 API 接口文档

### 认证接口
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出

### 待办事项接口
- `GET /api/todos` - 获取待办列表
- `POST /api/todos` - 创建待办事项
- `PUT /api/todos/:id` - 更新待办事项
- `DELETE /api/todos/:id` - 删除待办事项

### AI 接口
- `POST /api/gemini/init` - 初始化 Gemini API
- `POST /api/gemini/chat` - 发送聊天消息

### 权限管理接口
- `GET /api/permissions` - 获取当前用户权限
- `POST /api/permissions/grant` - 授予用户权限（管理员）
- `DELETE /api/permissions/revoke/:userId` - 撤销用户权限（管理员）

### 管理员接口
- `POST /api/admin/verify` - 验证管理员身份
- `GET /api/admin/users` - 获取所有用户列表（管理员）
- `DELETE /api/admin/users/:id` - 删除用户（管理员）

## 🎨 AI 命令格式

AI 使用特殊命令格式来操作待办事项：

```
🔧[CMD:COMMAND|参数1|参数2|...]
```

### 支持的命令

1. **添加任务**
```
🔧[CMD:ADD|任务名称|截止时间]
示例：🔧[CMD:ADD|完成报告|2025-10-26 18:00]
```

2. **标记完成**
```
🔧[CMD:COMPLETE|任务ID]
示例：🔧[CMD:COMPLETE|1]
```

3. **删除任务**
```
🔧[CMD:DELETE|任务ID]
示例：🔧[CMD:DELETE|2]
```

4. **更新任务**
```
🔧[CMD:UPDATE|任务ID|新名称]
示例：🔧[CMD:UPDATE|1|修改后的报告]
```

5. **设置截止时间**
```
🔧[CMD:SETDUEDATE|任务ID|截止时间]
示例：🔧[CMD:SETDUEDATE|1|2025-10-26 18:00]
特殊：🔧[CMD:SETDUEDATE|@latest|2025-10-26 18:00]
```

## 🚀 部署

### 部署到生产环境

1. **配置环境变量**
   - 设置强密码的 `JWT_SECRET`
   - 配置生产环境的 `GEMINI_API_KEY`

2. **构建数据库**
   - 首次运行会自动创建 SQLite 数据库

3. **使用 PM2 管理进程**
```bash
# 安装 PM2
npm install -g pm2

# 启动 Node.js 服务
pm2 start server.js --name "todo-backend"

# 启动 Python 服务
pm2 start backend/main.py --name "todo-ai" --interpreter python3

# 保存配置
pm2 save
pm2 startup
```

4. **配置反向代理（Nginx 示例）**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/gemini/ {
        proxy_pass http://localhost:5000/api/gemini/;
    }
}
```

## 🤝 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 本项目
2. 创建新分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 开发计划

- [ ] 添加任务优先级功能
- [ ] 支持任务分类/标签
- [ ] 任务搜索和过滤
- [ ] 数据导出功能
- [ ] 深色主题支持
- [ ] 微信小程序版本
- [ ] 多语言支持

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 👨‍💻 作者

Thelia

## 🙏 致谢

- [Google Gemini](https://ai.google.dev/) - 提供强大的 AI 能力
- [Express](https://expressjs.com/) - Node.js Web 框架
- [Flask](https://flask.palletsprojects.com/) - Python Web 框架
- [SQLite](https://www.sqlite.org/) - 轻量级数据库

## 📮 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 [Issue](https://github.com/yourusername/Project-Todo/issues)
- 发送邮件至：your.email@example.com

---

⭐ 如果这个项目对你有帮助，请给个 Star 支持一下！
