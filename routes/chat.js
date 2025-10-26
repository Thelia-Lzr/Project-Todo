const express = require('express');
const { verifyToken } = require('../auth');
const { getDB } = require('../db');

const router = express.Router();

// 创建或获取聊天会话
router.post('/session', verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.body;
        const userId = req.userId;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: '会话ID不能为空'
            });
        }

        const db = await getDB();

        // 检查会话是否已存在
        db.get(
            'SELECT id FROM chat_sessions WHERE session_id = ? AND user_id = ?',
            [sessionId, userId],
            (err, session) => {
                if (err) {
                    db.close();
                    return res.status(500).json({
                        success: false,
                        message: '数据库错误'
                    });
                }

                if (session) {
                    // 更新最后活动时间（使用 UTC）
                    const utcNow = new Date().toISOString();
                    db.run(
                        'UPDATE chat_sessions SET last_activity = ? WHERE session_id = ?',
                        [utcNow, sessionId],
                        (err) => {
                            db.close();
                            if (err) {
                                return res.status(500).json({
                                    success: false,
                                    message: '更新会话失败'
                                });
                            }
                            res.json({
                                success: true,
                                message: '会话已存在',
                                sessionId
                            });
                        }
                    );
                } else {
                    // 创建新会话（使用 UTC 时间）
                    const utcNow = new Date().toISOString();
                    db.run(
                        'INSERT INTO chat_sessions (user_id, session_id, created_at, last_activity) VALUES (?, ?, ?, ?)',
                        [userId, sessionId, utcNow, utcNow],
                        (err) => {
                            db.close();
                            if (err) {
                                return res.status(500).json({
                                    success: false,
                                    message: '创建会话失败'
                                });
                            }
                            res.status(201).json({
                                success: true,
                                message: '会话已创建',
                                sessionId
                            });
                        }
                    );
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

// 保存聊天消息
router.post('/message', verifyToken, async (req, res) => {
    try {
        const { sessionId, role, message } = req.body;
        const userId = req.userId;

        if (!sessionId || !role || !message) {
            return res.status(400).json({
                success: false,
                message: '缺少必需参数: sessionId, role, message'
            });
        }

        // 验证role
        if (!['user', 'assistant'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'role 必须是 user 或 assistant'
            });
        }

        const db = await getDB();

        // 检查会话是否属于当前用户
        db.get(
            'SELECT id FROM chat_sessions WHERE session_id = ? AND user_id = ?',
            [sessionId, userId],
            (err, session) => {
                if (err) {
                    db.close();
                    return res.status(500).json({
                        success: false,
                        message: '数据库错误'
                    });
                }

                if (!session) {
                    db.close();
                    return res.status(404).json({
                        success: false,
                        message: '会话不存在或无权限访问'
                    });
                }

                // 保存消息（使用 UTC 时间）
                const utcNow = new Date().toISOString();
                db.run(
                    'INSERT INTO chat_history (user_id, session_id, role, message, created_at) VALUES (?, ?, ?, ?, ?)',
                    [userId, sessionId, role, message, utcNow],
                    function(err) {
                        db.close();
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: '保存消息失败'
                            });
                        }

                        res.status(201).json({
                            success: true,
                            message: '消息已保存',
                            id: this.lastID,
                            created_at: utcNow
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

// 获取聊天历史
router.get('/history/:sessionId', verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.userId;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: '会话ID不能为空'
            });
        }

        const db = await getDB();

        // 检查会话是否属于当前用户
        db.get(
            'SELECT id FROM chat_sessions WHERE session_id = ? AND user_id = ?',
            [sessionId, userId],
            (err, session) => {
                if (err) {
                    db.close();
                    return res.status(500).json({
                        success: false,
                        message: '数据库错误'
                    });
                }

                if (!session) {
                    db.close();
                    return res.status(404).json({
                        success: false,
                        message: '会话不存在或无权限访问'
                    });
                }

                // 获取聊天历史
                db.all(
                    'SELECT id, role, message, created_at FROM chat_history WHERE session_id = ? ORDER BY created_at ASC',
                    [sessionId],
                    (err, messages) => {
                        db.close();
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: '获取历史失败'
                            });
                        }

                        res.json({
                            success: true,
                            sessionId,
                            messages: messages || []
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

// 获取用户的所有会话
router.get('/sessions', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const db = await getDB();

        db.all(
            'SELECT session_id, created_at, last_activity FROM chat_sessions WHERE user_id = ? ORDER BY last_activity DESC',
            [userId],
            (err, sessions) => {
                db.close();
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: '获取会话列表失败'
                    });
                }

                res.json({
                    success: true,
                    sessions: sessions || []
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

// 删除聊天会话
router.delete('/session/:sessionId', verifyToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.userId;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: '会话ID不能为空'
            });
        }

        const db = await getDB();

        // 检查会话是否属于当前用户
        db.get(
            'SELECT id FROM chat_sessions WHERE session_id = ? AND user_id = ?',
            [sessionId, userId],
            (err, session) => {
                if (err) {
                    db.close();
                    return res.status(500).json({
                        success: false,
                        message: '数据库错误'
                    });
                }

                if (!session) {
                    db.close();
                    return res.status(404).json({
                        success: false,
                        message: '会话不存在或无权限删除'
                    });
                }

                // 删除会话（级联删除对应消息）
                db.run(
                    'DELETE FROM chat_sessions WHERE session_id = ?',
                    [sessionId],
                    (err) => {
                        db.close();
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: '删除会话失败'
                            });
                        }

                        res.json({
                            success: true,
                            message: '会话已删除'
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
