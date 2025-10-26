/**
 * 时间工具类 - 统一处理时间的存储、显示和转换
 * 
 * 原则：
 * 1. 存储：始终使用 UTC 时间（ISO 8601 格式）
 * 2. 显示：转换为用户本地时区
 * 3. 格式：显示时带时区标识
 */

class TimeUtils {
    /**
     * 获取用户当前时区偏移量（分钟）
     */
    static getTimezoneOffset() {
        return new Date().getTimezoneOffset();
    }

    /**
     * 获取用户时区字符串（如 "UTC+8"）
     */
    static getTimezoneString() {
        const offset = -this.getTimezoneOffset() / 60;
        if (offset === 0) return 'UTC';
        const sign = offset > 0 ? '+' : '';
        return `UTC${sign}${offset}`;
    }

    /**
     * 将本地时间转换为 UTC ISO 字符串（用于存储）
     * @param {Date|string|null} localDate - 本地时间对象或字符串，null 表示当前时间
     * @returns {string} UTC ISO 字符串，如 "2025-10-25T03:24:24.000Z"
     */
    static toUTC(localDate = null) {
        const date = localDate ? new Date(localDate) : new Date();
        return date.toISOString();
    }

    /**
     * 将 UTC 时间转换为本地 Date 对象
     * @param {string} utcString - UTC 时间字符串
     * @returns {Date|null} 本地时间对象
     */
    static toLocal(utcString) {
        if (!utcString) return null;
        try {
            return new Date(utcString);
        } catch (error) {
            console.error('时间转换失败:', error, utcString);
            return null;
        }
    }

    /**
     * 格式化显示时间（带时区）
     * @param {string|Date} utcString - UTC 时间字符串或 Date 对象
     * @param {boolean} showSeconds - 是否显示秒
     * @returns {string} 格式化的时间字符串，如 "2025/10/25 11:24:24 UTC+8"
     */
    static formatDateTime(utcString, showSeconds = true) {
        const date = this.toLocal(utcString);
        if (!date) return '无效时间';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');
        
        const timezone = this.getTimezoneString();
        
        if (showSeconds) {
            return `${year}/${month}/${day} ${hour}:${minute}:${second} ${timezone}`;
        } else {
            return `${year}/${month}/${day} ${hour}:${minute} ${timezone}`;
        }
    }

    /**
     * 格式化显示日期（不含时间）
     * @param {string|Date} utcString - UTC 时间字符串或 Date 对象
     * @returns {string} 格式化的日期字符串，如 "2025/10/25"
     */
    static formatDate(utcString) {
        const date = this.toLocal(utcString);
        if (!date) return '无效日期';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}/${month}/${day}`;
    }

    /**
     * 格式化显示时间（不含日期）
     * @param {string|Date} utcString - UTC 时间字符串或 Date 对象
     * @returns {string} 格式化的时间字符串，如 "11:24:24 UTC+8"
     */
    static formatTime(utcString) {
        const date = this.toLocal(utcString);
        if (!date) return '无效时间';

        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');
        const timezone = this.getTimezoneString();
        
        return `${hour}:${minute}:${second} ${timezone}`;
    }

    /**
     * 相对时间显示（如"刚刚"、"5分钟前"）
     * @param {string|Date} utcString - UTC 时间字符串或 Date 对象
     * @param {boolean} withTimezone - 是否在绝对时间后显示时区
     * @returns {string} 相对时间字符串
     */
    static formatRelative(utcString, withTimezone = true) {
        const date = this.toLocal(utcString);
        if (!date) return '无效时间';

        const now = new Date();
        const diff = now - date;

        // 未来时间
        if (diff < 0) {
            return this.formatDateTime(utcString, false);
        }

        // 小于1分钟
        if (diff < 60000) {
            return '刚刚';
        }

        // 小于1小时
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}分钟前`;
        }

        // 小于1天
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}小时前`;
        }

        // 小于7天
        if (diff < 604800000) {
            const days = Math.floor(diff / 86400000);
            return `${days}天前`;
        }

        // 超过7天，显示完整日期
        return this.formatDateTime(utcString, withTimezone);
    }

    /**
     * 获取用于 datetime-local input 的本地时间字符串
     * @param {string|Date|null} utcString - UTC 时间字符串，null 表示当前时间
     * @returns {string} 本地时间字符串，格式 "2025-10-25T11:24"
     */
    static toDateTimeLocalString(utcString = null) {
        const date = utcString ? this.toLocal(utcString) : new Date();
        if (!date) return '';

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');

        return `${year}-${month}-${day}T${hour}:${minute}`;
    }

    /**
     * 从 datetime-local input 值转换为 UTC
     * @param {string} localString - datetime-local 的值，如 "2025-10-25T11:24"
     * @returns {string} UTC ISO 字符串
     */
    static fromDateTimeLocalString(localString) {
        if (!localString) return null;
        const date = new Date(localString);
        return date.toISOString();
    }

    /**
     * 格式化聊天时间戳（今天/昨天/具体日期 + 时间 + 时区）
     * @param {string|Date} utcString - UTC 时间字符串
     * @param {boolean} showSeconds - 是否显示秒，默认 true
     * @returns {string} 格式化的聊天时间戳
     */
    static formatChatTimestamp(utcString, showSeconds = true) {
        const date = this.toLocal(utcString);
        if (!date) return '';

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');
        const timezone = this.getTimezoneString();
        
        const timeStr = showSeconds 
            ? `${hour}:${minute}:${second} ${timezone}`
            : `${hour}:${minute} ${timezone}`;

        if (messageDate.getTime() === today.getTime()) {
            return `今天 ${timeStr}`;
        } else if (messageDate.getTime() === yesterday.getTime()) {
            return `昨天 ${timeStr}`;
        } else {
            const month = date.getMonth() + 1;
            const day = date.getDate();
            return `${month}月${day}日 ${timeStr}`;
        }
    }

    /**
     * 计算时间差（毫秒）
     * @param {string|Date} utcString1 - 第一个时间
     * @param {string|Date} utcString2 - 第二个时间，默认为当前时间
     * @returns {number} 时间差（毫秒）
     */
    static diff(utcString1, utcString2 = null) {
        const date1 = this.toLocal(utcString1);
        const date2 = utcString2 ? this.toLocal(utcString2) : new Date();
        if (!date1 || !date2) return 0;
        return Math.abs(date2 - date1);
    }

    /**
     * 格式化时长（用于权限倒计时等）
     * @param {number} milliseconds - 毫秒数
     * @returns {string} 格式化的时长，如 "5天 12小时 30分 45秒"
     */
    static formatDuration(milliseconds) {
        if (milliseconds <= 0) return '已过期';

        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        const s = seconds % 60;
        const m = minutes % 60;
        const h = hours % 24;

        if (days > 0) {
            return `${days}天 ${String(h).padStart(2, '0')}小时 ${String(m).padStart(2, '0')}分 ${String(s).padStart(2, '0')}秒`;
        } else if (hours > 0) {
            return `${h}小时 ${String(m).padStart(2, '0')}分 ${String(s).padStart(2, '0')}秒`;
        } else if (minutes > 0) {
            return `${m}分 ${String(s).padStart(2, '0')}秒`;
        } else {
            return `${s}秒`;
        }
    }
}

// 导出为全局对象
if (typeof window !== 'undefined') {
    window.TimeUtils = TimeUtils;
}
