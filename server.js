require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const httpProxy = require('express-http-proxy');
const { initDatabase } = require('./db');
const authRoutes = require('./routes/auth');
const todosRoutes = require('./routes/todos');
const chatRoutes = require('./routes/chat');
const permissionsRoutes = require('./routes/permissions');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const PYTHON_BACKEND = 'http://localhost:5000';  // Python后端地址

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务（前端文件）
app.use(express.static(path.join(__dirname, 'public')));

// Python后端代理 - 将/api/gemini请求转发到Python后端
app.use('/api/gemini', httpProxy(PYTHON_BACKEND, {
    proxyReqPathResolver: (req) => {
        // 完整路径：/api/gemini + req.url
        const fullPath = '/api/gemini' + req.url;
        console.log(`🔄 代理请求: ${req.url} → ${fullPath}`);
        return fullPath;
    },
    proxyErrorHandler: (err, res, next) => {
        console.error('❌ 代理错误:', err.message);
        res.status(503).json({
            success: false,
            error: 'Python后端连接失败，请确保 Python 后端在运行 (http://localhost:5000)'
        });
    }
}));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/todos', todosRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/admin', adminRoutes);


// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// 404 处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '路由不存在'
    });
});

// 错误处理
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误'
    });
});

// 启动服务器
async function startServer() {
    try {
        console.log('🔄 正在初始化数据库...');
        await initDatabase();
        console.log('✅ 数据库初始化完成');

        app.listen(PORT, () => {
            console.log(`
╔════════════════════════════════════════╗
║   ToList 服务器启动成功                ║
║   📍 地址: http://localhost:${PORT}       ║
║   🚀 准备就绪                          ║
╚════════════════════════════════════════╝
            `);
        });
    } catch (error) {
        console.error('❌ 启动失败:', error);
        process.exit(1);
    }
}

startServer();
