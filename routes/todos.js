const express = require('express');
const { verifyToken } = require('../auth');
const { getDB } = require('../db');

const router = express.Router();

// 获取所有待办事项
router.get('/', verifyToken, async (req, res) => {
    console.log(`📋 GET /api/todos - 用户: ${req.userId}`);
    let db;
    try {
        db = await getDB();
        console.log(`📊 数据库连接成功，查询用户 ${req.userId} 的待办事项...`);
        
        db.all(
            'SELECT id, text, due_date, completed FROM todos WHERE user_id = ? ORDER BY due_date ASC',
            [req.userId],
            (err, todos) => {
                if (err) {
                    console.error('❌ 数据库查询错误:', err);
                    if (db) db.close();
                    return res.status(500).json({
                        success: false,
                        message: '获取待办事项失败'
                    });
                }

                console.log(`✅ 查询成功，找到 ${todos.length} 条待办事项`);
                if (db) db.close();
                res.json({
                    success: true,
                    todos: todos || []
                });
            }
        );
    } catch (error) {
        console.error('❌ GET /api/todos 错误:', error);
        if (db) db.close();
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 创建待办事项
router.post('/', verifyToken, async (req, res) => {
    let db;
    try {
        const { text, dueDate } = req.body;

        // ✅ 只验证 text，dueDate 可选
        if (!text) {
            return res.status(400).json({
                success: false,
                message: '事项内容不能为空'
            });
        }

        db = await getDB();

        db.run(
            'INSERT INTO todos (user_id, text, due_date) VALUES (?, ?, ?)',
            [req.userId, text, dueDate || null],
            function(err) {
                if (err) {
                    console.error('❌ 创建待办事项错误:', err);
                    if (db) db.close();
                    return res.status(500).json({
                        success: false,
                        message: '创建待办事项失败'
                    });
                }

                if (db) db.close();
                res.status(201).json({
                    success: true,
                    message: '待办事项已创建',
                    todo: {
                        id: this.lastID,
                        text,
                        dueDate: dueDate || null,
                        completed: false
                    }
                });
            }
        );
    } catch (error) {
        console.error('❌ POST /api/todos 错误:', error);
        if (db) db.close();
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 更新待办事项
router.put('/:id', verifyToken, async (req, res) => {
    let db;
    try {
        const { text, dueDate, completed } = req.body;
        const todoId = req.params.id;

        db = await getDB();

        // 检查待办事项是否属于当前用户
        db.get(
            'SELECT id FROM todos WHERE id = ? AND user_id = ?',
            [todoId, req.userId],
            (err, todo) => {
                if (err) {
                    console.error('❌ 查询待办事项错误:', err);
                    if (db) db.close();
                    return res.status(500).json({
                        success: false,
                        message: '数据库错误'
                    });
                }

                if (!todo) {
                    if (db) db.close();
                    return res.status(404).json({
                        success: false,
                        message: '待办事项不存在或无权限修改'
                    });
                }

                // 更新待办事项（使用 UTC 时间）
                const utcNow = new Date().toISOString();
                let updateQuery = 'UPDATE todos SET updated_at = ?';
                const params = [utcNow];

                if (text !== undefined) {
                    updateQuery += ', text = ?';
                    params.push(text);
                }
                if (dueDate !== undefined) {
                    updateQuery += ', due_date = ?';
                    params.push(dueDate);
                }
                if (completed !== undefined) {
                    updateQuery += ', completed = ?';
                    params.push(completed ? 1 : 0);
                }

                updateQuery += ' WHERE id = ?';
                params.push(todoId);

                db.run(updateQuery, params, (err) => {
                    if (err) {
                        console.error('❌ 更新待办事项错误:', err);
                        if (db) db.close();
                        return res.status(500).json({
                            success: false,
                            message: '更新待办事项失败'
                        });
                    }

                    if (db) db.close();
                    res.json({
                        success: true,
                        message: '待办事项已更新'
                    });
                });
            }
        );
    } catch (error) {
        console.error('❌ PUT /api/todos/:id 错误:', error);
        if (db) db.close();
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 删除待办事项
router.delete('/:id', verifyToken, async (req, res) => {
    let db;
    try {
        const todoId = req.params.id;
        db = await getDB();

        // 检查待办事项是否属于当前用户
        db.get(
            'SELECT id FROM todos WHERE id = ? AND user_id = ?',
            [todoId, req.userId],
            (err, todo) => {
                if (err) {
                    console.error('❌ 查询待办事项错误:', err);
                    if (db) db.close();
                    return res.status(500).json({
                        success: false,
                        message: '数据库错误'
                    });
                }

                if (!todo) {
                    if (db) db.close();
                    return res.status(404).json({
                        success: false,
                        message: '待办事项不存在或无权限删除'
                    });
                }

                // 删除待办事项
                db.run(
                    'DELETE FROM todos WHERE id = ?',
                    [todoId],
                    (err) => {
                        if (err) {
                            console.error('❌ 删除待办事项错误:', err);
                            if (db) db.close();
                            return res.status(500).json({
                                success: false,
                                message: '删除待办事项失败'
                            });
                        }

                        if (db) db.close();
                        res.json({
                            success: true,
                            message: '待办事项已删除'
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.error('❌ DELETE /api/todos/:id 错误:', error);
        if (db) db.close();
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

module.exports = router;
