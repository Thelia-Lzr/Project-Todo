# Python 后端启动指南

## 📌 重要提示

AI 助手功能需要 Python 后端运行，如果看到"AI 后端连接失败"提示，请按以下步骤启动。

## 🚀 快速启动

### Windows (PowerShell)

```powershell
# 1. 进入后端目录
cd d:\WorkBench\Blog\Projects\TodoList\backend

# 2. 激活虚拟环境
.\venv\Scripts\Activate.ps1

# 3. 启动 Python 后端
python main.py
```

### Linux/Mac

```bash
# 1. 进入后端目录
cd /path/to/TodoList/backend

# 2. 激活虚拟环境
source venv/bin/activate

# 3. 启动 Python 后端
python main.py
```

## ✅ 验证运行状态

### 1. 检查端口占用
```powershell
# Windows
netstat -ano | findstr ":5000"

# Linux/Mac
lsof -i :5000
```

应该看到：
```
TCP    127.0.0.1:5000    0.0.0.0:0    LISTENING    [PID]
```

### 2. 测试健康检查
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health"
```

应该返回：
```json
{
  "status": "ok",
  "service": "Python Gemini Backend",
  "model": "gemini-2.5-flash"
}
```

## 🔧 故障排查

### 问题 1: 端口 5000 被占用
```powershell
# 查找占用进程
netstat -ano | findstr ":5000"

# 结束进程（替换 [PID] 为实际进程ID）
taskkill /F /PID [PID]
```

### 问题 2: 虚拟环境未创建
```powershell
# 创建虚拟环境
cd backend
python -m venv venv

# 安装依赖
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 问题 3: API Key 未配置
检查 `backend/.env` 文件是否包含：
```env
GEMINI_API_KEY=你的API密钥
```

### 问题 4: 移动端/远程访问连接失败

**原因**: Node.js 服务器代理路径配置错误（已修复）

**解决方案**:
1. 确保 Node.js 服务器已重启
2. Python 后端必须在 Node.js 服务器的同一台机器上运行
3. 检查浏览器控制台是否有错误信息

## 📊 完整启动流程

### 开发环境
```powershell
# 终端 1: 启动 Python 后端
cd backend
.\venv\Scripts\Activate.ps1
python main.py

# 终端 2: 启动 Node.js 服务器
cd ..
npm start
```

### 生产环境（推荐使用 PM2）
```bash
# 启动 Python 后端（后台运行）
cd backend
pm2 start main.py --name todolist-python --interpreter python

# 启动 Node.js 服务器
cd ..
pm2 start server.js --name todolist-backend

# 查看状态
pm2 status

# 查看日志
pm2 logs todolist-python
pm2 logs todolist-backend
```

## 🌐 网络访问说明

### 本地访问
- Node.js: http://localhost:3000
- Python: http://localhost:5000 (仅内部使用)

### 远程/移动端访问
- 使用开发隧道（ngrok、VS Code 隧道等）
- 访问地址：https://your-tunnel-url.com
- Python 后端通过 Node.js 代理，无需直接暴露

### 代理工作原理
```
前端请求: /api/gemini/init
    ↓
Node.js 代理: localhost:3000/api/gemini/init
    ↓
转发到: localhost:5000/api/gemini/init
    ↓
Python 后端处理
```

## 📝 常见问题

**Q: 为什么需要两个服务器？**
A: Node.js 处理待办事项和用户认证，Python 处理 AI 对话（Gemini API）。

**Q: 移动端无法连接 AI？**
A: 确保：
1. Node.js 服务器已重启（应用最新代码）
2. Python 后端正在运行
3. 检查浏览器控制台错误信息

**Q: 可以只使用待办功能吗？**
A: 可以！即使 Python 后端未运行，待办功能完全正常使用。

## 🆘 获取帮助

如果以上步骤无法解决问题：
1. 检查 Node.js 服务器日志（终端输出）
2. 检查 Python 后端日志（终端输出）
3. 查看浏览器控制台（F12）
4. 确认两个服务器都在同一台机器上运行
