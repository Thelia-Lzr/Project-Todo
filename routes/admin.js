const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../middleware/auth');
const { getDB } = require('../db');

// 验证管理员中间件
const verifyAdmin = async (req, res, next) => {
    try {
        const db = await getDB();
        const userId = req.userId; // 由authMiddleware中间件设置
        
        console.log('verifyAdmin - userId:', userId);
        
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id, username FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        console.log('verifyAdmin - user:', user);

        // 第一个注册的用户（id = 1）自动成为管理员
        if (!user || user.id !== 1) {
            console.log('verifyAdmin - 不是管理员用户（需要 id = 1）');
            db.close();
            return res.status(403).json({ 
                success: false, 
                message: '需要管理员权限（仅第一个注册的用户为管理员）' 
            });
        }

        db.close();
        next();
    } catch (error) {
        console.error('验证管理员失败:', error);
        res.status(500).json({ success: false, message: '验证失败' });
    }
};

// 验证管理员权限
router.get('/verify', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const db = await getDB();
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT username FROM users WHERE id = ?', [req.userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        db.close();
        res.json({ 
            success: true, 
            isAdmin: true,
            username: user.username
        });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({ success: false, message: '获取用户信息失败' });
    }
});

// 获取所有用户及其权限
router.get('/users', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const db = await getDB();
        const users = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    u.id,
                    u.username,
                    u.email,
                    u.created_at,
                    u.last_login,
                    p.permission_type as perm_type,
                    p.limit_days,
                    p.expires_at,
                    p.created_at as perm_created_at
                FROM users u
                LEFT JOIN ai_permissions p ON u.id = p.user_id
                ORDER BY u.id ASC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 格式化权限信息
        const formattedUsers = users.map(user => {
            const permission = {};
            
            if (user.perm_type) {
                permission.type = user.perm_type;
                permission.limit_days = user.limit_days;
                
                if (user.perm_type === 'LIMITED' && user.expires_at) {
                    const now = new Date();
                    const expiresAt = new Date(user.expires_at);
                    const remaining = expiresAt - now;
                    
                    permission.expires_at = user.expires_at;
                    permission.days_remaining = Math.ceil(remaining / (1000 * 60 * 60 * 24));
                    permission.status = remaining > 0 ? 'active' : 'expired';
                }
            }

            return {
                id: user.id,
                username: user.username,
                email: user.email,
                created_at: user.created_at,
                last_login: user.last_login,
                permission
            };
        });

        db.close();
        res.json({ success: true, users: formattedUsers });
    } catch (error) {
        console.error('获取用户列表失败:', error);
        res.status(500).json({ success: false, message: '获取用户列表失败' });
    }
});

// 创建新用户
router.post('/users', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const db = await getDB();
        const { username, password, email, permissionType, limitDays } = req.body;

        // 验证输入
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: '用户名和密码不能为空' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                success: false, 
                message: '密码至少6个字符' 
            });
        }

        // 检查用户名是否已存在
        const existingUser = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: '用户名已存在' 
            });
        }

        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);

        // 创建用户
        const userId = await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
                [username, hashedPassword, email || null],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });

        // 创建权限
        const permType = permissionType || 'LIMITED';
        let expiresAt = null;
        
        if (permType === 'LIMITED') {
            const days = limitDays || 30;
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + days);
        }

        await new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO ai_permissions (user_id, permission_type, limit_days, expires_at) VALUES (?, ?, ?, ?)',
                [userId, permType, permType === 'LIMITED' ? (limitDays || 30) : null, expiresAt],
                function(err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        db.close();
        res.json({ success: true, userId, message: '用户创建成功' });
    } catch (error) {
        console.error('创建用户失败:', error);
        res.status(500).json({ success: false, message: '创建用户失败' });
    }
});

// 删除用户
router.delete('/users/:id', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const db = await getDB();
        const userId = parseInt(req.params.id);

        // 检查用户是否存在
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }

        // 不能删除管理员（第一个用户）
        if (userId === 1) {
            return res.status(403).json({ 
                success: false, 
                message: '不能删除管理员账号' 
            });
        }

        // 删除用户（外键约束会自动删除相关的todos、permissions、chat_sessions、chat_history）
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        db.close();
        res.json({ success: true, message: '用户删除成功' });
    } catch (error) {
        console.error('删除用户失败:', error);
        res.status(500).json({ success: false, message: '删除用户失败' });
    }
});

// 更新用户权限
router.put('/users/:id/permission', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const db = await getDB();
        const userId = parseInt(req.params.id);
        const { permissionType, limitDays } = req.body;

        // 检查用户是否存在
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }

        const permType = permissionType || 'LIMITED';
        let expiresAt = null;
        
        if (permType === 'LIMITED') {
            const days = limitDays || 30;
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + days);
        }

        // 检查是否已有权限记录
        const existingPerm = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM ai_permissions WHERE user_id = ?', [userId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (existingPerm) {
            // 更新现有权限
            await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE ai_permissions SET permission_type = ?, limit_days = ?, expires_at = ? WHERE user_id = ?',
                    [permType, permType === 'LIMITED' ? (limitDays || 30) : null, expiresAt, userId],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        } else {
            // 创建新权限
            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO ai_permissions (user_id, permission_type, limit_days, expires_at) VALUES (?, ?, ?, ?)',
                    [userId, permType, permType === 'LIMITED' ? (limitDays || 30) : null, expiresAt],
                    function(err) {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }

        db.close();
        res.json({ success: true, message: '权限更新成功' });
    } catch (error) {
        console.error('更新权限失败:', error);
        res.status(500).json({ success: false, message: '更新权限失败' });
    }
});

// 获取所有聊天会话
router.get('/chat-sessions', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const db = await getDB();
        const sessions = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    cs.id,
                    cs.session_id,
                    cs.user_id,
                    u.username,
                    cs.created_at,
                    cs.last_activity,
                    (SELECT COUNT(*) FROM chat_history ch WHERE ch.session_id = cs.session_id) as message_count
                FROM chat_sessions cs
                JOIN users u ON cs.user_id = u.id
                ORDER BY cs.last_activity DESC
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        db.close();
        res.json({ success: true, sessions });
    } catch (error) {
        console.error('获取聊天会话失败:', error);
        res.status(500).json({ success: false, message: '获取聊天会话失败' });
    }
});

// 清空指定用户的聊天记录
router.delete('/chat-history/:username', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const db = await getDB();
        const username = req.params.username;

        // 获取用户ID
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: '用户不存在' 
            });
        }

        // 删除聊天历史
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM chat_history WHERE user_id = ?', [user.id], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        // 删除聊天会话
        await new Promise((resolve, reject) => {
            db.run('DELETE FROM chat_sessions WHERE user_id = ?', [user.id], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });

        db.close();
        res.json({ success: true, message: '聊天记录已清空' });
    } catch (error) {
        console.error('清空聊天记录失败:', error);
        res.status(500).json({ success: false, message: '清空聊天记录失败' });
    }
});

// 获取当前API Key（隐藏部分字符）
router.get('/api-key', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const envPath = path.join(__dirname, '../backend/.env');
        
        if (!fs.existsSync(envPath)) {
            return res.status(404).json({ 
                success: false, 
                message: 'API Key 配置文件不存在' 
            });
        }

        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/GEMINI_API_KEY=(.+)/);
        
        if (!match) {
            return res.status(404).json({ 
                success: false, 
                message: 'API Key 未配置' 
            });
        }

        const apiKey = match[1].trim();
        // 只显示前8位和后4位
        const maskedKey = apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4);
        
        res.json({ 
            success: true, 
            apiKey: maskedKey,
            fullKey: apiKey // 用于前端显示/隐藏
        });
    } catch (error) {
        console.error('获取API Key失败:', error);
        res.status(500).json({ success: false, message: '获取API Key失败' });
    }
});

// 更新API Key
router.post('/api-key', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const { apiKey } = req.body;
        
        if (!apiKey || apiKey.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'API Key 不能为空' 
            });
        }

        const fs = require('fs');
        const path = require('path');
        const envPath = path.join(__dirname, '../backend/.env');
        
        // 读取现有配置
        let envContent = '';
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf-8');
        }

        // 更新或添加 GEMINI_API_KEY
        if (envContent.includes('GEMINI_API_KEY=')) {
            envContent = envContent.replace(/GEMINI_API_KEY=.+/, `GEMINI_API_KEY=${apiKey}`);
        } else {
            envContent += `\nGEMINI_API_KEY=${apiKey}\n`;
        }

        // 写入文件
        fs.writeFileSync(envPath, envContent, 'utf-8');
        
        // 更新当前进程的环境变量
        process.env.GEMINI_API_KEY = apiKey;
        
        res.json({ 
            success: true, 
            message: 'API Key 已更新，请重启后端服务以生效' 
        });
    } catch (error) {
        console.error('更新API Key失败:', error);
        res.status(500).json({ success: false, message: '更新API Key失败' });
    }
});

// 检查API配额
router.get('/api-quota', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const axios = require('axios');
        const fs = require('fs');
        const path = require('path');
        const envPath = path.join(__dirname, '../backend/.env');
        
        if (!fs.existsSync(envPath)) {
            return res.status(404).json({ 
                success: false, 
                message: 'API Key 配置文件不存在' 
            });
        }

        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/GEMINI_API_KEY=(.+)/);
        
        if (!match) {
            return res.status(404).json({ 
                success: false, 
                message: 'API Key 未配置' 
            });
        }

        const apiKey = match[1].trim();
        
        // 获取本地使用统计
        const db = await getDB();
        
        // 今天的使用统计
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        
        const todayStats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(*) as request_count,
                    SUM(total_tokens) as total_tokens
                FROM api_usage 
                WHERE created_at >= datetime('now', 'start of day')
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // 当前分钟的使用统计
        const currentMinuteStart = new Date();
        currentMinuteStart.setSeconds(0, 0);
        
        const minuteStats = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    COUNT(*) as request_count,
                    SUM(total_tokens) as total_tokens
                FROM api_usage 
                WHERE created_at >= datetime('now', '-1 minute')
            `, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        db.close();
        
        // 调用 Gemini API 获取模型信息来验证 API Key 有效性
        try {
            const response = await axios.get(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp?key=${apiKey}`
            );
            
            if (response.data) {
                // Gemini API 的限制（免费版）
                const quotaInfo = {
                    success: true,
                    status: 'active',
                    message: 'API Key 有效且可用',
                    modelName: response.data.name,
                    displayName: response.data.displayName,
                    usage: {
                        today: {
                            requests: todayStats.request_count || 0,
                            tokens: todayStats.total_tokens || 0,
                            requestLimit: 1500,
                            tokenLimit: null // 每天没有token限制
                        },
                        currentMinute: {
                            requests: minuteStats.request_count || 0,
                            tokens: minuteStats.total_tokens || 0,
                            requestLimit: 15,
                            tokenLimit: 1000000
                        }
                    },
                    info: {
                        status: '正常',
                        type: 'Gemini API Free Tier',
                        limits: {
                            rpm: '15 次/分钟 (免费版)',
                            tpm: '1,000,000 tokens/分钟',
                            rpd: '1,500 次/天',
                            note: 'Gemini 2.0 Flash 免费版限制'
                        },
                        features: [
                            '✅ 文本生成',
                            '✅ 对话能力',
                            '✅ 代码生成',
                            '✅ 长上下文支持 (最多 1M tokens)'
                        ]
                    }
                };
                
                res.json(quotaInfo);
            } else {
                res.json({
                    success: false,
                    message: 'API Key 有效但无法获取详细信息'
                });
            }
        } catch (apiError) {
            if (apiError.response && apiError.response.status === 429) {
                res.json({
                    success: true,
                    status: 'rate_limited',
                    message: 'API 已达速率限制',
                    usage: {
                        today: {
                            requests: todayStats.request_count || 0,
                            tokens: todayStats.total_tokens || 0,
                            requestLimit: 1500
                        },
                        currentMinute: {
                            requests: minuteStats.request_count || 0,
                            tokens: minuteStats.total_tokens || 0,
                            requestLimit: 15,
                            tokenLimit: 1000000
                        }
                    },
                    info: {
                        status: '⚠️ 配额限制',
                        type: 'Gemini API Free Tier',
                        limits: {
                            rpm: '15 次/分钟 (已达限制)',
                            tpm: '1,000,000 tokens/分钟',
                            rpd: '1,500 次/天',
                            note: '请稍后再试，速率限制会在1分钟后重置'
                        }
                    }
                });
            } else if (apiError.response && apiError.response.status === 403) {
                res.json({
                    success: false,
                    status: 'invalid',
                    message: 'API Key 无效或已被禁用',
                    info: {
                        status: '❌ 无效',
                        type: 'Gemini API',
                        note: '请检查 API Key 是否正确或是否已过期'
                    }
                });
            } else if (apiError.response && apiError.response.status === 400) {
                res.json({
                    success: false,
                    status: 'error',
                    message: 'API 请求错误',
                    info: {
                        status: '❌ 错误',
                        type: 'Gemini API',
                        note: apiError.response.data?.error?.message || '请求参数错误'
                    }
                });
            } else {
                throw apiError;
            }
        }
    } catch (error) {
        console.error('检查API配额失败:', error);
        res.status(500).json({ 
            success: false, 
            message: '检查API配额失败: ' + error.message 
        });
    }
});

module.exports = router;
