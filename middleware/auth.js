/**
 * 认证中间件 - 用于保护 API 路由
 * 确保只有已认证的用户才能访问数据
 */

const jwt = require('jsonwebtoken');

// 密钥（应该在生产环境中使用环境变量）
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 验证 JWT token
 * @param {string} token - JWT token
 * @returns {object|null} - 解码后的 token，如果无效返回 null
 */
function verifyToken(token) {
    try {
        if (!token || typeof token !== 'string') return null;
        
        // 移除 "Bearer " 前缀
        const cleanToken = token.replace('Bearer ', '');
        
        const decoded = jwt.verify(cleanToken, SECRET_KEY);
        return decoded;
    } catch (error) {
        console.error('❌ Token 验证失败:', error.message);
        return null;
    }
}

/**
 * Express 中间件：检查认证
 * 使用方式: app.use(authMiddleware);
 * 或在特定路由: router.get('/protected', authMiddleware, handler);
 */
function authMiddleware(req, res, next) {
    // 从请求头获取 token
    const authHeader = req.headers['authorization'];
    
    console.log('authMiddleware - authHeader:', authHeader);
    
    if (!authHeader) {
        console.warn(`⚠️  请求无 Authorization header - ${req.method} ${req.path}`);
        return res.status(401).json({
            success: false,
            message: '缺少认证令牌'
        });
    }
    
    // authHeader 可能是 "Bearer token" 或直接是 "token"
    const decoded = verifyToken(authHeader);
    
    console.log('authMiddleware - decoded:', decoded);
    
    if (!decoded) {
        console.warn(`⚠️  Token 无效 - ${req.method} ${req.path}`);
        return res.status(401).json({
            success: false,
            message: '认证令牌无效或已过期'
        });
    }
    
    // 将用户信息附加到请求对象
    // 兼容两种格式：decoded.id 或 decoded.userId
    req.user = decoded;
    req.userId = decoded.id || decoded.userId;
    
    console.log(`✅ 认证成功 - 用户: ${decoded.username} (ID: ${req.userId})`);
    next();
}

/**
 * 生成 JWT token
 * @param {number} userId - 用户 ID
 * @param {string} username - 用户名
 * @returns {string} - JWT token
 */
function generateToken(userId, username) {
    const token = jwt.sign(
        {
            id: userId,
            username: username,
            iat: Math.floor(Date.now() / 1000)
        },
        SECRET_KEY,
        { expiresIn: '30d' }  // token 30天过期
    );
    
    console.log(`✅ Token 已生成 - 用户: ${username}`);
    return token;
}

/**
 * 获取当前用户 ID（从 token 中）
 * 在中间件之后使用
 */
function getCurrentUserId(req) {
    return req.user?.id;
}

/**
 * 检查用户权限（确保只能访问自己的数据）
 * @param {number} requestedUserId - 请求访问的用户 ID
 * @param {number} currentUserId - 当前认证用户的 ID
 * @returns {boolean} - 是否有权限
 */
function checkUserOwnership(requestedUserId, currentUserId) {
    const hasPermission = parseInt(requestedUserId) === parseInt(currentUserId);
    
    if (!hasPermission) {
        console.warn(`❌ 权限拒绝 - 用户 ${currentUserId} 尝试访问用户 ${requestedUserId} 的数据`);
    }
    
    return hasPermission;
}

/**
 * 安全的参数化查询辅助函数
 * 防止 SQL 注入
 * @param {string} value - 要检查的值
 * @returns {boolean} - 是否安全
 */
function isSafeQueryParam(value) {
    if (value === null || value === undefined) return false;
    
    // 检查是否为数字
    if (!isNaN(value) && value !== '') return true;
    
    // 检查字符串是否不包含 SQL 关键词
    const sqlKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'SELECT', 'UNION', '--', ';', '/*', '*/'];
    const upperValue = String(value).toUpperCase();
    
    for (const keyword of sqlKeywords) {
        if (upperValue.includes(keyword)) {
            console.warn(`⚠️  检测到潜在的 SQL 注入: ${value}`);
            return false;
        }
    }
    
    return true;
}

module.exports = {
    authMiddleware,
    verifyToken,
    generateToken,
    getCurrentUserId,
    checkUserOwnership,
    isSafeQueryParam,
    SECRET_KEY
};
