const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');

console.log('🔄 开始数据库迁移：添加 last_login 字段...');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 连接数据库失败:', err);
        process.exit(1);
    }

    console.log('✅ 成功连接到数据库');

    // 添加 last_login 字段
    db.run(`ALTER TABLE users ADD COLUMN last_login DATETIME`, (err) => {
        if (err) {
            if (err.message.includes('duplicate column')) {
                console.log('⚠️  last_login 字段已存在，无需添加');
            } else {
                console.error('❌ 添加字段失败:', err);
                db.close();
                process.exit(1);
            }
        } else {
            console.log('✅ 成功添加 last_login 字段');
        }

        // 验证字段是否存在
        db.all("PRAGMA table_info(users)", [], (err, rows) => {
            if (err) {
                console.error('❌ 查询表结构失败:', err);
            } else {
                console.log('\n📋 Users 表结构:');
                rows.forEach(row => {
                    console.log(`  - ${row.name} (${row.type})`);
                });
            }

            db.close(() => {
                console.log('\n✅ 数据库迁移完成！');
                process.exit(0);
            });
        });
    });
});
