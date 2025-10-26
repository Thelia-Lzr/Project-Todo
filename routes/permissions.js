const express = require('express');
const { verifyToken } = require('../auth');
const { getDB } = require('../db');

const router = express.Router();

// 获取用户的AI权限信息
router.get('/info', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const db = await getDB();

        db.get(
            'SELECT permission_type, limit_days, expires_at FROM ai_permissions WHERE user_id = ?',
            [userId],
            (err, permission) => {
                db.close();

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: '数据库错误'
                    });
                }

                if (!permission) {
                    return res.status(404).json({
                        success: false,
                        message: '用户权限未初始化'
                    });
                }

                // 检查权限是否过期
                let isExpired = false;
                let daysRemaining = null;
                let status = 'active';

                if (permission.permission_type === 'UNLIMITED') {
                    // 无限权限
                    daysRemaining = 99999; // 表示无限
                    isExpired = false;
                    status = 'unlimited';
                } else if (permission.permission_type === 'LIMITED') {
                    // 限期权限
                    if (permission.expires_at) {
                        const expiresDate = new Date(permission.expires_at);
                        const now = new Date();
                        const timeDiff = expiresDate - now;
                        
                        if (timeDiff <= 0) {
                            isExpired = true;
                            daysRemaining = 0;
                            status = 'expired';
                        } else {
                            isExpired = false;
                            // 更准确的计算剩余天数
                            daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                            status = 'active';
                        }
                    }
                }

                res.json({
                    success: true,
                    permission: {
                        type: permission.permission_type,
                        status,
                        isExpired,
                        daysRemaining,
                        limitDays: permission.limit_days,
                        expiresAt: permission.expires_at
                    }
                });
            }
        );
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 检查是否可以使用AI
router.get('/check', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const db = await getDB();

        db.get(
            'SELECT permission_type, limit_days, expires_at FROM ai_permissions WHERE user_id = ?',
            [userId],
            (err, permission) => {
                db.close();

                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: '数据库错误'
                    });
                }

                if (!permission) {
                    return res.status(404).json({
                        success: false,
                        message: '用户权限未初始化'
                    });
                }

                // 检查权限
                let canUse = false;
                let daysRemaining = null;
                let status = 'active';

                if (permission.permission_type === 'UNLIMITED') {
                    canUse = true;
                    daysRemaining = 99999;
                    status = 'unlimited';
                } else if (permission.permission_type === 'LIMITED') {
                    if (permission.expires_at) {
                        const expiresDate = new Date(permission.expires_at);
                        const now = new Date();
                        const timeDiff = expiresDate - now;
                        
                        if (timeDiff <= 0) {
                            canUse = false;
                            daysRemaining = 0;
                            status = 'expired';
                        } else {
                            canUse = true;
                            daysRemaining = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
                            status = 'active';
                        }
                    }
                }

                res.json({
                    success: true,
                    canUse,
                    status,
                    daysRemaining,
                    expiresAt: permission.expires_at
                });
            }
        );
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 管理员: 为用户设置AI权限
router.post('/set', async (req, res) => {
    try {
        const { username, permissionType, limitDays } = req.body;

        // 验证输入
        if (!username || !permissionType) {
            return res.status(400).json({
                success: false,
                message: '缺少必需参数: username, permissionType'
            });
        }

        if (!['UNLIMITED', 'LIMITED'].includes(permissionType)) {
            return res.status(400).json({
                success: false,
                message: 'permissionType 必须是 UNLIMITED 或 LIMITED'
            });
        }

        if (permissionType === 'LIMITED' && !limitDays) {
            return res.status(400).json({
                success: false,
                message: '权限类型为 LIMITED 时必须指定 limitDays'
            });
        }

        const db = await getDB();

        // 获取用户ID
        db.get(
            'SELECT id FROM users WHERE username = ?',
            [username],
            (err, user) => {
                if (err) {
                    db.close();
                    return res.status(500).json({
                        success: false,
                        message: '数据库错误'
                    });
                }

                if (!user) {
                    db.close();
                    return res.status(404).json({
                        success: false,
                        message: '用户不存在'
                    });
                }

                // 计算过期时间
                let expiresAt = null;
                if (permissionType === 'LIMITED') {
                    const expireDate = new Date();
                    expireDate.setDate(expireDate.getDate() + limitDays);
                    expiresAt = expireDate.toISOString();
                }

                // 更新或插入权限
                db.run(
                    `INSERT INTO ai_permissions (user_id, permission_type, limit_days, expires_at)
                     VALUES (?, ?, ?, ?)
                     ON CONFLICT(user_id) DO UPDATE SET
                     permission_type = excluded.permission_type,
                     limit_days = excluded.limit_days,
                     expires_at = excluded.expires_at`,
                    [user.id, permissionType, limitDays || null, expiresAt],
                    (err) => {
                        db.close();
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: '设置权限失败'
                            });
                        }

                        res.json({
                            success: true,
                            message: `已为 ${username} 设置权限: ${permissionType}`,
                            expiresAt
                        });
                    }
                );
            }
        );
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

module.exports = router;
