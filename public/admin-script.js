class AdminApp {
    constructor() {
        // 使用相对路径，支持开发隧道（ngrok、VS Code 隧道等）
        this.apiBaseURL = '/api';
        this.token = this.getToken();
        this.users = [];
        this.sessions = [];
        this.verified = false;
        this.init();
    }

    init() {
        // 检查是否已登录
        const username = this.getUsername();
        if (!username || username !== 'Thelia') {
            alert('请先以管理员身份登录！');
            window.location.href = '/';
            return;
        }

        // 绑定验证表单事件
        const verifyForm = document.getElementById('verifyForm');
        if (verifyForm) {
            verifyForm.addEventListener('submit', (e) => this.handleVerify(e));
        }
        
        // 绑定其他事件
        this.bindEvents();
    }

    async handleVerify(e) {
        e.preventDefault();
        
        const password = document.getElementById('adminPassword').value;
        const errorMsg = document.getElementById('verifyError');
        errorMsg.classList.remove('show');

        if (!password) {
            errorMsg.textContent = '请输入密码';
            errorMsg.classList.add('show');
            return;
        }

        try {
            // 使用当前用户的密码验证（即Thelia的密码）
            const response = await fetch(`${this.apiBaseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: 'Thelia',
                    password: password
                })
            });

            const data = await response.json();
            
            if (data.success) {
                // 更新 token（使用新验证的 token）
                this.token = data.token;
                this.verified = true;
                this.showAdminPanel();
                this.loadUsers();
                this.loadChatSessions();
            } else {
                errorMsg.textContent = '密码错误';
                errorMsg.classList.add('show');
            }
        } catch (error) {
            console.error('验证失败:', error);
            errorMsg.textContent = '验证失败，请稍后重试';
            errorMsg.classList.add('show');
        }
    }

    showAdminPanel() {
        document.getElementById('adminVerifyPage').classList.remove('active');
        document.getElementById('adminPanelPage').classList.add('active');
        document.getElementById('adminUser').textContent = `👑 Thelia`;
    }

    getUsername() {
        return localStorage.getItem('todolistUsername');
    }

    bindEvents() {
        // 权限类型切换
        const newPermType = document.getElementById('newPermissionType');
        if (newPermType) {
            newPermType.addEventListener('change', () => {
                const limitGroup = document.getElementById('limitDaysGroup');
                limitGroup.style.display = newPermType.value === 'LIMITED' ? 'block' : 'none';
            });
        }

        const editPermType = document.getElementById('editPermissionType');
        if (editPermType) {
            editPermType.addEventListener('change', () => {
                const limitGroup = document.getElementById('editLimitDaysGroup');
                limitGroup.style.display = editPermType.value === 'LIMITED' ? 'block' : 'none';
            });
        }
    }

    getToken() {
        return localStorage.getItem('todolistToken');
    }

    // ========== 用户管理 ==========

    async loadUsers() {
        try {
            console.log('正在加载用户列表...');
            console.log('Token:', this.token);
            
            const response = await fetch(`${this.apiBaseURL}/admin/users`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            console.log('响应状态:', response.status);
            const data = await response.json();
            console.log('响应数据:', data);
            
            if (data.success) {
                this.users = data.users || [];
                this.renderUsers();
            } else {
                console.error('加载失败:', data.message);
                this.showError('加载用户列表失败: ' + (data.message || '未知错误'));
            }
        } catch (error) {
            console.error('加载用户失败:', error);
            this.showError('加载用户列表失败');
        }
    }

    renderUsers() {
        const userList = document.getElementById('userList');
        
        if (this.users.length === 0) {
            userList.innerHTML = '<div class="empty-state">暂无用户</div>';
            return;
        }

        userList.innerHTML = this.users.map(user => {
            const permission = user.permission || {};
            let permClass = 'limited';
            let permText = '无权限';
            
            if (permission.type === 'UNLIMITED') {
                permClass = 'unlimited';
                permText = '无限制 ♾️';
            } else if (permission.type === 'LIMITED') {
                if (permission.status === 'expired') {
                    permClass = 'expired';
                    permText = `已过期 (${permission.limit_days || 0}天)`;
                } else {
                    permClass = 'limited';
                    const days = Math.max(0, permission.days_remaining || 0);
                    permText = `剩余 ${days} 天`;
                }
            }

            // 格式化最后登录时间
            const lastLogin = user.last_login ? this.formatLastLogin(user.last_login) : '从未登录';

            return `
                <div class="user-card">
                    <div class="user-info">
                        <div class="user-name">${this.escapeHtml(user.username)}</div>
                        <div class="user-meta">
                            <span>ID: ${user.id}</span>
                            <span>📧 ${user.email || '未设置'}</span>
                            <span class="user-permission ${permClass}">${permText}</span>
                            <span>🕒 上次登录: ${lastLogin}</span>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button class="btn-success" onclick="app.showEditPermission(${user.id}, '${this.escapeHtml(user.username)}')">编辑权限</button>
                        ${user.username !== 'Thelia' ? `<button class="btn-danger" onclick="app.deleteUser(${user.id}, '${this.escapeHtml(user.username)}')">删除用户</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    showAddUserModal() {
        document.getElementById('addUserModal').classList.add('active');
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('newEmail').value = '';
        document.getElementById('newPermissionType').value = 'LIMITED';
        document.getElementById('newLimitDays').value = '30';
        document.getElementById('limitDaysGroup').style.display = 'block';
        document.getElementById('addUserError').classList.remove('show');
    }

    closeAddUserModal() {
        document.getElementById('addUserModal').classList.remove('active');
    }

    async addUser() {
        const username = document.getElementById('newUsername').value.trim();
        const password = document.getElementById('newPassword').value;
        const email = document.getElementById('newEmail').value.trim();
        const permissionType = document.getElementById('newPermissionType').value;
        const limitDays = parseInt(document.getElementById('newLimitDays').value);

        const errorMsg = document.getElementById('addUserError');
        errorMsg.classList.remove('show');

        if (!username || !password) {
            errorMsg.textContent = '用户名和密码不能为空';
            errorMsg.classList.add('show');
            return;
        }

        if (password.length < 6) {
            errorMsg.textContent = '密码至少6个字符';
            errorMsg.classList.add('show');
            return;
        }

        if (permissionType === 'LIMITED' && (!limitDays || limitDays < 1)) {
            errorMsg.textContent = '有效天数必须大于0';
            errorMsg.classList.add('show');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseURL}/admin/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    username,
                    password,
                    email: email || null,
                    permissionType,
                    limitDays: permissionType === 'LIMITED' ? limitDays : null
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.closeAddUserModal();
                await this.loadUsers();
                alert('✅ 用户创建成功！');
            } else {
                errorMsg.textContent = data.message || '创建用户失败';
                errorMsg.classList.add('show');
            }
        } catch (error) {
            console.error('创建用户失败:', error);
            errorMsg.textContent = '创建用户失败，请稍后重试';
            errorMsg.classList.add('show');
        }
    }

    async deleteUser(userId, username) {
        if (!confirm(`确定要删除用户 "${username}" 吗？\n\n此操作将删除该用户的所有待办事项和聊天记录，且无法恢复！`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseURL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                await this.loadUsers();
                await this.loadChatSessions();
                alert('✅ 用户已删除！');
            } else {
                alert('❌ ' + (data.message || '删除失败'));
            }
        } catch (error) {
            console.error('删除用户失败:', error);
            alert('❌ 删除失败，请稍后重试');
        }
    }

    showEditPermission(userId, username) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const permission = user.permission || {};
        
        document.getElementById('editUserId').value = userId;
        document.getElementById('editUsername').value = username;
        document.getElementById('editPermissionType').value = permission.type || 'LIMITED';
        document.getElementById('editLimitDays').value = permission.limit_days || 30;
        document.getElementById('editLimitDaysGroup').style.display = 
            permission.type === 'LIMITED' ? 'block' : 'none';
        document.getElementById('editPermissionError').classList.remove('show');
        
        document.getElementById('editPermissionModal').classList.add('active');
    }

    closeEditPermissionModal() {
        document.getElementById('editPermissionModal').classList.remove('active');
    }

    async updatePermission() {
        const userId = document.getElementById('editUserId').value;
        const permissionType = document.getElementById('editPermissionType').value;
        const limitDays = parseInt(document.getElementById('editLimitDays').value);

        const errorMsg = document.getElementById('editPermissionError');
        errorMsg.classList.remove('show');

        if (permissionType === 'LIMITED' && (!limitDays || limitDays < 1)) {
            errorMsg.textContent = '有效天数必须大于0';
            errorMsg.classList.add('show');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseURL}/admin/users/${userId}/permission`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    permissionType,
                    limitDays: permissionType === 'LIMITED' ? limitDays : null
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.closeEditPermissionModal();
                await this.loadUsers();
                alert('✅ 权限更新成功！');
            } else {
                errorMsg.textContent = data.message || '更新失败';
                errorMsg.classList.add('show');
            }
        } catch (error) {
            console.error('更新权限失败:', error);
            errorMsg.textContent = '更新失败，请稍后重试';
            errorMsg.classList.add('show');
        }
    }

    // ========== 聊天记录管理 ==========

    async loadChatSessions() {
        try {
            console.log('正在加载聊天会话...');
            console.log('Token:', this.token);
            
            const response = await fetch(`${this.apiBaseURL}/admin/chat-sessions`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            console.log('响应状态:', response.status);
            const data = await response.json();
            console.log('响应数据:', data);
            
            if (data.success) {
                this.sessions = data.sessions || [];
                this.renderChatSessions();
            } else {
                console.error('加载失败:', data.message);
                this.showError('加载聊天会话失败: ' + (data.message || '未知错误'));
            }
        } catch (error) {
            console.error('加载聊天会话失败:', error);
            this.showError('加载聊天会话失败');
        }
    }

    renderChatSessions() {
        const sessionsList = document.getElementById('chatSessionsList');
        
        if (this.sessions.length === 0) {
            sessionsList.innerHTML = '<div class="empty-state">暂无聊天记录</div>';
            return;
        }

        // 按用户分组
        const groupedSessions = {};
        this.sessions.forEach(session => {
            if (!groupedSessions[session.username]) {
                groupedSessions[session.username] = [];
            }
            groupedSessions[session.username].push(session);
        });

        sessionsList.innerHTML = Object.entries(groupedSessions).map(([username, sessions]) => {
            const totalMessages = sessions.reduce((sum, s) => sum + (s.message_count || 0), 0);
            // 获取最近活动时间
            const latestActivity = sessions.reduce((latest, s) => {
                const activityTime = new Date(s.last_activity).getTime();
                return activityTime > latest ? activityTime : latest;
            }, 0);
            const lastActivityText = latestActivity > 0 
                ? TimeUtils.formatRelative(new Date(latestActivity).toISOString(), false)
                : '未知';
            
            return `
                <div class="session-card">
                    <div class="session-info">
                        <div class="session-user">${this.escapeHtml(username)}</div>
                        <div class="session-meta">
                            <span>💬 ${sessions.length} 个会话</span>
                            <span>📝 ${totalMessages} 条消息</span>
                            <span>🕒 最后活动: ${lastActivityText}</span>
                        </div>
                    </div>
                    <div class="user-actions">
                        <button class="btn-warning" onclick="app.clearUserChatHistory('${this.escapeHtml(username)}')">清空聊天记录</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    async clearUserChatHistory(username) {
        if (!confirm(`确定要清空用户 "${username}" 的所有聊天记录吗？\n\n此操作无法恢复！`)) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseURL}/admin/chat-history/${encodeURIComponent(username)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();
            
            if (data.success) {
                await this.loadChatSessions();
                alert('✅ 聊天记录已清空！');
            } else {
                alert('❌ ' + (data.message || '清空失败'));
            }
        } catch (error) {
            console.error('清空聊天记录失败:', error);
            alert('❌ 清空失败，请稍后重试');
        }
    }

    // ========== 工具函数 ==========

    formatLastLogin(lastLogin) {
        if (!lastLogin) return '从未登录';
        
        // 使用 TimeUtils 格式化相对时间（UTC 转本地时区）
        return TimeUtils.formatRelative(lastLogin, true);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        console.error(message);
        alert('❌ ' + message);
    }
}

// 初始化应用
const app = new AdminApp();
