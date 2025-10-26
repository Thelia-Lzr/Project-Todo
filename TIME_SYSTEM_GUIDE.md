# 时间系统改进指南

## 概述

整个网站的时间系统已经统一改进，遵循以下原则：

### 核心原则

1. **存储层（后端）**：始终使用 UTC 时间（ISO 8601 格式）
2. **显示层（前端）**：转换为用户本地时区显示
3. **比较层**：所有时间比较使用 UTC 时间
4. **时区标识**：向用户显示时间时，带有时区标识（如 `UTC+8`）

## 前端时间工具类

### TimeUtils 类（`public/time-utils.js`）

#### 主要方法

##### 1. 存储转换
```javascript
// 将本地时间转换为 UTC ISO 字符串（用于发送到后端）
TimeUtils.toUTC(localDate)
// 示例：TimeUtils.toUTC(new Date()) → "2025-10-25T03:24:24.000Z"
```

##### 2. 显示转换
```javascript
// 将 UTC 字符串转换为本地 Date 对象
TimeUtils.toLocal(utcString)
// 示例：TimeUtils.toLocal("2025-10-25T03:24:24.000Z") → Date 对象（本地时间）
```

##### 3. 格式化显示
```javascript
// 完整日期时间（带时区）
TimeUtils.formatDateTime(utcString, showSeconds)
// 示例：2025/10/25 11:24:24 UTC+8

// 仅日期
TimeUtils.formatDate(utcString)
// 示例：2025/10/25

// 仅时间
TimeUtils.formatTime(utcString)
// 示例：11:24:24 UTC+8

// 相对时间
TimeUtils.formatRelative(utcString, withTimezone)
// 示例：刚刚 / 5分钟前 / 2小时前 / 3天前 / 2025/10/25 11:24 UTC+8

// 聊天时间戳（今天/昨天/日期 + 时间）
TimeUtils.formatChatTimestamp(utcString)
// 示例：今天 11:24 / 昨天 15:30 / 10月23日 09:15
```

##### 4. 时区信息
```javascript
// 获取当前时区偏移量（分钟）
TimeUtils.getTimezoneOffset()

// 获取时区字符串
TimeUtils.getTimezoneString()
// 示例：UTC+8 / UTC / UTC-5
```

##### 5. 表单辅助
```javascript
// 获取 datetime-local input 的值格式
TimeUtils.toDateTimeLocalString(utcString)
// 示例：2025-10-25T11:24

// 将 datetime-local 值转换为 UTC
TimeUtils.fromDateTimeLocalString(localString)
// 示例："2025-10-25T11:24" → "2025-10-25T03:24:00.000Z"
```

## 后端改进

### 数据库存储

所有时间字段现在使用 UTC 时间：

```javascript
// ✅ 正确：使用 UTC
const utcTime = new Date().toISOString();
db.run('UPDATE users SET last_login = ? WHERE id = ?', [utcTime, userId]);

// ❌ 错误：使用本地时间
const localTime = new Date().toLocaleString();
db.run('UPDATE users SET last_login = ? WHERE id = ?', [localTime, userId]);

// ❌ 错误：使用 CURRENT_TIMESTAMP（SQLite 是 UTC 但不可控）
db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
```

### 已修改的文件

#### 后端文件
1. **`routes/auth.js`**
   - 登录时更新 `last_login` 使用 UTC 时间

2. **`routes/todos.js`**
   - 更新待办事项的 `updated_at` 使用 UTC 时间

3. **`routes/chat.js`**
   - 更新聊天会话的 `last_activity` 使用 UTC 时间

#### 前端文件
1. **`public/time-utils.js`** ✨ 新增
   - 统一的时间处理工具类

2. **`public/index.html`**
   - 引入 `time-utils.js`

3. **`public/admin.html`**
   - 引入 `time-utils.js`

4. **`public/script.js`**
   - 使用 `TimeUtils.formatDateTime()` 格式化待办事项截止时间
   - 使用 `TimeUtils.formatChatTimestamp()` 格式化聊天时间
   - 使用 `TimeUtils.toUTC()` 将本地时间转换为 UTC 发送到后端
   - 使用 `TimeUtils.toLocal()` 进行时间比较
   - 使用 `TimeUtils.getTimezoneString()` 显示时区标识
   - 使用 `TimeUtils.toDateTimeLocalString()` 设置默认日期时间

5. **`public/admin-script.js`**
   - 使用 `TimeUtils.formatRelative()` 格式化最后登录时间

## 使用示例

### 示例 1：显示用户最后登录时间

```javascript
// 后端返回的 UTC 时间
const user = {
    username: 'Thelia',
    last_login: '2025-10-25T03:24:24.000Z'  // UTC 时间
};

// 前端显示
const displayText = TimeUtils.formatRelative(user.last_login, true);
// 结果：刚刚 / 5分钟前 / 2025/10/25 11:24 UTC+8
```

### 示例 2：添加待办事项

```javascript
// 前端获取用户输入（本地时间）
const dateTimeInput = document.getElementById('todoDateTime');
const localTime = dateTimeInput.value;  // "2025-10-26T14:00"

// 转换为 UTC 发送到后端
const utcTime = TimeUtils.toUTC(new Date(localTime));
// 结果：2025-10-26T06:00:00.000Z

// 发送到后端
await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify({
        text: '完成项目文档',
        dueDate: utcTime  // UTC 时间
    })
});
```

### 示例 3：显示待办事项列表

```javascript
// 后端返回的待办事项（UTC 时间）
const todos = [
    {
        id: 1,
        text: '完成项目文档',
        due_date: '2025-10-26T06:00:00.000Z',  // UTC 时间
        created_at: '2025-10-25T03:00:00.000Z'
    }
];

// 前端显示
todos.forEach(todo => {
    const displayTime = TimeUtils.formatDateTime(todo.due_date);
    console.log(`${todo.text} - 截止时间：${displayTime}`);
    // 输出：完成项目文档 - 截止时间：2025/10/26 14:00:00 UTC+8
});
```

### 示例 4：聊天消息时间戳

```javascript
// 后端返回的聊天消息
const messages = [
    {
        id: 1,
        content: 'Hello!',
        timestamp: '2025-10-25T03:24:24.000Z'  // UTC 时间
    }
];

// 前端显示
messages.forEach(msg => {
    const timeDisplay = TimeUtils.formatChatTimestamp(msg.timestamp);
    console.log(`${timeDisplay}: ${msg.content}`);
    // 输出：今天 11:24: Hello!
});
```

## 时区检测

系统通过浏览器的 JavaScript API 自动检测用户时区：

```javascript
// 自动检测时区偏移量
const offset = new Date().getTimezoneOffset();
// 中国用户：-480（即 UTC+8）

// 生成时区字符串
const timezone = TimeUtils.getTimezoneString();
// 中国用户：UTC+8
```

**注意**：
- 不依赖 IP 地址检测（避免代理问题）
- 使用浏览器系统时间设置
- 自动处理夏令时

## 测试检查清单

### 前端显示
- [ ] 待办事项截止时间显示正确的本地时间和时区
- [ ] 聊天消息时间戳显示正确（今天/昨天/日期）
- [ ] 管理面板用户最后登录时间显示正确
- [ ] 权限过期倒计时计算正确

### 时区兼容性
- [ ] UTC+8（中国）用户显示正确
- [ ] UTC（英国）用户显示正确
- [ ] UTC-5（美东）用户显示正确
- [ ] 夏令时切换时正常工作

### 数据一致性
- [ ] 数据库中所有时间字段都是 UTC
- [ ] 前端发送到后端的时间都是 UTC
- [ ] 后端返回的时间都是 UTC
- [ ] 时间比较（过期判断等）使用 UTC

## 迁移注意事项

### 现有数据库数据

如果数据库中已有数据使用了本地时间，需要进行一次性迁移：

```javascript
// 迁移脚本示例（仅供参考）
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

// 假设现有数据是 UTC+8 本地时间
db.all('SELECT id, last_login FROM users WHERE last_login IS NOT NULL', (err, rows) => {
    rows.forEach(row => {
        // 将本地时间字符串转换为 UTC
        const localDate = new Date(row.last_login);
        const utcDate = localDate.toISOString();
        
        db.run('UPDATE users SET last_login = ? WHERE id = ?', [utcDate, row.id]);
    });
});
```

## 故障排除

### 问题 1：时间显示少了 8 小时

**原因**：数据库存储了本地时间，前端当作 UTC 处理

**解决方案**：
```javascript
// 确保后端存储 UTC
const utcTime = new Date().toISOString();  // ✅

// 而不是
const localTime = new Date().toLocaleString();  // ❌
```

### 问题 2：时间显示多了 8 小时

**原因**：数据库存储了 UTC，前端没有转换

**解决方案**：
```javascript
// 使用 TimeUtils 转换
const displayTime = TimeUtils.formatDateTime(utcString);  // ✅

// 而不是直接显示
const displayTime = new Date(utcString).toLocaleString();  // ❌（可能缺少时区标识）
```

### 问题 3：不同时区用户看到的时间不一致

**预期行为**：不同时区用户应该看到不同的本地时间，但对应的是同一时刻

**示例**：
- UTC 时间：2025-10-25T03:00:00.000Z
- 中国用户看到：2025/10/25 11:00:00 UTC+8
- 美东用户看到：2025/10/24 23:00:00 UTC-5
- 两者指向同一时刻 ✅

## 最佳实践

### ✅ 推荐做法

1. **存储**：始终使用 `new Date().toISOString()` 生成 UTC 时间
2. **显示**：始终使用 `TimeUtils` 工具类格式化显示
3. **比较**：使用 `TimeUtils.toLocal()` 转换后比较
4. **表单**：使用 `datetime-local` input，配合 `TimeUtils.toDateTimeLocalString()` 和 `TimeUtils.fromDateTimeLocalString()`

### ❌ 避免做法

1. 不要使用 `toLocaleString()` 存储到数据库
2. 不要直接显示 ISO 字符串给用户
3. 不要混用本地时间和 UTC 时间
4. 不要依赖 SQLite 的 `CURRENT_TIMESTAMP`（虽然是 UTC 但不可控）

## 总结

通过统一的时间处理系统：
- ✅ 所有时间数据在数据库中一致（UTC）
- ✅ 用户看到的时间符合其本地时区
- ✅ 时区信息清晰标识
- ✅ 代码维护性提高
- ✅ 支持全球用户

遵循"**存储 UTC，显示本地，标注时区**"的原则，让时间处理变得简单可靠。
