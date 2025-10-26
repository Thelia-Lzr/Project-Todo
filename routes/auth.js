const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../auth');
const { getDB } = require('../db');

const router = express.Router();

// 登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 验证输入
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }

        // 获取数据库连接
        const db = await getDB();

        // 查询用户
        db.get(
            'SELECT id, username, password FROM users WHERE username = ?',
            [username],
            async (err, user) => {
                db.close();

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: '数据库错误'
                    });
                }

                if (!user) {
                    return res.status(401).json({
                        success: false,
                        message: '用户名或密码错误'
                    });
                }

                // 验证密码
                try {
                    const passwordMatch = await bcrypt.compare(password, user.password);
                    if (!passwordMatch) {
                        return res.status(401).json({
                            success: false,
                            message: '用户名或密码错误'
                        });
                    }

                    // 更新最后登录时间（存储 UTC 时间）
                    const dbUpdate = await getDB();
                    const utcTime = new Date().toISOString();
                    dbUpdate.run(
                        'UPDATE users SET last_login = ? WHERE id = ?',
                        [utcTime, user.id],
                        (err) => {
                            dbUpdate.close();
                            if (err) {
                                console.error('更新登录时间失败:', err);
                            } else {
                                console.log(`✅ 更新用户 ${user.username} 登录时间 (UTC): ${utcTime}`);
                            }
                        }
                    );

                    // 生成令牌
                    const token = generateToken(user.id, user.username);
                    res.json({
                        success: true,
                        message: '登录成功',
                        token,
                        user: {
                            id: user.id,
                            username: user.username
                        }
                    });
                } catch (error) {
                    res.status(500).json({
                        success: false,
                        message: '密码验证失败'
                    });
                }
            }
        );
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 注册
router.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;

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
                message: '密码长度至少6个字符'
            });
        }

        // 加密密码
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const db = await getDB();

            // 创建用户
            db.run(
                'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
                [username, hashedPassword, email || null],
                async function(err) {
                    if (err) {
                        db.close();
                        if (err.message.includes('UNIQUE constraint')) {
                            return res.status(409).json({
                                success: false,
                                message: '用户名已存在'
                            });
                        }
                        return res.status(500).json({
                            success: false,
                            message: '创建用户失败'
                        });
                    }

                    const userId = this.lastID;

                    // 检查是否是第一个用户（管理员）
                    db.get('SELECT COUNT(*) as count FROM users', [], (err, result) => {
                        if (err) {
                            console.error('❌ 检查用户数量失败:', err);
                        }

                        const isFirstUser = result && result.count === 1;
                        
                        // 第一个用户（管理员）获得无限制权限，其他用户获得30天限时权限
                        const permissionType = isFirstUser ? 'UNLIMITED' : 'LIMITED';
                        const limitDays = isFirstUser ? null : 30;
                        const expiresAt = isFirstUser ? null : (() => {
                            const date = new Date();
                            date.setDate(date.getDate() + 30);
                            return date.toISOString();
                        })();

                        db.run(
                            'INSERT INTO ai_permissions (user_id, permission_type, limit_days, expires_at) VALUES (?, ?, ?, ?)',
                            [userId, permissionType, limitDays, expiresAt],
                            (err) => {
                                db.close();
                                if (err) {
                                    console.error('❌ 创建权限记录失败:', err);
                                } else if (isFirstUser) {
                                    console.log('✅ 第一个用户已注册为管理员，授予无限制AI权限');
                                }

                                // 生成令牌
                                const token = generateToken(userId, username);
                                res.status(201).json({
                                    success: true,
                                    message: isFirstUser ? '注册成功！您是第一个用户，已获得管理员权限和无限制AI使用权限' : '注册成功',
                                    token,
                                    user: {
                                        id: userId,
                                        username,
                                        email: email || null,
                                        isAdmin: isFirstUser
                                    }
                                });
                            }
                        );
                    });
                }
            );
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '密码加密失败'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 验证令牌
router.post('/verify', (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({
            success: false,
            message: '令牌不能为空'
        });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: '令牌已过期或无效'
            });
        }

        res.json({
            success: true,
            user: {
                id: decoded.userId,
                username: decoded.username
            }
        });
    });
});

module.exports = router;
