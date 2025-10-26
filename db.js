const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');

// 初始化数据库
async function initDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(err);
                return;
            }

            // 创建用户表
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    email TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    last_login DATETIME
                )
            `, (err) => {
                if (err && !err.message.includes('already exists')) {
                    reject(err);
                    return;
                }

                // 创建待办事项表
                db.run(`
                    CREATE TABLE IF NOT EXISTS todos (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        text TEXT NOT NULL,
                        due_date TEXT,
                        completed BOOLEAN DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err && !err.message.includes('already exists')) {
                        reject(err);
                        return;
                    }

                    // 创建AI权限表
                    db.run(`
                        CREATE TABLE IF NOT EXISTS ai_permissions (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL UNIQUE,
                            permission_type TEXT DEFAULT 'LIMITED',
                            limit_days INTEGER,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            expires_at DATETIME,
                            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                        )
                    `, (err) => {
                        if (err && !err.message.includes('already exists')) {
                            reject(err);
                            return;
                        }

                        // 创建聊天会话表
                        db.run(`
                            CREATE TABLE IF NOT EXISTS chat_sessions (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                user_id INTEGER NOT NULL,
                                session_id TEXT UNIQUE NOT NULL,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                            )
                        `, (err) => {
                            if (err && !err.message.includes('already exists')) {
                                reject(err);
                                return;
                            }

                            // 创建聊天记录表
                            db.run(`
                                CREATE TABLE IF NOT EXISTS chat_history (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    user_id INTEGER NOT NULL,
                                    session_id TEXT NOT NULL,
                                    role TEXT NOT NULL,
                                    message TEXT NOT NULL,
                                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                                    FOREIGN KEY(session_id) REFERENCES chat_sessions(session_id) ON DELETE CASCADE
                                )
                            `, (err) => {
                                if (err && !err.message.includes('already exists')) {
                                    reject(err);
                                    return;
                                }

                                // 创建API使用记录表
                                db.run(`
                                    CREATE TABLE IF NOT EXISTS api_usage (
                                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                        user_id INTEGER NOT NULL,
                                        request_tokens INTEGER DEFAULT 0,
                                        response_tokens INTEGER DEFAULT 0,
                                        total_tokens INTEGER DEFAULT 0,
                                        model_name TEXT,
                                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                                    )
                                `, (err) => {
                                    if (err && !err.message.includes('already exists')) {
                                        reject(err);
                                        return;
                                    }

                                    // 创建索引以优化查询性能
                                    db.run('CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id)', (err) => {
                                        if (err && !err.message.includes('already exists')) {
                                            reject(err);
                                            return;
                                        }

                                        db.run('CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id)', (err) => {
                                            if (err && !err.message.includes('already exists')) {
                                                reject(err);
                                                return;
                                            }

                                            db.run('CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id)', (err) => {
                                                if (err && !err.message.includes('already exists')) {
                                                    reject(err);
                                                    return;
                                                }

                                                db.run('CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id)', (err) => {
                                                    if (err && !err.message.includes('already exists')) {
                                                        reject(err);
                                                        return;
                                                    }

                                                    db.run('CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at)', (err) => {
                                                        if (err && !err.message.includes('already exists')) {
                                                            reject(err);
                                                            return;
                                                        }

                                                        // 创建初始用户
                                                        createInitialUser(db).then(() => {
                                                            db.close();
                                                            resolve();
                                                        }).catch((error) => {
                                                            db.close();
                                                            reject(error);
                                                        });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

// 创建初始用户
async function createInitialUser(db) {
    return new Promise((resolve, reject) => {
        const username = 'Thelia';
        const password = 'TheliaThelia123';

        // 检查用户是否已存在
        db.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                reject(err);
                return;
            }

            if (row) {
                // 用户已存在，检查是否有AI权限
                db.get('SELECT id FROM ai_permissions WHERE user_id = ?', [row.id], (err, perm) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    if (!perm) {
                        // 为现有用户添加无限AI权限
                        db.run(
                            'INSERT INTO ai_permissions (user_id, permission_type) VALUES (?, ?)',
                            [row.id, 'UNLIMITED'],
                            (err) => {
                                if (err && !err.message.includes('UNIQUE constraint')) {
                                    reject(err);
                                } else {
                                    resolve();
                                }
                            }
                        );
                    } else {
                        resolve();
                    }
                });
                return;
            }

            // 创建新用户
            try {
                const hashedPassword = await bcrypt.hash(password, 10);
                db.run(
                    'INSERT INTO users (username, password) VALUES (?, ?)',
                    [username, hashedPassword],
                    function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            const userId = this.lastID;
                            console.log('✅ 初始用户已创建: Thelia');
                            
                            // 为新用户创建无限AI权限
                            db.run(
                                'INSERT INTO ai_permissions (user_id, permission_type) VALUES (?, ?)',
                                [userId, 'UNLIMITED'],
                                (err) => {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        console.log('✅ 为 Thelia 创建了无限 AI 权限');
                                        
                                        // 添加 last_login 字段（如果不存在）
                                        db.run(`ALTER TABLE users ADD COLUMN last_login DATETIME`, (err) => {
                                            if (err && !err.message.includes('duplicate column')) {
                                                console.log('⚠️  添加 last_login 字段失败或已存在:', err.message);
                                            } else if (!err) {
                                                console.log('✅ 已添加 last_login 字段');
                                            }
                                            resolve();
                                        });
                                    }
                                }
                            );
                        }
                    }
                );
            } catch (error) {
                reject(error);
            }
        });
    });
}

// 获取数据库连接
function getDB() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

module.exports = {
    initDatabase,
    getDB
};
