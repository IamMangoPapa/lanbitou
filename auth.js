// auth.js – 用户认证与管理
const Auth = {
    currentUser: null,

    // 用户数据存储键前缀
    getUserKey(username) {
        return `lanbitou_user_${username}`;
    },

    // 注册
    register(username, password) {
        const key = this.getUserKey(username);
        if (localStorage.getItem(key)) {
            return { success: false, message: '用户名已存在' };
        }
        // 存储密码（简单哈希，实际应使用更安全方式）
        const userData = {
            password: btoa(password), // Base64 编码（演示）
            createdAt: new Date().toISOString()
        };
        localStorage.setItem(key, JSON.stringify(userData));
        return { success: true };
    },

    // 登录
    login(username, password) {
        const key = this.getUserKey(username);
        const data = localStorage.getItem(key);
        if (!data) {
            return { success: false, message: '用户不存在' };
        }
        const userData = JSON.parse(data);
        if (userData.password !== btoa(password)) {
            return { success: false, message: '密码错误' };
        }
        this.currentUser = username;
        // 保存会话
        localStorage.setItem('lanbitou_session', username);
        return { success: true };
    },

    // 登出
    logout() {
        this.currentUser = null;
        localStorage.removeItem('lanbitou_session');
    },

    // 检查当前会话
    getSession() {
        const user = localStorage.getItem('lanbitou_session');
        if (user && this.currentUser !== user) {
            this.currentUser = user;
        }
        return this.currentUser;
    },

    // 获取当前用户名
    getCurrentUser() {
        return this.currentUser || this.getSession();
    },

    // 检查是否登录
    isLoggedIn() {
        return !!this.getCurrentUser();
    }
};

// 初始化时恢复会话
Auth.getSession();