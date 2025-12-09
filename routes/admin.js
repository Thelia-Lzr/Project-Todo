const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');
const { getDB } = require('../db');

const ADMIN_SETTING_KEYS = {
    openrouterApiKey: 'openrouter_api_key',
    openrouterDefaultModel: 'openrouter_default_model',
    openrouterModelOptions: 'openrouter_model_options'
};

// Constants for display limits
const MAX_MODELS_TO_DISPLAY = 20;

const envPath = path.join(__dirname, '../backend/.env');

const parseModelOptions = (raw = '') => {
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map(item => String(item).trim()).filter(Boolean);
        }
    } catch (error) {
        // ignore JSON parse errors and fallback to splitting
    }

    return raw
        .split(/\r?\n|,/)
        .map(item => item.trim())
        .filter(item => item.length > 0);
};

const readAdminSettings = (db, keys = []) => {
    if (!keys.length) return Promise.resolve({});
    
    // Only allow keys that are present in ADMIN_SETTING_KEYS values
    const allowedKeys = Object.values(ADMIN_SETTING_KEYS);
    const filteredKeys = keys.filter(key => allowedKeys.includes(key));
    if (!filteredKeys.length) return Promise.resolve({});
    
    const placeholders = filteredKeys.map(() => '?').join(', ');

    return new Promise((resolve, reject) => {
        db.all(
            `SELECT key, value FROM admin_settings WHERE key IN (${placeholders})`,
            filteredKeys,
            (err, rows = []) => {
                if (err) {
                    reject(err);
                } else {
                    const result = {};
                    rows.forEach(row => {
                        result[row.key] = row.value;
                    });
                    resolve(result);
                }
            }
        );
    });
};

const upsertAdminSetting = (db, key, value) => {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO admin_settings (key, value) VALUES (?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
            [key, value],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
};

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

// 获取 OpenRouter 配置
router.get('/openrouter-config', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const db = await getDB();
        let settings = {};

        try {
            settings = await readAdminSettings(db, [
                ADMIN_SETTING_KEYS.openrouterApiKey,
                ADMIN_SETTING_KEYS.openrouterDefaultModel,
                ADMIN_SETTING_KEYS.openrouterModelOptions
            ]);
        } finally {
            db.close();
        }

        const apiKey = (settings[ADMIN_SETTING_KEYS.openrouterApiKey] || process.env.OPENROUTER_API_KEY || '').trim();
        const defaultModel = (settings[ADMIN_SETTING_KEYS.openrouterDefaultModel] || process.env.OPENROUTER_DEFAULT_MODEL || '').trim();
        const modelOptions = parseModelOptions(
            settings[ADMIN_SETTING_KEYS.openrouterModelOptions] || process.env.OPENROUTER_MODEL_OPTIONS || ''
        );

        // Mask API key for security - return only first 8 and last 4 characters
        const maskedApiKey = apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : '';

        res.json({
            success: true,
            config: {
                apiKey: maskedApiKey,
                apiKeyConfigured: !!apiKey,
                defaultModel,
                modelOptions
            }
        });
    } catch (error) {
        console.error('获取 OpenRouter 配置失败:', error);
        res.status(500).json({ success: false, message: '获取 OpenRouter 配置失败' });
    }
});

// 保存 OpenRouter 配置
router.post('/openrouter-config', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const { apiKey, defaultModel, modelOptions } = req.body || {};
        const trimmedKey = (apiKey || '').trim();

        if (!trimmedKey) {
            return res.status(400).json({ success: false, message: 'OpenRouter API Key 不能为空' });
        }

        let normalizedOptions = [];
        if (Array.isArray(modelOptions)) {
            normalizedOptions = modelOptions.map(item => String(item).trim()).filter(Boolean);
        } else if (typeof modelOptions === 'string') {
            normalizedOptions = parseModelOptions(modelOptions);
        }

        let normalizedModel = (defaultModel || '').trim();
        if (!normalizedModel && normalizedOptions.length > 0) {
            normalizedModel = normalizedOptions[0];
        }

        if (!normalizedModel) {
            return res.status(400).json({ success: false, message: '请至少提供一个默认模型' });
        }

        if (!normalizedOptions.includes(normalizedModel)) {
            normalizedOptions.push(normalizedModel);
        }

        const db = await getDB();
        try {
            await upsertAdminSetting(db, ADMIN_SETTING_KEYS.openrouterApiKey, trimmedKey);
            await upsertAdminSetting(db, ADMIN_SETTING_KEYS.openrouterDefaultModel, normalizedModel);
            await upsertAdminSetting(db, ADMIN_SETTING_KEYS.openrouterModelOptions, JSON.stringify(normalizedOptions));
        } finally {
            db.close();
        }

        process.env.OPENROUTER_API_KEY = trimmedKey;
        process.env.OPENROUTER_DEFAULT_MODEL = normalizedModel;
        process.env.OPENROUTER_MODEL_OPTIONS = JSON.stringify(normalizedOptions);

        res.json({ success: true, message: 'OpenRouter 设置已保存' });
    } catch (error) {
        console.error('保存 OpenRouter 配置失败:', error);
        res.status(500).json({ success: false, message: '保存 OpenRouter 配置失败' });
    }
});

// 检查API配额（支持 Gemini / DeepSeek / OpenRouter）
router.get('/api-quota', authMiddleware, verifyAdmin, async (req, res) => {
    try {
        const axios = require('axios');
        const service = (req.query.service || 'gemini').toLowerCase();
        const supportedServices = ['gemini', 'deepseek', 'openrouter'];

        if (!supportedServices.includes(service)) {
            return res.status(400).json({
                success: false,
                message: `不支持的 AI 服务: ${service}`,
                service
            });
        }

        const envExists = fs.existsSync(envPath);
        const envContent = envExists ? fs.readFileSync(envPath, 'utf-8') : '';
        const getKeyFromEnv = (key) => {
            const regex = new RegExp(`${key}=([^\r\n]+)`);
            const match = envContent.match(regex);
            if (match && match[1]) {
                return match[1].trim();
            }
            if (process.env[key]) {
                return process.env[key].trim();
            }
            return null;
        };

        // 使用记录只统计对应服务
        const db = await getDB();
        let serviceFilterClause = "AND (model_name IS NULL OR model_name = '' OR model_name LIKE 'gemini%')";
        if (service === 'deepseek') {
            serviceFilterClause = "AND model_name LIKE 'deepseek%'";
        } else if (service === 'openrouter') {
            // OpenRouter model names can be like "openrouter/auto", "meta-llama/...", etc.
            // Filter by common OpenRouter patterns or prefix
            serviceFilterClause = "AND (model_name LIKE 'openrouter%' OR model_name LIKE 'meta-%' OR model_name LIKE '%/%')";
        }

        let todayStats = {};
        let minuteStats = {};
        let storedDeepseekKey = null;
        let openrouterSettings = {};

        try {
            todayStats = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as request_count,
                        SUM(total_tokens) as total_tokens
                    FROM api_usage 
                    WHERE created_at >= datetime('now', 'start of day')
                    ${serviceFilterClause}
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
            });

            minuteStats = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        COUNT(*) as request_count,
                        SUM(total_tokens) as total_tokens
                    FROM api_usage 
                    WHERE created_at >= datetime('now', '-1 minute')
                    ${serviceFilterClause}
                `, (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
            });

            if (service === 'deepseek') {
                const settingRow = await new Promise((resolve, reject) => {
                    db.get(
                        'SELECT value FROM admin_settings WHERE key = ? LIMIT 1',
                        ['deepseek_api_key'],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                }).catch(() => null);

                if (settingRow && settingRow.value) {
                    storedDeepseekKey = settingRow.value.trim();
                }
            } else if (service === 'openrouter') {
                openrouterSettings = await readAdminSettings(db, [
                    ADMIN_SETTING_KEYS.openrouterApiKey,
                    ADMIN_SETTING_KEYS.openrouterDefaultModel,
                    ADMIN_SETTING_KEYS.openrouterModelOptions
                ]);
            }
        } catch (error) {
            // Log error but ensure db is closed
            console.error('Error fetching usage stats:', error);
        } finally {
            if (db) {
                db.close();
            }
        }

        const usagePayload = {
            today: {
                requests: todayStats?.request_count || 0,
                tokens: todayStats?.total_tokens || 0,
                requestLimit: service === 'gemini' ? 1500 : null,
                tokenLimit: null
            },
            currentMinute: {
                requests: minuteStats?.request_count || 0,
                tokens: minuteStats?.total_tokens || 0,
                requestLimit: service === 'gemini' ? 15 : null,
                tokenLimit: service === 'gemini' ? 1000000 : null
            }
        };

        if (service === 'deepseek') {
            const apiKey = getKeyFromEnv('DEEPSEEK_API_KEY') || storedDeepseekKey;
            if (!apiKey) {
                return res.status(404).json({
                    success: false,
                    message: 'DeepSeek API Key 未配置',
                    service: 'deepseek',
                    info: {
                        status: '⚠️ 未配置',
                        type: 'DeepSeek API',
                        note: '请在服务器 backend/.env 或管理员设置中配置 DEEPSEEK_API_KEY'
                    }
                });
            }

            try {
                const response = await axios.get('https://api.deepseek.com/v1/models', {
                    headers: {
                        Authorization: `Bearer ${apiKey}`
                    },
                    timeout: 10000
                });

                const models = response.data?.data || [];
                const primaryModel = models.find((model) => model.id === 'deepseek-chat') || models[0];
                const displayName = primaryModel?.id || 'deepseek-chat';

                return res.json({
                    success: true,
                    status: 'active',
                    service: 'deepseek',
                    serviceLabel: 'DeepSeek',
                    message: 'DeepSeek API Key 有效且可用',
                    modelName: primaryModel?.id || 'deepseek-chat',
                    displayName,
                    usage: usagePayload,
                    info: {
                        status: '正常',
                        type: 'DeepSeek API (按量计费)',
                        limits: {
                            rpm: '按账号配额 (默认 ~60 次/分钟)',
                            tpm: '按余额弹性计费',
                            rpd: '无限制',
                            note: '具体额度以 DeepSeek 控制台为准'
                        },
                        features: [
                            '✅ 文本与代码生成',
                            '✅ 长上下文对话',
                            '✅ 支持多轮问答'
                        ]
                    }
                });
            } catch (apiError) {
                if (apiError.response && apiError.response.status === 401) {
                    return res.json({
                        success: false,
                        status: 'invalid',
                        service: 'deepseek',
                        message: 'DeepSeek API Key 无效或已被禁用',
                        info: {
                            status: '❌ 无效',
                            type: 'DeepSeek API',
                            note: '请检查 API Key 是否正确或是否已过期'
                        }
                    });
                }

                if (apiError.response && apiError.response.status === 429) {
                    return res.json({
                        success: true,
                        status: 'rate_limited',
                        service: 'deepseek',
                        message: 'DeepSeek API 已达速率限制',
                        usage: usagePayload,
                        info: {
                            status: '⚠️ 配额限制',
                            type: 'DeepSeek API',
                            note: 'DeepSeek 控制台显示的速率限制已触发，请稍后再试'
                        }
                    });
                }

                if (apiError.response && apiError.response.status === 403) {
                    return res.json({
                        success: false,
                        status: 'forbidden',
                        service: 'deepseek',
                        message: 'DeepSeek API Key 权限不足',
                        info: {
                            status: '❌ 禁用',
                            type: 'DeepSeek API',
                            note: apiError.response.data?.error || '请确认账号状态'
                        }
                    });
                }

                throw apiError;
            }
        }

        if (service === 'openrouter') {
            const storedKey = (openrouterSettings[ADMIN_SETTING_KEYS.openrouterApiKey] || '').trim();
            const apiKey = getKeyFromEnv('OPENROUTER_API_KEY') || storedKey;

            if (!apiKey) {
                return res.status(404).json({
                    success: false,
                    message: 'OpenRouter API Key 未配置',
                    service: 'openrouter',
                    info: {
                        status: '⚠️ 未配置',
                        type: 'OpenRouter API',
                        note: '请在管理员面板或环境变量中配置 OPENROUTER_API_KEY'
                    }
                });
            }

            const configuredOptions = parseModelOptions(
                openrouterSettings[ADMIN_SETTING_KEYS.openrouterModelOptions] || process.env.OPENROUTER_MODEL_OPTIONS || ''
            );
            const defaultModel = (
                openrouterSettings[ADMIN_SETTING_KEYS.openrouterDefaultModel] ||
                process.env.OPENROUTER_DEFAULT_MODEL ||
                configuredOptions[0] ||
                ''
            ).trim();

            try {
                const response = await axios.get('https://openrouter.ai/api/v1/models', {
                    headers: {
                        Authorization: `Bearer ${apiKey}`
                    },
                    timeout: 10000
                });

                const models = Array.isArray(response.data?.data) ? response.data.data : [];
                const preferredModel = defaultModel || models[0]?.id || 'openrouter/auto';
                const matchedModel = models.find(model => model.id === preferredModel);
                const displayName = matchedModel?.name || preferredModel;

                return res.json({
                    success: true,
                    status: 'active',
                    service: 'openrouter',
                    serviceLabel: 'OpenRouter',
                    message: 'OpenRouter API Key 有效且可用',
                    modelName: preferredModel,
                    displayName,
                    usage: usagePayload,
                    models: models.slice(0, MAX_MODELS_TO_DISPLAY).map(model => ({
                        id: model.id,
                        name: model.name,
                        context_length: model.context_length,
                        pricing: model.pricing
                    })),
                    info: {
                        status: '正常',
                        type: 'OpenRouter API',
                        limits: {
                            rpm: '依据账户限制',
                            tpm: '依据模型供应商限制',
                            rpd: '未限制',
                            note: '详细额度以 OpenRouter 控制台为准'
                        },
                        features: [
                            '✅ 多模型聚合',
                            '✅ 自定义模型列表',
                            '✅ 灵活的计费策略'
                        ]
                    }
                });
            } catch (apiError) {
                if (apiError.response && apiError.response.status === 401) {
                    return res.json({
                        success: false,
                        status: 'invalid',
                        service: 'openrouter',
                        message: 'OpenRouter API Key 无效或已被禁用',
                        info: {
                            status: '❌ 无效',
                            type: 'OpenRouter API',
                            note: '请检查 API Key 是否有效'
                        }
                    });
                }

                if (apiError.response && apiError.response.status === 429) {
                    return res.json({
                        success: true,
                        status: 'rate_limited',
                        service: 'openrouter',
                        message: 'OpenRouter API 已触发速率限制',
                        usage: usagePayload,
                        info: {
                            status: '⚠️ 配额限制',
                            type: 'OpenRouter API',
                            note: '已达到当前账户的速率限制，请稍后重试'
                        }
                    });
                }

                if (apiError.response && apiError.response.status === 403) {
                    return res.json({
                        success: false,
                        status: 'forbidden',
                        service: 'openrouter',
                        message: 'OpenRouter API Key 权限不足',
                        info: {
                            status: '❌ 禁用',
                            type: 'OpenRouter API',
                            note: apiError.response.data?.error || '请确认账户是否启用'
                        }
                    });
                }

                throw apiError;
            }
        }

        const apiKey = getKeyFromEnv('GEMINI_API_KEY');
        if (!apiKey) {
            return res.status(404).json({
                success: false,
                message: 'Gemini API Key 未配置',
                service: 'gemini',
                info: {
                    status: '⚠️ 未配置',
                    type: 'Gemini API',
                    note: '请在 backend/.env 中配置 GEMINI_API_KEY'
                }
            });
        }

        try {
            const response = await axios.get(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=${apiKey}`
            );

            if (response.data) {
                return res.json({
                    success: true,
                    status: 'active',
                    service: 'gemini',
                    serviceLabel: 'Gemini',
                    message: 'API Key 有效且可用',
                    modelName: response.data.name,
                    displayName: response.data.displayName,
                    usage: usagePayload,
                    info: {
                        status: '正常',
                        type: 'Gemini API Free Tier',
                        limits: {
                            rpm: '15 次/分钟 (免费版)',
                            tpm: '1,000,000 tokens/分钟',
                            rpd: '1,500 次/天',
                            note: 'Gemini 2.5 Flash 免费版限制'
                        },
                        features: [
                            '✅ 文本生成',
                            '✅ 对话能力',
                            '✅ 代码生成',
                            '✅ 长上下文支持 (最多 1M tokens)'
                        ]
                    }
                });
            }

            return res.json({
                success: false,
                service: 'gemini',
                message: 'API Key 有效但无法获取详细信息'
            });
        } catch (apiError) {
            if (apiError.response && apiError.response.status === 429) {
                return res.json({
                    success: true,
                    status: 'rate_limited',
                    service: 'gemini',
                    message: 'API 已达速率限制',
                    usage: usagePayload,
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
            }

            if (apiError.response && apiError.response.status === 403) {
                return res.json({
                    success: false,
                    status: 'invalid',
                    service: 'gemini',
                    message: 'API Key 无效或已被禁用',
                    info: {
                        status: '❌ 无效',
                        type: 'Gemini API',
                        note: '请检查 API Key 是否正确或是否已过期'
                    }
                });
            }

            if (apiError.response && apiError.response.status === 400) {
                return res.json({
                    success: false,
                    status: 'error',
                    service: 'gemini',
                    message: 'API 请求错误',
                    info: {
                        status: '❌ 错误',
                        type: 'Gemini API',
                        note: apiError.response.data?.error?.message || '请求参数错误'
                    }
                });
            }

            throw apiError;
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
