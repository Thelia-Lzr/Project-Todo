class AdminApp {
    constructor() {
        // 使用相对路径，支持开发隧道（ngrok、VS Code 隧道等）
        this.apiBaseURL = '/api';
        this.token = this.getToken();
        this.users = [];
        this.sessions = [];
        this.verified = false;
        this.openrouterModelOptions = [];
        this.init();
    }

    async init() {
        const username = this.getUsername();
        if (!username) {
            alert('请先登录账号！');
            window.location.href = '/';
            return;
        }

        const verifyForm = document.getElementById('verifyForm');
        if (verifyForm) {
            verifyForm.addEventListener('submit', (e) => this.handleVerify(e));
        }

        this.bindEvents();

        // 已经验证过的会话直接显示面板
        if (this.token) {
            try {
                const verifyResp = await fetch(`${this.apiBaseURL}/admin/verify`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });

                const data = await verifyResp.json();
                if (data.success && data.isAdmin) {
                    this.verified = true;
                    this.showAdminPanel(data.username || username);
                }
            } catch (error) {
                console.warn('自动验证管理员失败:', error);
            }
        }
    }

    async handleVerify(event) {
        event.preventDefault();
        const passwordInput = document.getElementById('adminPassword');
        const errorMsg = document.getElementById('verifyError');

        if (errorMsg) {
            errorMsg.textContent = '';
            errorMsg.classList.remove('show');
        }

        const password = passwordInput ? passwordInput.value.trim() : '';
        if (!password) {
            if (errorMsg) {
                errorMsg.textContent = '请输入管理员密码';
                errorMsg.classList.add('show');
            }
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: 'Thelia',
                    password
                })
            });

            const data = await response.json();
            if (data.success && data.token) {
                localStorage.setItem('todolistToken', data.token);
                this.token = data.token;
                this.verified = true;
                this.showAdminPanel('Thelia');
            } else {
                if (errorMsg) {
                    errorMsg.textContent = data.message || '密码错误';
                    errorMsg.classList.add('show');
                }
            }
        } catch (error) {
            console.error('管理员验证失败:', error);
            if (errorMsg) {
                errorMsg.textContent = '验证失败，请稍后再试';
                errorMsg.classList.add('show');
            }
        }
    }

    showAdminPanel(adminName = '管理员') {
        const verifyPage = document.getElementById('adminVerifyPage');
        const panelPage = document.getElementById('adminPanelPage');
        const adminUser = document.getElementById('adminUser');

        if (verifyPage) verifyPage.classList.remove('active');
        if (panelPage) panelPage.classList.add('active');
        if (adminUser) adminUser.textContent = `👑 ${adminName}`;

        this.loadOpenrouterSettings();
        this.checkQuota();
        this.loadUsers();
        this.loadChatSessions();
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

        // ========== AI 服务类型切换与 API Key 管理 ========== //
        const aiServiceTypeSelect = document.getElementById('aiServiceType');
        const geminiApiKeyGroup = document.getElementById('geminiApiKeyGroup');
        const deepseekApiKeyGroup = document.getElementById('deepseekApiKeyGroup');
        const openrouterSettingsSection = document.getElementById('openrouterSettingsSection');
        const adminGeminiApiKeyInput = document.getElementById('adminGeminiApiKey');
        const adminDeepseekApiKeyInput = document.getElementById('adminDeepseekApiKey');
        const saveAiServiceBtn = document.getElementById('saveAiServiceBtn');

        if (aiServiceTypeSelect) {
            const updateAiServiceSections = () => {
                const type = aiServiceTypeSelect.value;
                if (geminiApiKeyGroup) {
                    geminiApiKeyGroup.style.display = type === 'gemini' ? '' : 'none';
                }
                if (deepseekApiKeyGroup) {
                    deepseekApiKeyGroup.style.display = type === 'deepseek' ? '' : 'none';
                }
                if (openrouterSettingsSection) {
                    openrouterSettingsSection.style.display = type === 'openrouter' ? '' : 'none';
                }
            };

            aiServiceTypeSelect.addEventListener('change', updateAiServiceSections);

            if (saveAiServiceBtn) {
                saveAiServiceBtn.addEventListener('click', () => {
                    const type = aiServiceTypeSelect.value;
                    localStorage.setItem('preferredAiService', type);

                    if (type === 'gemini') {
                        const key = adminGeminiApiKeyInput ? adminGeminiApiKeyInput.value.trim() : '';
                        localStorage.setItem('adminGeminiApiKey', key);
                        alert('Gemini API Key 已保存，并设置为默认服务');
                    } else if (type === 'deepseek') {
                        const key = adminDeepseekApiKeyInput ? adminDeepseekApiKeyInput.value.trim() : '';
                        localStorage.setItem('adminDeepseekApiKey', key);
                        alert('DeepSeek API Key 已保存，并设置为默认服务');
                    } else {
                        alert('OpenRouter 已设置为默认服务，请在下方配置 API Key 与模型列表');
                    }
                });
            }

            window.addEventListener('DOMContentLoaded', () => {
                if (adminGeminiApiKeyInput) {
                    adminGeminiApiKeyInput.value = localStorage.getItem('adminGeminiApiKey') || '';
                }
                if (adminDeepseekApiKeyInput) {
                    adminDeepseekApiKeyInput.value = localStorage.getItem('adminDeepseekApiKey') || '';
                }
                aiServiceTypeSelect.value = localStorage.getItem('preferredAiService') || 'gemini';
                updateAiServiceSections();
            });
        }

        // ========== OpenRouter 设置事件绑定 ========== //
        const openrouterModelOptionsInput = document.getElementById('openrouterModelOptions');
        const openrouterDefaultModelSelect = document.getElementById('openrouterDefaultModel');
        const saveOpenrouterSettingsBtn = document.getElementById('saveOpenrouterSettingsBtn');
        const toggleOpenrouterApiKeyBtn = document.getElementById('toggleOpenrouterApiKey');

        if (openrouterModelOptionsInput) {
            openrouterModelOptionsInput.addEventListener('input', () => {
                const options = this.parseModelOptions(openrouterModelOptionsInput.value);
                const currentSelection = openrouterDefaultModelSelect ? openrouterDefaultModelSelect.value : '';
                this.populateOpenrouterModelSelect(options, currentSelection);
            });
        }

        if (toggleOpenrouterApiKeyBtn) {
            toggleOpenrouterApiKeyBtn.addEventListener('click', () => this.toggleOpenrouterApiKeyVisibility());
        }

        if (saveOpenrouterSettingsBtn) {
            saveOpenrouterSettingsBtn.addEventListener('click', () => this.saveOpenrouterSettings());
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

    // ========== OpenRouter 设置 ==========

    parseModelOptions(rawText = '') {
        if (!rawText) {
            return [];
        }

        return rawText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }

    populateOpenrouterModelSelect(options = [], selectedValue = '') {
        this.openrouterModelOptions = options;
        const select = document.getElementById('openrouterDefaultModel');
        if (!select) return;

        const fragment = document.createDocumentFragment();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = options.length ? '请选择模型' : '请先填写模型列表';
        fragment.appendChild(placeholder);

        options.forEach(modelId => {
            const option = document.createElement('option');
            option.value = modelId;
            option.textContent = modelId;
            fragment.appendChild(option);
        });

        select.innerHTML = '';
        select.appendChild(fragment);

        if (selectedValue && options.includes(selectedValue)) {
            select.value = selectedValue;
        } else {
            select.value = '';
        }

        select.disabled = options.length === 0;
    }

    async loadOpenrouterSettings() {
        try {
            const response = await fetch(`${this.apiBaseURL}/admin/openrouter-config`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();
            if (!data.success) {
                console.warn('加载 OpenRouter 设置失败:', data.message);
                return;
            }

            const config = data.config || {};
            const apiKeyInput = document.getElementById('openrouterApiKey');
            if (apiKeyInput) {
                apiKeyInput.value = config.apiKey || '';
                apiKeyInput.type = 'password';
            }

            const modelOptions = Array.isArray(config.modelOptions) ? config.modelOptions : [];
            const optionsInput = document.getElementById('openrouterModelOptions');
            if (optionsInput) {
                optionsInput.value = modelOptions.join('\n');
            }

            this.populateOpenrouterModelSelect(modelOptions, config.defaultModel || '');
        } catch (error) {
            console.error('加载 OpenRouter 设置失败:', error);
        }
    }

    toggleOpenrouterApiKeyVisibility() {
        const input = document.getElementById('openrouterApiKey');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
    }

    async saveOpenrouterSettings() {
        const apiKeyInput = document.getElementById('openrouterApiKey');
        const optionsInput = document.getElementById('openrouterModelOptions');
        const defaultModelSelect = document.getElementById('openrouterDefaultModel');
        const errorMsg = document.getElementById('openrouterSettingsError');

        if (!apiKeyInput || !optionsInput || !defaultModelSelect) {
            return;
        }

        if (errorMsg) {
            errorMsg.textContent = '';
            errorMsg.classList.remove('show');
        }

        const apiKey = apiKeyInput.value.trim();
        const options = this.parseModelOptions(optionsInput.value);
        let defaultModel = (defaultModelSelect.value || '').trim();

        if (!apiKey) {
            if (errorMsg) {
                errorMsg.textContent = '请填写 OpenRouter API Key';
                errorMsg.classList.add('show');
            }
            return;
        }

        if (!defaultModel && options.length > 0) {
            defaultModel = options[0];
        }

        if (!defaultModel) {
            if (errorMsg) {
                errorMsg.textContent = '请至少输入一个模型并选择默认模型';
                errorMsg.classList.add('show');
            }
            return;
        }

        if (!options.includes(defaultModel)) {
            options.push(defaultModel);
        }

        try {
            const response = await fetch(`${this.apiBaseURL}/admin/openrouter-config`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    apiKey,
                    modelOptions: options,
                    defaultModel
                })
            });

            const data = await response.json();
            if (data.success) {
                alert('✅ OpenRouter 设置已保存！');
                await this.loadOpenrouterSettings();
            } else if (errorMsg) {
                errorMsg.textContent = data.message || '保存 OpenRouter 设置失败';
                errorMsg.classList.add('show');
            }
        } catch (error) {
            console.error('保存 OpenRouter 设置失败:', error);
            if (errorMsg) {
                errorMsg.textContent = '保存失败，请稍后重试';
                errorMsg.classList.add('show');
            }
        }
    }

    async checkQuota() {
        const quotaDisplay = document.getElementById('quotaDisplay');
        quotaDisplay.innerHTML = '<div class="loading">检查中...</div>';
        const preferredService = (localStorage.getItem('preferredAiService') || 'gemini').toLowerCase();
        const serviceLabelMap = {
            gemini: 'Gemini',
            deepseek: 'DeepSeek',
            openrouter: 'OpenRouter'
        };
        const fallbackServiceLabel = serviceLabelMap[preferredService] || 'Gemini';

        const buildUsageItem = (label, used = 0, limit, unit = '次') => {
            const safeUsed = typeof used === 'number' ? used : 0;
            const hasLimit = typeof limit === 'number' && limit > 0;
            const percentage = hasLimit ? Math.min(100, (safeUsed / limit) * 100) : 0;
            const dangerClass = hasLimit && safeUsed >= limit ? 'danger' : '';
            const text = hasLimit
                ? `${safeUsed.toLocaleString()} / ${limit.toLocaleString()}`
                : `${safeUsed.toLocaleString()} ${unit}`;

            return `
                <div class="usage-item ${dangerClass}">
                    <div class="usage-label">${label}</div>
                    ${hasLimit ? `
                    <div class="usage-bar-container">
                        <div class="usage-bar" style="width: ${percentage}%"></div>
                    </div>` : ''}
                    <div class="usage-text">${text}</div>
                </div>
            `;
        };

        const buildTokenItem = (label, used = 0, limit) => {
            const safeUsed = typeof used === 'number' ? used : 0;
            const hasLimit = typeof limit === 'number' && limit > 0;
            const percentage = hasLimit ? Math.min(100, (safeUsed / limit) * 100) : 0;
            const text = hasLimit
                ? `${safeUsed.toLocaleString()} / ${limit.toLocaleString()} tokens`
                : `${safeUsed.toLocaleString()} tokens`;

            return `
                <div class="usage-item ${hasLimit && safeUsed >= limit ? 'danger' : ''}">
                    <div class="usage-label">${label}</div>
                    ${hasLimit ? `
                    <div class="usage-bar-container">
                        <div class="usage-bar" style="width: ${percentage}%"></div>
                    </div>` : ''}
                    <div class="usage-text">${text}</div>
                </div>
            `;
        };

        try {
            const response = await fetch(`${this.apiBaseURL}/admin/api-quota?service=${preferredService}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();
            const serviceLabel = data.serviceLabel || fallbackServiceLabel;
            
            if (data.success) {
                let statusClass = 'success';
                if (data.status === 'rate_limited') {
                    statusClass = 'warning';
                } else if (data.status === 'invalid' || data.status === 'forbidden') {
                    statusClass = 'danger';
                }

                let html = `
                    <div class="quota-item">
                        <span class="quota-label">AI 服务</span>
                        <span class="quota-value">${serviceLabel}</span>
                    </div>
                    <div class="quota-item">
                        <span class="quota-label">API 状态</span>
                        <span class="quota-value ${statusClass}">${data.info?.status || data.message || '未知'}</span>
                    </div>
                `;

                if (data.modelName) {
                    html += `
                    <div class="quota-item">
                        <span class="quota-label">模型</span>
                        <span class="quota-value">${data.displayName || data.modelName}</span>
                    </div>
                    `;
                }

                if (data.info?.type) {
                    html += `
                    <div class="quota-item">
                        <span class="quota-label">计划类型</span>
                        <span class="quota-value">${data.info.type}</span>
                    </div>
                    `;
                }

                const usage = data.usage || {};
                const todayStats = usage.today || {};
                const minuteStats = usage.currentMinute || {};

                if (usage.today) {
                    html += `
                    <div class="quota-section">
                        <div class="quota-section-title">📊 今日使用情况 (${serviceLabel})</div>
                        <div class="usage-stats">
                            ${buildUsageItem('请求次数', todayStats.requests, todayStats.requestLimit)}
                            ${typeof todayStats.tokens === 'number' ? buildTokenItem('Token 使用', todayStats.tokens, todayStats.tokenLimit) : ''}
                        </div>
                    </div>
                    `;
                }

                if (usage.currentMinute) {
                    html += `
                    <div class="quota-section">
                        <div class="quota-section-title">⚡ 当前分钟使用情况</div>
                        <div class="usage-stats">
                            ${buildUsageItem('请求次数', minuteStats.requests, minuteStats.requestLimit)}
                            ${typeof minuteStats.tokens === 'number' ? buildTokenItem('Token 使用', minuteStats.tokens, minuteStats.tokenLimit) : ''}
                        </div>
                    </div>
                    `;
                }

                if (data.info?.limits) {
                    const limits = data.info.limits;
                    html += `
                    <div class="quota-section">
                        <div class="quota-section-title">📏 API 限制</div>
                        <div class="quota-limits">
                            <div class="quota-limit-item">
                                <span class="limit-label">每分钟请求数</span>
                                <span class="limit-value">${limits.rpm}</span>
                            </div>
                            <div class="quota-limit-item">
                                <span class="limit-label">每分钟 Token 数</span>
                                <span class="limit-value">${limits.tpm}</span>
                            </div>
                            <div class="quota-limit-item">
                                <span class="limit-label">每天请求数</span>
                                <span class="limit-value">${limits.rpd}</span>
                            </div>
                        </div>
                        <div class="quota-note">${limits.note}</div>
                    </div>
                    `;
                }

                if (data.info?.features) {
                    html += `
                    <div class="quota-section">
                        <div class="quota-section-title">✨ 支持功能</div>
                        <div class="quota-features">
                            ${data.info.features.map(f => `<div class="feature-item">${f}</div>`).join('')}
                        </div>
                    </div>
                    `;
                }

                if (Array.isArray(data.models) && data.models.length > 0) {
                    const previewModels = data.models.slice(0, 6);
                    html += `
                    <div class="quota-section">
                        <div class="quota-section-title">🧠 可用模型</div>
                        <div class="quota-features">
                            ${previewModels.map(model => `<div class="feature-item">${model.name || model.id}</div>`).join('')}
                        </div>
                    </div>
                    `;
                }
                
                const now = new Date();
                html += `
                    <div class="quota-update-time">
                        上次更新: ${now.toLocaleTimeString('zh-CN')} (每30秒自动刷新)
                    </div>
                `;

                quotaDisplay.innerHTML = html;
            } else {
                const statusClass = data.status === 'invalid' ? 'danger' : 'warning';
                quotaDisplay.innerHTML = `
                    <div class="quota-item">
                        <span class="quota-label">AI 服务</span>
                        <span class="quota-value">${serviceLabel}</span>
                    </div>
                    <div class="quota-item">
                        <span class="quota-label">状态</span>
                        <span class="quota-value ${statusClass}">${data.info?.status || '错误'}</span>
                    </div>
                    <div class="quota-item">
                        <span class="quota-label">类型</span>
                        <span class="quota-value">${data.info?.type || 'N/A'}</span>
                    </div>
                    <div class="error-note" style="margin-top: 10px; color: var(--danger-color);">
                        ${data.message || '无法获取配额信息'}
                    </div>
                    ${data.info?.note ? `<div class="quota-note">${data.info.note}</div>` : ''}
                `;
            }
        } catch (error) {
            console.error('检查配额失败:', error);
            quotaDisplay.innerHTML = `
                <div class="quota-item">
                    <span class="quota-label">AI 服务</span>
                    <span class="quota-value">${fallbackServiceLabel}</span>
                </div>
                <div class="quota-item">
                    <span class="quota-label">状态</span>
                    <span class="quota-value danger">检查失败</span>
                </div>
                <div class="error-note" style="margin-top: 10px; color: var(--danger-color);">
                    无法连接到服务器，请检查网络连接
                </div>
            `;
        }
    }
}

// 初始化应用
const app = new AdminApp();
