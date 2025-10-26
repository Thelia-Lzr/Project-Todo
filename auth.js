const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// 认证中间件
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: '未提供认证令牌' 
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ 
                success: false, 
                message: '无效的认证令牌' 
            });
        }
        req.userId = decoded.userId;
        req.username = decoded.username;
        next();
    });
}

// 生成JWT令牌
function generateToken(userId, username) {
    return jwt.sign(
        { userId, username },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

module.exports = {
    verifyToken,
    generateToken,
    JWT_SECRET
};
