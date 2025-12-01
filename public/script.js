// 前端应用 - 与后端API交互 + Gemini AI集成

class TodoApp {
    constructor() {
        // 使用相对路径，支持开发隧道（ngrok、VS Code 隧道等）
        this.apiBaseURL = '/api';
        this.pythonBaseURL = '/api';  // Python后端（通过代理）
        this.token = this.getToken();
        this.userId = this.getUserId();  // 从localStorage获取用户ID
        this.todos = [];
        // API Key 将从后端自动获取
        this.geminiApiKey = '';
        this.chatModel = null;
        this.chatSession = null;
        this.sessionId = 'user_' + Date.now();  // 为每个会话创建唯一ID
    this.permissionCountdownTimer = null;
    this.currentPermission = null;
        this.init();
    }

    init() {
        this.cacheDOMElements();
        this.attachEventListeners();
        
        if (this.token) {
            this.showAppPage();
            
            // ✅ 关键修复：页面刷新时从 localStorage 恢复用户名和用户ID
            const savedUsername = this.getUsername();
            if (savedUsername) {
                this.setCurrentUser(savedUsername);
            }
            
            const savedUserId = this.getUserId();
            if (savedUserId) {
                this.userId = savedUserId;
            }
            
            this.loadTodos();
            this.initAIChat();
            this.loadPermissionInfo();  // 加载权限信息
            // 每60秒更新一次权限信息
            setInterval(() => this.loadPermissionInfo(), 60000);
        } else {
            this.showLoginPage();
        }
    }

    cacheDOMElements() {
        // 登录页面
        this.loginPage = document.getElementById('loginPage');
        this.appPage = document.getElementById('appPage');
        this.loginForm = document.getElementById('loginForm');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
        this.loginError = document.getElementById('loginError');

        // 应用页面
        this.currentUser = document.getElementById('currentUser');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.todoInput = document.getElementById('todoInput');
        this.todoDateTime = document.getElementById('todoDateTime');
        this.addBtn = document.getElementById('addBtn');
        this.todoList = document.getElementById('todoList');
        this.errorMsg = document.getElementById('errorMsg');
        this.successMsg = document.getElementById('successMsg');
        this.totalCount = document.getElementById('totalCount');
        this.pendingCount = document.getElementById('pendingCount');

        // AI聊天相关
        this.apiKeyPanel = document.getElementById('apiKeyPanel');
        this.chatArea = document.getElementById('chatArea');
        this.geminiApiKeyInput = document.getElementById('geminiApiKey');
        this.saveApiKeyBtn = document.getElementById('saveApiKeyBtn');
        this.apiKeyError = document.getElementById('apiKeyError');
        this.aiStatus = document.getElementById('aiStatus');
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.chatError = document.getElementById('chatError');

        // AI权限信息相关
        this.aiPermissionInfo = document.getElementById('aiPermissionInfo');
        this.permissionType = document.getElementById('permissionType');
        this.permissionDays = document.getElementById('permissionDays');

        // 移动端导航
        this.mobileNavItems = document.querySelectorAll('.nav-item');
        this.viewPanels = document.querySelectorAll('.view-panel');

        // 移动端添加待办
        this.mobileAddBtn = document.getElementById('mobileAddBtn');
        this.mobileAddModal = document.getElementById('mobileAddModal');
        this.closeMobileModal = document.getElementById('closeMobileModal');
        this.mobileTodoInput = document.getElementById('mobileTodoInput');
        this.mobileTodoDateTime = document.getElementById('mobileTodoDateTime');
        this.mobileConfirmAdd = document.getElementById('mobileConfirmAdd');
        this.mobileErrorMsg = document.getElementById('mobileErrorMsg');
    }

    attachEventListeners() {
        // 登录相关
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.logoutBtn.addEventListener('click', () => this.logout());
        
        // 移动端导航切换
        this.mobileNavItems.forEach(item => {
            item.addEventListener('click', () => this.switchView(item.dataset.view));
        });

        // 移动端添加待办
        if (this.mobileAddBtn) {
            this.mobileAddBtn.addEventListener('click', () => this.openMobileAddModal());
        }
        if (this.closeMobileModal) {
            this.closeMobileModal.addEventListener('click', () => this.closeMobileAddModal());
        }
        if (this.mobileConfirmAdd) {
            this.mobileConfirmAdd.addEventListener('click', () => this.handleMobileAdd());
        }
        if (this.mobileAddModal) {
            this.mobileAddModal.addEventListener('click', (e) => {
                if (e.target === this.mobileAddModal) {
                    this.closeMobileAddModal();
                }
            });
        }
        if (this.mobileTodoInput) {
            this.mobileTodoInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    this.handleMobileAdd();
                }
            });
        }
        
        // 管理员按钮
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                window.location.href = '/admin.html';
            });
        }
        
        // 待办事项相关
        this.addBtn.addEventListener('click', () => this.addTodo());
        this.todoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTodo();
        });

        // AI聊天相关
        this.saveApiKeyBtn.addEventListener('click', () => this.saveAndInitGemini());
        this.sendBtn.addEventListener('click', () => this.sendChatMessage());
        
        // Enter发送，Shift+Enter换行
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        
        // 自动调整textarea高度
        this.chatInput.addEventListener('input', () => {
            this.autoResizeTextarea(this.chatInput);
        });
    }
    
    // 自动调整textarea高度
    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }

    // ========== 认证相关 ==========
    
    async handleLogin(e) {
        e.preventDefault();
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;

        if (!username || !password) {
            this.showLoginError('用户名和密码不能为空');
            return;
        }

        this.addBtn.disabled = true;
        this.addBtn.textContent = '登录中...';

        try {
            const response = await fetch(`${this.apiBaseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!data.success) {
                this.showLoginError(data.message || '登录失败');
                this.addBtn.disabled = false;
                this.addBtn.textContent = '登录';
                return;
            }

            // 保存令牌和用户名
            this.saveToken(data.token);
            this.saveUsername(username);  // ✅ 新增：保存用户名
            this.saveUserId(data.user.id);  // ✅ 保存用户ID用于API使用记录
            this.token = data.token;
            this.userId = data.user.id;

            // 切换到应用页面
            this.showAppPage();
            this.setCurrentUser(username);
            this.clearLoginForm();
            this.loadTodos();
            
            // ✅ 关键修复：登录后立即加载权限信息
            await this.loadPermissionInfo();
            
            // ✅ 关键修复：登录后立即初始化AI助手
            await this.initAIChat();
            
            this.addBtn.disabled = false;
            this.addBtn.textContent = '+ 添加';
        } catch (error) {
            this.showLoginError('登录失败，请稍后重试');
            this.addBtn.disabled = false;
            this.addBtn.textContent = '登录';
        }
    }

    logout() {
        if (confirm('确定要退出登录吗？')) {
            this.removeToken();
            this.removeUsername();  // ✅ 新增：登出时也移除用户名
            this.removeUserId();  // ✅ 新增：登出时也移除用户ID
            this.token = null;
            this.userId = null;
            this.todos = [];
            this.stopPermissionCountdown();
            
            // 清除权限信息
            this.currentPermission = null;
            const permissionInfo = document.getElementById('permissionInfo');
            const permissionDays = document.getElementById('permissionDays');
            if (permissionInfo) {
                permissionInfo.style.display = 'none';
            }
            if (permissionDays) {
                permissionDays.textContent = '';
            }
            
            // 隐藏管理员按钮
            const adminBtn = document.getElementById('adminBtn');
            if (adminBtn) {
                adminBtn.style.display = 'none';
            }
            
            this.showLoginPage();
            this.clearLoginForm();
            this.clearChatSession();
        }
    }

    saveToken(token) {
        localStorage.setItem('todolistToken', token);
    }

    getToken() {
        return localStorage.getItem('todolistToken');
    }

    removeToken() {
        localStorage.removeItem('todolistToken');
    }

    // ✅ 新增：保存用户名到 localStorage
    saveUsername(username) {
        localStorage.setItem('todolistUsername', username);
    }

    // ✅ 新增：从 localStorage 获取用户名
    getUsername() {
        return localStorage.getItem('todolistUsername');
    }

    // ✅ 新增：移除保存的用户名
    removeUsername() {
        localStorage.removeItem('todolistUsername');
    }

    // ✅ 新增：保存用户ID到 localStorage（用于API使用记录）
    saveUserId(userId) {
        localStorage.setItem('todolistUserId', userId);
    }

    // ✅ 新增：从 localStorage 获取用户ID
    getUserId() {
        const id = localStorage.getItem('todolistUserId');
        return id ? parseInt(id) : null;
    }

    // ✅ 新增：移除保存的用户ID
    removeUserId() {
        localStorage.removeItem('todolistUserId');
    }

    // ========== Gemini AI 集成 ==========

    saveGeminiApiKey(key) {
        localStorage.setItem('geminiApiKey', key);
    }

    getGeminiApiKey() {
        return localStorage.getItem('geminiApiKey') || '';
    }

    // 返回管理员偏好的AI服务类型：'gemini' 或 'deepseek'
    getPreferredAiService() {
        return localStorage.getItem('preferredAiService') || 'gemini';
    }

    // 从管理员本地存储读取对应服务的API Key（优先使用admin存储的key）
    getAdminApiKey(service) {
        if (service === 'deepseek') {
            return localStorage.getItem('adminDeepseekApiKey') || '';
        }
        // 默认返回 Gemini 管理员key或普通 geminiApiKey
        return localStorage.getItem('adminGeminiApiKey') || this.getGeminiApiKey();
    }

    removeGeminiApiKey() {
        localStorage.removeItem('geminiApiKey');
    }

    clearChatSession() {
        this.chatSession = null;
        // ✅ API Key 已硬编码，不再清空
        this.chatArea.style.display = 'none';
        this.updateAIStatus('未连接', false);
        this.clearChatMessages();
    }

    async initAIChat() {
        // 如果用户未登录或没有 userId，则不初始化 AI（避免匿名请求）
        if (!this.token || !this.userId) {
            console.warn('⚠️ initAIChat 已跳过：用户未登录或 userId 缺失');
            return false;
        }
        // 根据管理员偏好选择服务（gemini 或 deepseek）
        const preferred = this.getPreferredAiService();
        this.preferredAiService = preferred;

        // 优先使用管理员在 admin 面板保存的 key
        const adminKey = this.getAdminApiKey(preferred);

        if (preferred === 'deepseek') {
            // DeepSeek 不需要额外的init端点；只要有API Key即可使用
            if (!adminKey) {
                this.chatSession = false;
                this.apiKeyPanel.style.display = 'none';
                this.chatArea.style.display = 'flex';
                this.updateAIStatus('未配置 (DeepSeek)', false);
                this.showSystemMessage('⚠️ DeepSeek API Key 未配置，请在管理员面板配置 DeepSeek API Key。');
                return false;
            }

            this.deepseekApiKey = adminKey;
            this.chatSession = true;
            this.apiKeyPanel.style.display = 'none';
            this.chatArea.style.display = 'flex';
            this.updateAIStatus('已连接 (DeepSeek)', true);
            await this.initChatHistory();
            return true;
        }

        // 默认使用 Gemini
        this.geminiApiKey = adminKey || this.getGeminiApiKey();
        if (!this.geminiApiKey) {
            this.chatSession = false;
            this.apiKeyPanel.style.display = 'none';
            this.chatArea.style.display = 'flex';
            this.updateAIStatus('未配置 (Gemini)', false);
            this.showSystemMessage('⚠️ Gemini API Key 未配置，请联系管理员配置 GEMINI_API_KEY。');
            return false;
        }

        try {
            console.log('🤖 正在连接 Gemini 后端...');
            const response = await fetch(`${this.pythonBaseURL}/gemini/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ api_key: this.geminiApiKey })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const data = await response.json();
            if (data.success) {
                this.chatSession = true;
                this.apiKeyPanel.style.display = 'none';
                this.chatArea.style.display = 'flex';
                this.updateAIStatus('已连接 (Gemini)', true);
                await this.initChatHistory();
                return true;
            }
            throw new Error(data.error || data.message || '初始化失败');
        } catch (error) {
            console.error('❌ AI 后端连接失败:', error);
            this.chatSession = false;
            this.apiKeyPanel.style.display = 'none';
            this.chatArea.style.display = 'flex';
            this.updateAIStatus('连接失败', false);
            this.showSystemMessage(`⚠️ AI 后端连接失败: ${error.message}\n\n请确保 Python 后端已启动并运行在 5000 端口。`);
            return false;
        }
    }

    // ✅ 注意：API Key 已硬编码，此函数保留供需要时使用
    async saveAndInitGemini() {
        // 保存当前页面输入的 gemini key（仅当页面允许修改时），然后根据管理员偏好初始化
        console.log('🔄 正在初始化 AI 聊天...');
        // 如果页面上有 gemini 输入框，则保存其值到 localStorage（兼容旧版本）
        try {
            const input = document.getElementById('geminiApiKey');
            if (input && input.value) {
                this.saveGeminiApiKey(input.value.trim());
            }
        } catch (e) {
            // ignore
        }
        await this.initAIChat();
    }

    updateAIStatus(status, isConnected) {
        this.aiStatus.textContent = status;
        if (isConnected) {
            this.aiStatus.classList.add('connected');
        } else {
            this.aiStatus.classList.remove('connected');
        }
    }

    // ========== 权限信息相关 ==========

    async loadPermissionInfo() {
        try {
            const response = await fetch(`${this.apiBaseURL}/permissions/info`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                // API 返回 { success: true, permission: {...} } 格式
                if (data.success && data.permission) {
                    this.updatePermissionDisplay(data.permission);
                } else {
                    console.warn('权限信息格式错误:', data);
                }
            } else if (response.status === 401) {
                // Token已过期，需要重新登录
                this.logout();
            }
        } catch (error) {
            console.error('获取权限信息失败:', error);
        }
    }

    updatePermissionDisplay(permissionData) {
        this.currentPermission = permissionData || null;
        this.stopPermissionCountdown();

        if (!permissionData || !permissionData.type) {
            // 如果没有权限信息，隐藏权限显示
            this.aiPermissionInfo.style.display = 'none';
            return;
        }

        const permType = permissionData.type;
        const status = permissionData.status || 'active';

        // 显示权限信息面板
        this.aiPermissionInfo.style.display = 'block';

        // 设置权限类型文字
        let permTypeText = '';
        let typeClass = '';
        if (permType === 'UNLIMITED') {
            permTypeText = '权限: 无限制 ♾️';
            typeClass = 'unlimited';
        } else {
            permTypeText = status === 'expired' ? '权限: 有限期 (已过期)' : '权限: 有限期';
            typeClass = status === 'expired' ? 'expired' : 'limited';
        }
        this.permissionType.textContent = permTypeText;
        this.permissionType.className = `perm-type ${typeClass}`;

        if (status === 'expired') {
            this.permissionDays.textContent = '剩余: 已过期 ⏰';
            this.permissionDays.className = 'perm-days expired';
            return;
        }

        if (permType === 'UNLIMITED') {
            this.permissionDays.textContent = '剩余: 无限';
            this.permissionDays.className = 'perm-days unlimited';
            return;
        }

        // LIMITED 权限处理
        if (permissionData.expiresAt) {
            this.updatePermissionCountdown();
            this.permissionCountdownTimer = setInterval(() => this.updatePermissionCountdown(), 1000);
        } else {
            const days = Math.max(0, permissionData.daysRemaining || 0);
            this.permissionDays.textContent = `剩余: ${days} 天`;
            this.permissionDays.className = `perm-days ${days <= 7 ? 'expired' : 'limited'}`;
        }
    }

    stopPermissionCountdown() {
        if (this.permissionCountdownTimer) {
            clearInterval(this.permissionCountdownTimer);
            this.permissionCountdownTimer = null;
        }
    }

    updatePermissionCountdown() {
        if (!this.currentPermission || !this.currentPermission.expiresAt) {
            return;
        }

        const expiresAt = new Date(this.currentPermission.expiresAt).getTime();
        if (Number.isNaN(expiresAt)) {
            return;
        }

        const diff = expiresAt - Date.now();
        if (diff <= 0) {
            this.stopPermissionCountdown();
            this.permissionType.textContent = '权限: 有限期 (已过期)';
            this.permissionType.className = 'perm-type expired';
            this.permissionDays.textContent = '剩余: 已过期 ⏰';
            this.permissionDays.className = 'perm-days expired';
            return;
        }

        const formatted = this.formatDuration(diff);
        this.permissionDays.textContent = `剩余: ${formatted}`;
        this.permissionDays.className = 'perm-days limited';
    }

    showApiKeyError(message) {
        this.apiKeyError.textContent = message;
        this.apiKeyError.classList.add('show');
    }

    clearApiKeyError() {
        this.apiKeyError.classList.remove('show');
        this.apiKeyError.textContent = '';
    }

    showChatError(message) {
        this.chatError.textContent = message;
        this.chatError.classList.add('show');
        setTimeout(() => {
            this.chatError.classList.remove('show');
            this.chatError.textContent = '';
        }, 3000);
    }

    async sendChatMessage() {
        // ✅ 强制检查：用户必须登录后才能使用AI助手
        if (!this.token) {
            this.showChatError('❌ 请先登录后再使用AI助手');
            this.showLoginPage();
            return;
        }
        // 额外检查：如果 userId 缺失，尝试通过 token 同步恢复（避免匿名请求）
        if (!this.userId && this.token) {
            try {
                console.log('🔄 未检测到 userId，尝试通过 token 恢复...');
                const verifyResp = await fetch(`${this.apiBaseURL}/auth/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: this.token })
                });
                if (verifyResp.ok) {
                    const verifyData = await verifyResp.json();
                    if (verifyData.success && verifyData.user && verifyData.user.id) {
                        this.userId = verifyData.user.id;
                        this.saveUserId(this.userId);
                        console.log('✅ 通过 token 恢复到 userId:', this.userId);
                    } else {
                        console.warn('⚠️ token 恢复未返回用户信息', verifyData);
                    }
                } else {
                    console.warn('⚠️ token 恢复请求失败', verifyResp.status);
                }
            } catch (e) {
                console.warn('⚠️ 通过 token 恢复 userId 时出错:', e);
            }
        }

        // 如果仍然没有 userId，则阻止发送以避免匿名请求
        if (!this.userId) {
            this.showChatError('❌ 请先登录（或刷新页面）以获取用户信息');
            this.showLoginPage();
            return;
        }
        
        if (!this.chatSession) {
            this.showChatError('AI 助手未连接，请先配置 API Key');
            return;
        }

        const message = this.chatInput.value.trim();

        if (!message) {
            return;
        }

        await this.ensureChatSession();

        // 禁用输入
        this.chatInput.disabled = true;
        this.sendBtn.disabled = true;
        this.sendBtn.textContent = '发送中...';

        try {
            // 添加用户消息到聊天
            this.addChatMessage('user', message, false, new Date().toISOString());
            
            // 显示加载指示器
            this.showTypingIndicator();

            // 构建待办事项上下文 - 发送到Python后端
            const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时区';
            let todoContext = '用户当前没有待办事项。';
            if (this.todos.length > 0) {
                const sortedTodos = this.getSortedTodos();
                const snapshotLines = sortedTodos.map((todo, index) =>
                    this.buildAiTodoSnapshotLine(todo, index, timezoneName)
                );
                todoContext = [
                    `【待办事项快照｜生成时间: ${new Date().toISOString()}｜用户时区: ${timezoneName} (${TimeUtils.getTimezoneString()})】`,
                    ...snapshotLines
                ].join('\n');
            }

            // 调用Python后端的聊天API
            console.log('📡 发送消息到 AI 后端...');
            const preferred = this.getPreferredAiService();
            console.log('📍 偏好服务:', preferred, ' 发送user_id:', this.userId);

            // 添加当前时间信息 - 帮助AI进行时间判断（显示用户本地时区）
            const currentTimeInfo = `[当前客户端时间: ${TimeUtils.formatDateTime(TimeUtils.toUTC())}]`;

            let endpoint = `${this.pythonBaseURL}/gemini/chat`;
            let apiKeyToSend = this.geminiApiKey;
            if (preferred === 'deepseek') {
                endpoint = `${this.pythonBaseURL}/deepseek/chat`;
                apiKeyToSend = this.getAdminApiKey('deepseek') || this.deepseekApiKey || '';
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `${currentTimeInfo} ${message}`,
                    session_id: this.sessionId,
                    api_key: apiKeyToSend,
                    todo_context: todoContext,
                    user_id: this.userId, // 添加user_id用于记录API使用
                    timezone: timezoneName // 新增：发送用户时区
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

                const data = await response.json();
            
            // 移除加载指示器
            this.removeTypingIndicator();

            if (data.success) {
                const aiResponse = data.message;
                
                // ✅ 检查AI响应中的待办事项操作命令
                const commandResults = await this.executeGeminiCommands(aiResponse);
                
                // ✅ 过滤掉命令行，只显示普通文本给用户
                let cleanMessage = this.filterCommandLines(aiResponse);
                
                // 如果有命令执行结果，将其展示给用户
                let displayMessage = cleanMessage;
                if (commandResults.length > 0) {
                    displayMessage += '\n\n📝 **系统执行记录：**\n' + commandResults.join('\n');
                }
                
                // 💾 保存用户消息到数据库
                await this.saveChatMessage('user', message);
                
                // 💾 保存 AI 回复到数据库（保存不包含命令执行结果的原始回复）
                await this.saveChatMessage('assistant', cleanMessage);
                
                // 添加助手回复（会自动流式显示）
                this.addChatMessage('assistant', displayMessage, true, new Date().toISOString());
                // 清空输入并重置高度
                this.chatInput.value = '';
                this.chatInput.style.height = 'auto';
                this.chatInput.focus();
            } else {
                // 删除最后添加的用户消息（因为发送失败了）
                const lastMessage = this.chatMessages.lastElementChild;
                if (lastMessage && lastMessage.className.includes('user')) {
                    lastMessage.remove();
                }
                
                this.showChatError('❌ ' + (data.error || '发送消息失败'));
            }
        } catch (error) {
            console.error('❌ 发送消息失败:', error);
            console.error('📌 详细信息:', error.message);
            
            // 移除加载指示器
            this.removeTypingIndicator();
            
            // 删除最后添加的用户消息（因为发送失败了）
            const lastMessage = this.chatMessages.lastElementChild;
            if (lastMessage && lastMessage.className.includes('user')) {
                lastMessage.remove();
            }
            
            // 显示详细的错误信息
            let errorMsg = '❌ 发送消息失败';
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMsg = '❌ 无法连接到 AI 后端\n\n请确保 Python 后端已启动（端口 5000）\n或检查网络连接。';
            } else if (error.message.includes('503')) {
                errorMsg = '❌ AI 后端服务不可用\n\nPython 后端可能未启动。\n请运行: cd backend && python main.py';
            } else if (error.message.includes('UNAUTHENTICATED')) {
                errorMsg = '❌ API Key 无效\n\n请检查 backend/.env 中的 GEMINI_API_KEY';
            } else if (error.message.includes('RESOURCE_EXHAUSTED')) {
                errorMsg = '❌ API 配额已用尽\n\n请稍后重试或检查 Gemini API 配额';
            } else if (error.message.includes('HTTP')) {
                errorMsg = `❌ 服务器错误: ${error.message}`;
            } else {
                errorMsg = `❌ 发送失败: ${error.message}`;
            }
            
            this.showChatError(errorMsg);
        } finally {
            this.chatInput.disabled = false;
            this.sendBtn.disabled = false;
            this.sendBtn.textContent = '发送';
        }
    }

    // 显示加载指示器
    showTypingIndicator() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chat-message assistant typing-loading';
        messageDiv.id = 'typing-indicator';

        const metaRow = document.createElement('div');
        metaRow.className = 'message-meta';
        const authorSpan = document.createElement('span');
        authorSpan.className = 'message-author assistant';
        authorSpan.textContent = this.getChatDisplayName('assistant');
        metaRow.appendChild(authorSpan);
    const statusSpan = document.createElement('span');
    statusSpan.className = 'message-time';
    statusSpan.textContent = '· 正在输入…';
        metaRow.appendChild(statusSpan);
        messageDiv.appendChild(metaRow);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content';
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
        contentWrapper.appendChild(indicator);
        messageDiv.appendChild(contentWrapper);

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    // 移除加载指示器
    removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    // 💾 保存聊天消息到数据库
    async saveChatMessage(role, message) {
        try {
            console.log(`📤 尝试保存 ${role} 消息...`, {
                sessionId: this.sessionId,
                messageLength: message.length,
                hasToken: !!this.token
            });
            
            const response = await fetch(`${this.apiBaseURL}/chat/message`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    role: role,
                    message: message
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ ${role === 'user' ? '用户' : 'AI'} 消息已保存到数据库`, data);
                return data;
            } else if (response.status === 401) {
                console.warn('⚠️ Token 已过期，需要重新登录');
                this.logout();
            } else if (response.status === 404) {
                console.error(`❌ 保存 ${role} 消息失败: 会话不存在`, {
                    sessionId: this.sessionId,
                    status: response.status
                });
                const errorData = await response.json().catch(() => ({}));
                console.error('错误详情:', errorData);
                
                // 会话不存在，清除本地缓存并重新创建
                console.log('🔄 会话已失效，正在重新创建...');
                const usernameKey = this.getUsername() || 'anonymous';
                localStorage.removeItem('todolistChatSession_' + usernameKey);
                this.sessionId = null;
                await this.ensureChatSession();
                
                // 重试保存
                if (this.sessionId) {
                    console.log('🔄 使用新会话重试保存消息...');
                    return await this.saveChatMessage(role, message);
                }
            } else {
                console.error(`❌ 保存 ${role} 消息失败: ${response.status}`);
                const errorData = await response.json().catch(() => ({}));
                console.error('错误详情:', errorData);
            }
        } catch (error) {
            console.error(`❌ 保存 ${role} 消息时出错:`, error);
        }
    }

    // 📚 加载聊天历史记录
    async loadChatHistory() {
        try {
            console.log('📚 加载聊天历史...');
            const response = await fetch(`${this.apiBaseURL}/chat/history/${this.sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.success && data.messages && data.messages.length > 0) {
                    console.log(`✅ 加载了 ${data.messages.length} 条聊天记录`);
                    
                    // 清空现有消息（除了欢迎消息）
                    const existingMessages = this.chatMessages.querySelectorAll('.chat-message');
                    existingMessages.forEach((msg, index) => {
                        // 保留第一条欢迎消息
                        if (index > 0) {
                            msg.remove();
                        }
                    });
                    
                    // 添加历史消息
                    data.messages.forEach(msg => {
                        this.addChatMessage(msg.role, msg.message, false, msg.created_at);
                    });
                    
                    // 滚动到底部
                    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                } else {
                    console.log('📭 没有找到聊天历史');
                }
            } else if (response.status === 404) {
                console.log('📭 这是第一次聊天，没有历史记录');
            } else if (response.status === 401) {
                console.warn('⚠️ Token 已过期');
                this.logout();
            } else {
                console.warn('⚠️ 加载聊天历史失败:', response.status);
            }
        } catch (error) {
            console.error('❌ 加载聊天历史时出错:', error);
        }
    }

    // 确保存在一个会话：获取最近会话或创建新会话
    async ensureChatSession() {
        try {
            if (!this.token) {
                console.warn('⚠️ 无法确保会话: 没有 token');
                return;
            }

            const usernameKey = this.getUsername() || 'anonymous';
            console.log(`🔍 确保用户 ${usernameKey} 的聊天会话...`);

            // 优先从 localStorage 获取已保存的会话ID（按用户）
            const savedSession = localStorage.getItem('todolistChatSession_' + usernameKey);
            if (savedSession) {
                console.log(`💾 找到本地保存的会话 ID: ${savedSession}，验证中...`);
                
                // 验证会话是否仍然存在
                const verifyResp = await fetch(`${this.apiBaseURL}/chat/sessions`, {
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
                
                if (verifyResp.ok) {
                    const data = await verifyResp.json();
                    const sessionExists = data.success && data.sessions && 
                        data.sessions.some(s => s.session_id === savedSession);
                    
                    if (sessionExists) {
                        this.sessionId = savedSession;
                        console.log(`✅ 会话验证成功，使用会话 ID: ${savedSession}`);
                        // 确保 userId 已初始化（如果未初始化则通过令牌向后端验证获取用户ID）
                        if (!this.userId && this.token) {
                            try {
                                const verifyResp2 = await fetch(`${this.apiBaseURL}/auth/verify`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ token: this.token })
                                });
                                if (verifyResp2.ok) {
                                    const verifyData = await verifyResp2.json();
                                    if (verifyData.success && verifyData.user && verifyData.user.id) {
                                        this.userId = verifyData.user.id;
                                        this.saveUserId(this.userId);
                                        console.log('✅ 通过令牌恢复 userId:', this.userId);
                                    }
                                }
                            } catch (e) {
                                console.warn('⚠️ 恢复 userId 失败:', e);
                            }
                        }
                        return;
                    } else {
                        console.warn('⚠️ 本地会话已失效，清除缓存');
                        localStorage.removeItem('todolistChatSession_' + usernameKey);
                    }
                }
            }

            // 获取用户的会话列表
            console.log('📡 从服务器获取会话列表...');
            const resp = await fetch(`${this.apiBaseURL}/chat/sessions`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (resp.ok) {
                const data = await resp.json();
                if (data.success && data.sessions && data.sessions.length > 0) {
                    // 使用最近的会话
                    this.sessionId = data.sessions[0].session_id;
                    localStorage.setItem('todolistChatSession_' + usernameKey, this.sessionId);
                    console.log(`✅ 使用现有会话 ID: ${this.sessionId}`);
                    // 如果 userId 为空，尝试通过令牌恢复
                    if (!this.userId && this.token) {
                        try {
                            const verifyResp3 = await fetch(`${this.apiBaseURL}/auth/verify`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ token: this.token })
                            });
                            if (verifyResp3.ok) {
                                const verifyData = await verifyResp3.json();
                                if (verifyData.success && verifyData.user && verifyData.user.id) {
                                    this.userId = verifyData.user.id;
                                    this.saveUserId(this.userId);
                                    console.log('✅ 通过令牌恢复 userId:', this.userId);
                                }
                            }
                        } catch (e) {
                            console.warn('⚠️ 恢复 userId 失败:', e);
                        }
                    }
                    return;
                }
            }

            // 如果没有任何会话，则创建一个新的会话ID并向后端注册
            const newSessionId = `${usernameKey}_${Date.now()}`;
            console.log(`🆕 创建新会话 ID: ${newSessionId}`);
            const createResp = await fetch(`${this.apiBaseURL}/chat/session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ sessionId: newSessionId })
            });

            if (createResp.ok) {
                const cd = await createResp.json();
                if (cd.success) {
                    this.sessionId = newSessionId;
                    localStorage.setItem('todolistChatSession_' + usernameKey, this.sessionId);
                    console.log(`✅ 新会话创建成功: ${newSessionId}`);
                    return;
                } else {
                    console.error('❌ 创建会话失败:', cd);
                }
            } else {
                console.error('❌ 创建会话请求失败:', createResp.status);
                const errorData = await createResp.json().catch(() => ({}));
                console.error('错误详情:', errorData);
            }
        } catch (err) {
            console.error('❌ 确保会话失败:', err);
        }
    }

    // 初始化聊天历史：用于登录或刷新后恢复记录
    async initChatHistory() {
        if (!this.token) return;
        await this.ensureChatSession();
        await this.loadChatHistory();
    }

    addChatMessage(type, content, stream = true, timestamp = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;

        const metaRow = document.createElement('div');
        metaRow.className = 'message-meta';

        const authorSpan = document.createElement('span');
        authorSpan.className = `message-author ${type}`;
        authorSpan.textContent = this.getChatDisplayName(type);
        metaRow.appendChild(authorSpan);

        const timeText = this.formatChatTimestamp(timestamp);
        if (timeText) {
            const timeSpan = document.createElement('span');
            timeSpan.className = 'message-time';
            timeSpan.textContent = `· ${timeText}`;
            metaRow.appendChild(timeSpan);
        }

        messageDiv.appendChild(metaRow);

        const contentWrapper = document.createElement('div');
        if (type === 'assistant') {
            contentWrapper.className = 'message-content markdown-content';
        } else {
            contentWrapper.className = 'message-content';
        }

        if (type === 'assistant') {
            messageDiv.appendChild(contentWrapper);
            this.chatMessages.appendChild(messageDiv);

            if (stream) {
                this.streamMessage(contentWrapper, content);
            } else {
                contentWrapper.innerHTML = this.markdownToHtml(content);
            }
        } else if (type === 'system') {
            contentWrapper.innerHTML = content;
            messageDiv.appendChild(contentWrapper);
            this.chatMessages.appendChild(messageDiv);
        } else {
            contentWrapper.textContent = content;
            messageDiv.appendChild(contentWrapper);
            this.chatMessages.appendChild(messageDiv);
        }

        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    // 流式显示消息（逐字输出）
    async streamMessage(container, fullText) {
        let displayedText = '';
        const characters = fullText.split('');
        const displaySpeed = 15; // 毫秒 - 调整为15ms以获得更快的显示效果

        for (let i = 0; i < characters.length; i++) {
            displayedText += characters[i];

            if (i % 8 === 0 || i === characters.length - 1) {
                container.innerHTML = this.markdownToHtml(displayedText);
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
            }

            await new Promise(resolve => setTimeout(resolve, displaySpeed));
        }

        // 最终确保完整解析
        container.innerHTML = this.markdownToHtml(fullText);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    // Markdown 转 HTML（兼容常见格式）
    markdownToHtml(markdown) {
        if (!markdown) {
            return '';
        }

        const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
        const htmlParts = [];
        let inCodeBlock = false;
        let codeBuffer = [];
        let listType = null; // 'ul' 或 'ol'

        const closeCodeBlock = () => {
            if (inCodeBlock) {
                htmlParts.push(`<pre><code>${codeBuffer.map(line => this.escapeHtml(line)).join('\n')}</code></pre>`);
                codeBuffer = [];
                inCodeBlock = false;
            }
        };

        const closeList = () => {
            if (listType === 'ul') {
                htmlParts.push('</ul>');
            } else if (listType === 'ol') {
                htmlParts.push('</ol>');
            }
            listType = null;
        };

        const applyInline = (text) => {
            let safe = this.escapeHtml(text);
            safe = safe.replace(/\[(.+?)\]\((https?:\/\/[^\s]+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
            safe = safe.replace(/`([^`]+)`/g, '<code>$1</code>');
            safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            safe = safe.replace(/__(.*?)__/g, '<strong>$1</strong>');
            safe = safe.replace(/~~(.*?)~~/g, '<del>$1</del>');
            safe = safe.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
            safe = safe.replace(/(?<!_)_(?!_)([^_]+?)(?<!_)_(?!_)/g, '<em>$1</em>');
            return safe;
        };

        for (const rawLine of lines) {
            const line = rawLine.replace(/\r$/, '');
            const trimmed = line.trim();

            if (trimmed.startsWith('```')) {
                if (inCodeBlock) {
                    closeCodeBlock();
                } else {
                    closeList();
                    inCodeBlock = true;
                    codeBuffer = [];
                }
                continue;
            }

            if (inCodeBlock) {
                codeBuffer.push(line);
                continue;
            }

            if (trimmed === '') {
                closeList();
                htmlParts.push('');
                continue;
            }

            const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
            if (headingMatch) {
                closeList();
                const level = headingMatch[1].length;
                htmlParts.push(`<h${level}>${applyInline(headingMatch[2])}</h${level}>`);
                continue;
            }

            if (/^[-*_]{3,}$/.test(trimmed)) {
                closeList();
                htmlParts.push('<hr>');
                continue;
            }

            if (trimmed.startsWith('>')) {
                closeList();
                const quote = trimmed.replace(/^>\s?/, '');
                htmlParts.push(`<blockquote>${applyInline(quote)}</blockquote>`);
                continue;
            }

            const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/);
            if (unorderedMatch) {
                if (listType !== 'ul') {
                    closeList();
                    listType = 'ul';
                    htmlParts.push('<ul>');
                }
                htmlParts.push(`<li>${applyInline(unorderedMatch[1])}</li>`);
                continue;
            }

            const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
            if (orderedMatch) {
                if (listType !== 'ol') {
                    closeList();
                    listType = 'ol';
                    htmlParts.push('<ol>');
                }
                htmlParts.push(`<li>${applyInline(orderedMatch[1])}</li>`);
                continue;
            }

            closeList();
            htmlParts.push(`<p>${applyInline(line)}</p>`);
        }

        closeCodeBlock();
        closeList();

        return htmlParts.filter(Boolean).join('');
    }

    clearChatMessages() {
        this.chatMessages.innerHTML = '';
        this.addChatMessage('system', '👋 Hello! 我是您的 AI 助手，可以帮助您管理待办事项。', false, new Date().toISOString());
    }

    showSystemMessage(message) {
        this.chatMessages.innerHTML = '';
        this.addChatMessage('system', message, false, new Date().toISOString());
    }

    // ========== UI 页面切换 ==========

    switchView(viewName) {
        // 更新导航状态
        this.mobileNavItems.forEach(item => {
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // 更新视图面板
        this.viewPanels.forEach(panel => {
            if (panel.dataset.panel === viewName) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    }

    // ========== 移动端添加待办 ==========

    openMobileAddModal() {
        this.mobileAddModal.classList.add('show');
        this.setMobileDefaultDateTime();
        setTimeout(() => {
            this.mobileTodoInput.focus();
        }, 300);
    }

    closeMobileAddModal() {
        this.mobileAddModal.classList.remove('show');
        this.mobileTodoInput.value = '';
        this.mobileTodoDateTime.value = '';
        this.mobileErrorMsg.classList.remove('show');
        this.mobileErrorMsg.textContent = '';
    }

    setMobileDefaultDateTime() {
        const now = new Date();
        now.setMinutes(now.getMinutes() + 30);
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        this.mobileTodoDateTime.value = `${year}-${month}-${day}T${hours}:${minutes}`;
    }

    async handleMobileAdd() {
        const text = this.mobileTodoInput.value.trim();
        const datetime = this.mobileTodoDateTime.value;

        if (!text) {
            this.showMobileError('请输入待办内容');
            return;
        }

        if (!datetime) {
            this.showMobileError('请选择截止时间');
            return;
        }

        this.mobileConfirmAdd.disabled = true;
        this.mobileConfirmAdd.textContent = '添加中...';

        try {
            const response = await fetch(`${this.apiBaseURL}/todos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ text, datetime })
            });

            const data = await response.json();

            if (!data.success) {
                this.showMobileError(data.message || '添加失败');
                this.mobileConfirmAdd.disabled = false;
                this.mobileConfirmAdd.textContent = '✓ 添加待办';
                return;
            }

            // 成功添加
            this.closeMobileAddModal();
            await this.loadTodos();
            
            this.mobileConfirmAdd.disabled = false;
            this.mobileConfirmAdd.textContent = '✓ 添加待办';
        } catch (error) {
            this.showMobileError('添加失败，请稍后重试');
            this.mobileConfirmAdd.disabled = false;
            this.mobileConfirmAdd.textContent = '✓ 添加待办';
        }
    }

    showMobileError(message) {
        this.mobileErrorMsg.textContent = message;
        this.mobileErrorMsg.classList.add('show');
        setTimeout(() => {
            this.mobileErrorMsg.classList.remove('show');
        }, 3000);
    }

    // ========== UI 页面切换 ==========

    switchView(viewName) {
        // 更新导航状态
        this.mobileNavItems.forEach(item => {
            if (item.dataset.view === viewName) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // 更新视图面板
        this.viewPanels.forEach(panel => {
            if (panel.dataset.panel === viewName) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    }

    showLoginPage() {
        this.loginPage.classList.add('active');
        this.appPage.classList.remove('active');
        
        // 清除权限信息显示
        this.currentPermission = null;
        if (this.aiPermissionInfo) {
            this.aiPermissionInfo.style.display = 'none';
        }
        if (this.permissionDays) {
            this.permissionDays.textContent = '';
        }
        
        this.usernameInput.focus();
    }

    showAppPage() {
        this.loginPage.classList.remove('active');
        this.appPage.classList.add('active');
        this.setDefaultDateTime();
        
        // 默认显示待办视图（移动端）
        this.switchView('todo');
        
        this.todoInput.focus();
        
        // 检查是否是Thelia用户，显示/隐藏管理员按钮
        const username = this.getUsername();
        const adminBtn = document.getElementById('adminBtn');
        if (adminBtn) {
            if (username === 'Thelia') {
                adminBtn.style.display = 'inline-block';
            } else {
                adminBtn.style.display = 'none';
            }
        }
    }

    setCurrentUser(username) {
        this.currentUser.textContent = `👤 ${username}`;
    }

    clearLoginForm() {
        this.usernameInput.value = '';
        this.passwordInput.value = '';
        this.loginError.classList.remove('show');
    }

    showLoginError(message) {
        this.loginError.textContent = message;
        this.loginError.classList.add('show');
    }

    showError(message) {
        this.errorMsg.textContent = message;
        this.errorMsg.classList.add('show');
        setTimeout(() => this.clearError(), 3000);
    }

    showSuccess(message) {
        this.successMsg.textContent = message;
        this.successMsg.classList.add('show');
        setTimeout(() => this.clearSuccess(), 3000);
    }

    clearError() {
        this.errorMsg.classList.remove('show');
        this.errorMsg.textContent = '';
    }

    clearSuccess() {
        this.successMsg.classList.remove('show');
        this.successMsg.textContent = '';
    }

    // ========== 待办事项 API 交互 ==========

    async loadTodos() {
        console.log('🔄 开始加载待办事项...');
        try {
            const response = await fetch(`${this.apiBaseURL}/todos`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            console.log('📡 收到响应:', response.status, response.statusText);
            const data = await response.json();
            console.log('📦 响应数据:', data);

            if (!data.success) {
                console.error('❌ 响应失败:', data);
                if (response.status === 401) {
                    this.logout();
                    return;
                }
                this.showError(data.message || '加载待办事项失败');
                return;
            }

            console.log(`✅ 成功加载 ${data.todos.length} 条待办事项`);
            this.todos = data.todos || [];
            console.log('📋 当前todos数组:', this.todos);
            this.render();
            console.log('🎨 渲染完成');
        } catch (error) {
            console.error('❌ 加载错误:', error);
            this.showError('加载失败，请检查网络连接');
        }
    }

    async addTodo() {
        const text = this.todoInput.value.trim();
        const dateTime = this.todoDateTime.value;

        // 验证输入
        if (!text) {
            this.showError('请输入待做事项内容');
            return;
        }

        // ✅ 不强制要求设置完成时间
        let dueDate = null;
        if (dateTime) {
            // datetime-local 输入的值是本地时间，需要转换为 UTC
            dueDate = new Date(dateTime);
            if (dueDate <= new Date()) {
                this.showError('完成时间必须晚于当前时间');
                return;
            }
        }

        this.clearError();
        this.addBtn.disabled = true;
        this.addBtn.textContent = '添加中...';

        try {
            const response = await fetch(`${this.apiBaseURL}/todos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    text,
                    dueDate: dueDate ? TimeUtils.toUTC(dueDate) : null
                })
            });

            const data = await response.json();

            if (!data.success) {
                this.showError(data.message || '添加失败');
                this.addBtn.disabled = false;
                this.addBtn.textContent = '+ 添加';
                return;
            }

            this.showSuccess('✅ 待办事项已添加');
            this.todoInput.value = '';
            this.setDefaultDateTime();
            this.loadTodos();
            this.addBtn.disabled = false;
            this.addBtn.textContent = '+ 添加';
            this.todoInput.focus();
        } catch (error) {
            this.showError('添加失败，请稍后重试');
            this.addBtn.disabled = false;
            this.addBtn.textContent = '+ 添加';
        }
    }

    async toggleTodo(id, completed) {
        try {
            const response = await fetch(`${this.apiBaseURL}/todos/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ completed: !completed })
            });

            const data = await response.json();

            if (!data.success) {
                this.showError(data.message || '更新失败');
                return;
            }

            this.loadTodos();
        } catch (error) {
            this.showError('更新失败，请稍后重试');
        }
    }

    async deleteTodo(id) {
        if (!confirm('确定要删除这个待办事项吗？')) {
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseURL}/todos/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (!data.success) {
                this.showError(data.message || '删除失败');
                return;
            }

            this.showSuccess('✅ 待办事项已删除');
            this.loadTodos();
        } catch (error) {
            this.showError('删除失败，请稍后重试');
        }
    }

    // ========== 工具函数 ==========

    setDefaultDateTime() {
        // 设置默认日期时间为当前本地时间
        this.todoDateTime.value = TimeUtils.toDateTimeLocalString();
    }

    getSortedTodos() {
        return [...this.todos].sort((a, b) => {
            // 处理 null 或 undefined 的情况
            const dateA = a.due_date ? new Date(a.due_date) : new Date(8640000000000000); // 最大日期
            const dateB = b.due_date ? new Date(b.due_date) : new Date(8640000000000000);
            return dateA - dateB;
        });
    }

    getTimeStatusClass(dueDate) {
        // 处理 null 或 undefined
        if (!dueDate) {
            return 'no-due-date';
        }
        
        const now = new Date();
        const due = TimeUtils.toLocal(dueDate);
        const diffHours = (due - now) / (1000 * 60 * 60);

        if (due < now) {
            return 'overdue';
        }

        if (diffHours <= 24) {
            return 'today';
        }

        return '';
    }

    formatDateTime(isoString) {
        // 处理 null 或 undefined
        if (!isoString) {
            return '未设置截止时间';
        }
        
        // 使用 TimeUtils 格式化日期时间（UTC 转本地，带时区）
        const date = TimeUtils.toLocal(isoString);
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        const dateStr = `${year}-${month}-${day}`;
        const nowStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        const tomorrowStr = `${tomorrow.getFullYear()}-${tomorrow.getMonth() + 1}-${tomorrow.getDate()}`;

        let dayLabel = '';
        if (dateStr === nowStr) {
            dayLabel = '今天';
        } else if (dateStr === tomorrowStr) {
            dayLabel = '明天';
        } else {
            dayLabel = `${month}月${day}日`;
        }

        return `${dayLabel} ${hours}:${minutes} ${TimeUtils.getTimezoneString()}`;
    }

    formatChatTimestamp(timestamp) {
        // 使用 TimeUtils 格式化聊天时间戳（UTC 转本地时区）
        return TimeUtils.formatChatTimestamp(timestamp);
    }

    formatDuration(milliseconds) {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const parts = [];
        if (days > 0) {
            parts.push(`${days}天`);
        }
        parts.push(`${hours.toString().padStart(2, '0')}小时`);
        parts.push(`${minutes.toString().padStart(2, '0')}分`);
        parts.push(`${seconds.toString().padStart(2, '0')}秒`);

        return parts.join(' ');
    }

    getChatDisplayName(type) {
        if (type === 'user') {
            return this.getUsername() || '我';
        }
        if (type === 'assistant') {
            return 'Todo AI';
        }
        return '系统消息';
    }

    parseDateInputToISO(value) {
        if (!value && value !== 0) {
            return null;
        }

        if (value instanceof Date) {
            return value.toISOString();
        }

        let raw = String(value).trim();
        if (!raw) {
            return null;
        }

        raw = raw.replace(/\//g, '-').replace(/\s+/g, ' ');
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            raw += 'T00:00';
        } else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(raw)) {
            raw = raw.replace(' ', 'T');
        }

        const parsed = new Date(raw);
        if (isNaN(parsed.getTime())) {
            return null;
        }

        return parsed.toISOString();
    }

    getTimeStatusText(dueDate) {
        // 处理 null 或 undefined
        if (!dueDate) {
            return '无截止时间';
        }
        
        const due = TimeUtils.toLocal(dueDate);
        const now = new Date();

        if (due < now) {
            const diffHours = (now - due) / (1000 * 60 * 60);
            if (diffHours < 1) {
                return '已过期';
            }
            return `逾期 ${Math.floor(diffHours)}小时`;
        }

        const diffHours = (due - now) / (1000 * 60 * 60);
        if (diffHours < 1) {
            const diffMinutes = Math.ceil(diffHours * 60);
            return `${diffMinutes}分钟后`;
        }

        if (diffHours < 24) {
            return `${Math.floor(diffHours)}小时后`;
        }

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}天后`;
    }

    buildAiTodoSnapshotLine(todo, index, timezoneLabel) {
        const statusSymbol = todo.completed ? '✓ 已完成' : '○ 未完成';
        const normalizedText = (todo.text || '').replace(/\s+/g, ' ').trim() || '(未填写内容)';
        const dueUtc = todo.due_date || '未设置';
        const dueLocal = todo.due_date ? TimeUtils.formatDateTime(todo.due_date, false) : '未设置';
        const dueState = this.describeDueState(todo.due_date);
        return `${index + 1}. [ID:${todo.id}] ${statusSymbol} ${normalizedText}\n    - 截止(本地 ${timezoneLabel}): ${dueLocal}\n    - 截止(UTC): ${dueUtc}\n    - 时间状态: ${dueState}`;
    }

    describeDueState(dueDate) {
        if (!dueDate) {
            return '无截止时间';
        }

        const due = TimeUtils.toLocal(dueDate);
        if (!due) {
            return '截止时间无效';
        }

        const now = new Date();
        const diffMs = due.getTime() - now.getTime();
        const absMs = Math.abs(diffMs);
        const human = this.formatDurationForAI(absMs);

        if (diffMs < 0) {
            return `⚠️ 已逾期 ${human}`;
        }

        if (absMs < 60000) {
            return '不足1分钟后到期';
        }

        return `剩余 ${human}`;
    }

    formatDurationForAI(ms) {
        if (!ms || ms < 60000) {
            return '不到1分钟';
        }

        const totalMinutes = Math.floor(ms / 60000);
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = totalMinutes % 60;

        const parts = [];
        if (days > 0) {
            parts.push(`${days}天`);
        }
        if (hours > 0) {
            parts.push(`${hours}小时`);
        }
        if (minutes > 0 && parts.length < 2) {
            parts.push(`${minutes}分钟`);
        }

        if (parts.length === 0) {
            parts.push('不到1分钟');
        }

        return parts.join(' ');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    render() {
        console.log('🎨 开始渲染，当前todos数量:', this.todos.length);
        const sortedTodos = this.getSortedTodos();
        console.log('📊 排序后todos数量:', sortedTodos.length);

        if (sortedTodos.length === 0) {
            console.log('📭 待办事项为空，显示空状态');
            this.todoList.innerHTML = `<div class="empty-state"><p>✨ 暂无待办事项，开始添加吧！</p></div>`;
            this.updateStats();
            return;
        }

        console.log('📝 开始生成HTML...');
        this.todoList.innerHTML = sortedTodos.map(todo => {
            const timeStatusClass = this.getTimeStatusClass(todo.due_date);
            const formattedTime = this.formatDateTime(todo.due_date);
            const timeStatusText = this.getTimeStatusText(todo.due_date);

            return `
                <div class="todo-item ${todo.completed ? 'completed' : ''} ${timeStatusClass}">
                    <input 
                        type="checkbox" 
                        class="checkbox" 
                        ${todo.completed ? 'checked' : ''}
                        onchange="app.toggleTodo(${todo.id}, ${todo.completed})"
                    >
                    <div class="todo-content">
                        <div class="todo-text">${this.escapeHtml(todo.text)}</div>
                        <div class="todo-time">
                            <span class="time-badge">🕐 ${formattedTime}</span>
                            <span>(${timeStatusText})</span>
                        </div>
                    </div>
                    <div class="todo-actions">
                        <button class="btn-delete" onclick="app.deleteTodo(${todo.id})">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

        this.updateStats();
    }

    // ========== ✅ AI 命令执行系统 ==========
    // 
    // Gemini AI 可以通过特殊命令操作待办事项
    // 命令格式：[COMMAND|参数1|参数2|...]
    // 
    // 支持的命令：
    // [ADD|任务名称] - 添加新待办事项
    // [COMPLETE|ID] - 标记任务为已完成
    // [DELETE|ID] - 删除任务
    // [UPDATE|ID|新任务名称] - 更新任务名称
    // [SETDUEDATE|ID|YYYY-MM-DD HH:mm] - 设置截止时间
    //
    // 示例：
    // "我帮你添加一个任务：[ADD|完成报告] 这个任务很重要"
    // "我标记这个任务为完成：[COMPLETE|1]"

    // ✅ 过滤命令行 - 移除所有命令语句但保留其他文本
    filterCommandLines(responseText) {
        // 移除所有命令行（包括有效和无效的格式）
        // 有效: 🔧[CMD:COMMAND|params]
        // 无效: 🔧[CMD:COMMAND	params]
        
        // 移除有效的命令行
        let cleaned = responseText.replace(/🔧\[CMD:[A-Z]+(\|[^\]]*?)?\]/g, '');
        
        // 移除无效的命令行（使用制表符或多个空格）
        cleaned = cleaned.replace(/🔧\[CMD:[A-Z]+[\t\s]+[^\]]*\]/g, '');
        
        // 清理多余的空行（最多保留两个连续空行）
        cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        // 移除开头和结尾的空行
        cleaned = cleaned.trim();
        
        return cleaned;
    }

    async executeGeminiCommands(responseText) {
        const results = [];
        let hasCommandsExecuted = false;  // ✅ 标记是否执行了任何命令
        
        // 命令正则表达式：🔧[CMD:COMMAND|参数1|参数2|...]
        // 格式: 🔧[CMD:命令名|参数1|参数2|...]
        const commandRegex = /🔧\[CMD:([A-Z]+)(\|[^\]]*?)?\]/g;
        
        // 检查是否有无效的命令格式（如制表符分隔）
        const invalidCommandRegex = /🔧\[CMD:[A-Z]+[\t\s]+[^\]]*\]/g;
        const invalidMatches = responseText.match(invalidCommandRegex);
        if (invalidMatches) {
            invalidMatches.forEach(cmd => {
                console.warn(`⚠️  检测到格式错误的命令: ${cmd}`);
                results.push(`⚠️  命令格式错误: ${cmd} (应使用 | 分隔参数，不要用制表符或空格)`);
            });
        }
        
        let match;

        while ((match = commandRegex.exec(responseText)) !== null) {
            const fullCommand = match[0];  // 完整命令如 🔧[CMD:ADD|任务名]
            const command = match[1];      // 命令名如 ADD
            const paramsStr = match[2] ? match[2].substring(1) : '';  // 参数字符串
            const params = paramsStr.split('|').map(p => p.trim());

            console.log(`🔧 执行命令: ${command}`, params);
            hasCommandsExecuted = true;  // ✅ 标记命令已执行

            try {
                switch (command) {
                    case 'ADD':
                        await this.executeAddCommand(params, results);
                        break;
                    case 'COMPLETE':
                        await this.executeCompleteCommand(params, results);
                        break;
                    case 'DELETE':
                        await this.executeDeleteCommand(params, results);
                        break;
                    case 'UPDATE':
                        await this.executeUpdateCommand(params, results);
                        break;
                    case 'SETDUEDATE':
                        await this.executeSetDueDateCommand(params, results);
                        break;
                    default:
                        results.push(`⚠️ 未知命令: ${command}`);
                }
            } catch (error) {
                console.error(`命令执行错误 ${command}:`, error);
                results.push(`❌ 命令执行失败: ${command} - ${error.message}`);
            }
        }

        // ✅ 所有命令执行完毕后，再次刷新列表确保显示最新数据
        if (hasCommandsExecuted) {
            console.log('📋 所有命令执行完毕，最终刷新待办列表...');
            await this.loadTodos();
        }

        return results;
    }

    // 命令实现：添加待办事项
    async executeAddCommand(params, results) {
        if (params.length === 0 || !params[0]) {
            results.push('❌ ADD 命令缺少参数：任务名称');
            return;
        }

        const taskName = params[0];
        const rawDueDate = params.length > 1 ? params[1] : null;
        const dueDateISO = rawDueDate ? this.parseDateInputToISO(rawDueDate) : null;

        let dueDateDisplay = null;
        if (rawDueDate && !dueDateISO) {
            results.push(`❌ 日期格式错误: ${rawDueDate}，已忽略截止时间`);
        } else if (dueDateISO) {
            dueDateDisplay = this.formatDateTime(dueDateISO);
        }

        try {
            const response = await fetch(`${this.apiBaseURL}/todos`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    text: taskName,
                    dueDate: dueDateISO
                })
            });

            const data = await response.json();
            if (data.success) {
                const todoId = data.todo.id;
                const dueDateStr = dueDateDisplay ? ` (截止: ${dueDateDisplay})` : '';
                results.push(`✅ 已添加任务: "${taskName}"${dueDateStr} [ID:${todoId}]`);
                
                // ✅ 关键修复：立即将新任务添加到 this.todos，以便后续命令使用
                this.todos.push({
                    id: todoId,
                    text: taskName,
                    due_date: dueDateISO,
                    completed: false
                });
                
                // 将ID存储在 results 对象中，以便后续SETDUEDATE命令获取
                results.lastCreatedId = todoId;
                if (!results.createdIds) {
                    results.createdIds = [];
                }
                results.createdIds.push(todoId);
                // ✅ 移除此处的 loadTodos()，由最后的集中刷新处理
            } else {
                results.push(`❌ 添加失败: ${data.message}`);
            }
        } catch (error) {
            results.push(`❌ 添加任务出错: ${error.message}`);
        }
    }

    // 命令实现：标记完成
    async executeCompleteCommand(params, results) {
        if (params.length === 0 || !params[0]) {
            results.push('❌ COMPLETE 命令缺少参数：任务ID');
            return;
        }

        const todoId = parseInt(params[0]);
        const todo = this.todos.find(t => t.id === todoId);

        if (!todo) {
            results.push(`❌ 找不到ID为 ${todoId} 的任务`);
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseURL}/todos/${todoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ completed: true })
            });

            const data = await response.json();
            if (data.success) {
                results.push(`✅ 已标记完成: "${todo.text}"`);
                
                // ✅ 同时更新本地状态
                todo.completed = true;
                // ✅ 移除此处的 loadTodos()，由最后的集中刷新处理
            } else {
                results.push(`❌ 标记失败: ${data.message}`);
            }
        } catch (error) {
            results.push(`❌ 标记完成出错: ${error.message}`);
        }
    }

    // 命令实现：删除任务
    async executeDeleteCommand(params, results) {
        if (params.length === 0 || !params[0]) {
            results.push('❌ DELETE 命令缺少参数：任务ID');
            return;
        }

        const todoId = parseInt(params[0]);
        const todo = this.todos.find(t => t.id === todoId);

        if (!todo) {
            results.push(`❌ 找不到ID为 ${todoId} 的任务`);
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseURL}/todos/${todoId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();
            if (data.success) {
                results.push(`✅ 已删除任务: "${todo.text}"`);
                
                // ✅ 同时更新本地状态
                const index = this.todos.indexOf(todo);
                if (index > -1) {
                    this.todos.splice(index, 1);
                }
                // ✅ 移除此处的 loadTodos()，由最后的集中刷新处理
            } else {
                results.push(`❌ 删除失败: ${data.message}`);
            }
        } catch (error) {
            results.push(`❌ 删除任务出错: ${error.message}`);
        }
    }

    // 命令实现：更新任务名称
    async executeUpdateCommand(params, results) {
        if (params.length < 2 || !params[0] || !params[1]) {
            results.push('❌ UPDATE 命令缺少参数：需要 ID 和新任务名称');
            return;
        }

        const todoId = parseInt(params[0]);
        const newText = params.slice(1).join('|');  // 允许新名称中包含|
        const todo = this.todos.find(t => t.id === todoId);

        if (!todo) {
            results.push(`❌ 找不到ID为 ${todoId} 的任务`);
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseURL}/todos/${todoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ text: newText })
            });

            const data = await response.json();
            if (data.success) {
                results.push(`✅ 已更新任务: "${todo.text}" → "${newText}"`);
                
                // ✅ 同时更新本地状态
                todo.text = newText;
                // ✅ 移除此处的 loadTodos()，由最后的集中刷新处理
            } else {
                results.push(`❌ 更新失败: ${data.message}`);
            }
        } catch (error) {
            results.push(`❌ 更新任务出错: ${error.message}`);
        }
    }

    // 命令实现：设置截止时间
    async executeSetDueDateCommand(params, results) {
        if (params.length < 2 || !params[0] || !params[1]) {
            results.push('❌ SETDUEDATE 命令缺少参数：需要 ID 和日期时间');
            return;
        }

        // 如果第一个参数是"@latest"或"@"，使用最后创建的任务ID
        let todoId = params[0];
        if (todoId === '@latest' || todoId === '@') {
            // 使用最后创建的任务ID
            if (results.lastCreatedId) {
                todoId = results.lastCreatedId;
            } else {
                results.push('❌ 无法找到最新创建的任务，请指定任务ID');
                return;
            }
        } else {
            todoId = parseInt(todoId);
        }

        const dateTimeStr = params.slice(1).join('|');
        const todo = this.todos.find(t => t.id === todoId);

        if (!todo) {
            results.push(`❌ 找不到ID为 ${todoId} 的任务`);
            return;
        }

        try {
            const dueDateISO = this.parseDateInputToISO(dateTimeStr);
            if (!dueDateISO) {
                results.push(`❌ 日期格式错误: ${dateTimeStr}`);
                return;
            }

            const response = await fetch(`${this.apiBaseURL}/todos/${todoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ dueDate: dueDateISO })
            });

            const data = await response.json();
            if (data.success) {
                results.push(`✅ 已设置截止时间: "${todo.text}" → ${this.formatDateTime(dueDateISO)}`);
                
                // ✅ 关键修复：同时更新本地 this.todos 中的任务数据
                const localTodo = this.todos.find(t => t.id === todoId);
                if (localTodo) {
                    localTodo.due_date = dueDateISO;
                }
                // ✅ 移除此处的 loadTodos()，由最后的集中刷新处理
            } else {
                results.push(`❌ 设置失败: ${data.message}`);
            }
        } catch (error) {
            results.push(`❌ 设置时间出错: ${error.message}`);
        }
    }

    updateStats() {
        this.totalCount.textContent = this.todos.length;
        const pendingCount = this.todos.filter(todo => !todo.completed).length;
        this.pendingCount.textContent = pendingCount;
    }
}

// 初始化应用
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TodoApp();
});
