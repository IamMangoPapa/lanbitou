// ui.js – 界面渲染与交互 (v5.4-colors)
const UI = {
    els: {},
    currentFilter: 'all',
    currentKeyword: '',
    selectedTags: [],
    viewMode: 'card',
    multiSelectMode: false,
    selectedIds: new Set(),
    confirmCallback: null,
    isEditing: false,
    previewNoteId: null,

    // 饱和色板（用于生成浅色背景）
    tagHues: [
        30, 210, 150, 0, 280, 180,
        40, 200, 140, 350, 260, 160
    ],

    init() {
        this.els = {
            container: document.getElementById('ideasContainer'),
            empty: document.getElementById('emptyState'),
            totalNum: document.getElementById('totalNum'),
            publicNum: document.getElementById('publicNum'),
            privateNum: document.getElementById('privateNum'),
            searchInput: document.getElementById('searchInput'),
            clearSearch: document.getElementById('clearSearch'),
            filterTabs: document.querySelectorAll('.filter-tab'),
            filterTags: document.getElementById('filterTags'),
            listView: document.getElementById('listView'),
            editorView: document.getElementById('editorView'),
            editorTitle: document.getElementById('editorTitle'),
            editId: document.getElementById('editId'),
            ideaTitle: document.getElementById('ideaTitle'),
            ideaContent: document.getElementById('ideaContent'),
            ideaTags: document.getElementById('ideaTags'),
            ideaVisibility: document.getElementById('ideaVisibility'),
            toggleBtns: document.querySelectorAll('.toggle-btn'),
            tagSelector: document.getElementById('tagSelector'),
            form: document.getElementById('ideaForm'),
            modalSubmit: document.getElementById('modalSubmit'),
            editorCancel: document.getElementById('editorCancel'),
            fabAdd: document.getElementById('fabAdd'),
            themeToggle: document.getElementById('themeToggle'),
            exportBtn: document.getElementById('exportBtn'),
            importBtn: document.getElementById('importBtn'),
            fileInput: document.getElementById('fileInput'),
            settingsToggle: document.getElementById('settingsToggle'),
            settingsOverlay: document.getElementById('settingsOverlay'),
            settingsClose: document.getElementById('settingsClose'),
            settingFolderBtn: document.getElementById('settingFolderBtn'),
            folderStatus: document.getElementById('folderStatus'),
            settingThemeLight: document.getElementById('settingThemeLight'),
            settingThemeDark: document.getElementById('settingThemeDark'),
            viewToggle: document.getElementById('viewToggle'),
            multiSelectToggle: document.getElementById('multiSelectToggle'),
            multiSelectBar: document.getElementById('multiSelectBar'),
            selectedCount: document.getElementById('selectedCount'),
            batchDeleteBtn: document.getElementById('batchDeleteBtn'),
            cancelMultiSelect: document.getElementById('cancelMultiSelect'),
            customConfirm: document.getElementById('customConfirm'),
            confirmMessage: document.getElementById('confirmMessage'),
            confirmOk: document.getElementById('confirmOk'),
            confirmCancel: document.getElementById('confirmCancel'),
            insertImageBtn: document.getElementById('insertImageBtn'),
            imageFileInput: document.getElementById('imageFileInput'),
            clearFormatBtn: document.getElementById('clearFormatBtn'),
            previewOverlay: document.getElementById('previewOverlay'),
            previewTitle: document.getElementById('previewTitle'),
            previewContent: document.getElementById('previewContent'),
            previewVisibility: document.getElementById('previewVisibility'),
            previewTags: document.getElementById('previewTags'),
            previewDate: document.getElementById('previewDate'),
            previewEditBtn: document.getElementById('previewEditBtn'),
            previewClose: document.getElementById('previewClose'),
            loadingIndicator: document.getElementById('loadingIndicator'),
            userToggle: document.getElementById('userToggle'),
            userOverlay: document.getElementById('userOverlay'),
            userClose: document.getElementById('userClose'),
            userUsername: document.getElementById('userUsername'),
            userPassword: document.getElementById('userPassword'),
            userLoginBtn: document.getElementById('userLoginBtn'),
            userRegisterBtn: document.getElementById('userRegisterBtn'),
            userLogoutBtn: document.getElementById('userLogoutBtn'),
            userStatusDisplay: document.getElementById('userStatusDisplay'),
            userHint: document.getElementById('userHint'),
            newTagInput: document.getElementById('newTagInput'),
            addTagBtn: document.getElementById('addTagBtn'),
        };

        if (!this.els.fabAdd) {
            console.error('关键元素未找到');
            return;
        }

        this.bindTheme();
        this.setupMultiSelect();
        this.setupViewToggle();
        this.setupConfirmDialog();
        this.setupRichTextEditor();
        this.setupSettings();
        this.setupFolder();
        this.setupToggleButtons();
        this.setupPreview();
        this.setupUserManagement();
        this.setupAddTag();
        this.updateUserUI();
        window.UI = this;
        this.refreshTagsUI();
        this.loadData();
    },

    // ---------- 数据加载与解密 ----------
    async loadData() {
        this.showLoading(true);
        const raw = Storage.getAllSync();
        const user = Storage.getCurrentUser();
        const password = Storage.getUserPassword();
        let notes = raw;
        if (user && password) {
            for (let note of notes) {
                if (note._encrypted && note.content) {
                    note.content = await Storage.decryptContent(note.content, password);
                }
            }
        }
        this.render(notes);
        this.updateStats(notes);
        this.showLoading(false);
    },

    // ---------- 确保数据解密（供渲染调用） ----------
    async ensureDecrypted(notes) {
        const user = Storage.getCurrentUser();
        const password = Storage.getUserPassword();
        if (!user || !password) return notes;
        const decrypted = [];
        for (let note of notes) {
            if (note._encrypted && note.content) {
                const dec = await Storage.decryptContent(note.content, password);
                decrypted.push({ ...note, content: dec });
            } else {
                decrypted.push(note);
            }
        }
        return decrypted;
    },

    showLoading(show) {
        const el = this.els.loadingIndicator;
        if (el) el.style.display = show ? 'flex' : 'none';
    },

    // ---------- 可见性切换 ----------
    setupToggleButtons() {
        const btns = this.els.toggleBtns;
        if (!btns) return;
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.dataset.value;
                this.setToggleActive(value);
            });
        });
    },

    // ---------- 富文本编辑器 ----------
    setupRichTextEditor() {
        const content = this.els.ideaContent;
        const insertBtn = this.els.insertImageBtn;
        const fileInput = this.els.imageFileInput;
        const clearBtn = this.els.clearFormatBtn;
        if (!content || !insertBtn || !fileInput) return;

        insertBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
                alert('图片超过 10MB');
                fileInput.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                this.insertImageAtCursor(content, ev.target.result);
                fileInput.value = '';
            };
            reader.readAsDataURL(file);
        });
        clearBtn.addEventListener('click', () => {
            content.innerText = content.innerText;
        });
        content.addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    if (blob.size > 10 * 1024 * 1024) {
                        alert('粘贴图片超过 10MB');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        this.insertImageAtCursor(content, ev.target.result);
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        });
    },

    insertImageAtCursor(editor, dataUrl) {
        const sel = window.getSelection();
        let range;
        if (sel.rangeCount > 0) {
            range = sel.getRangeAt(0);
        } else {
            range = document.createRange();
            range.setStart(editor, 0);
            range.collapse(true);
        }
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '4px';
        img.style.margin = '4px 0';
        img.setAttribute('contenteditable', 'false');
        range.insertNode(img);
        const space = document.createTextNode('\u00A0');
        range.setStartAfter(img);
        range.insertNode(space);
        range.setStartAfter(space);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        editor.focus();
    },

    // ---------- 标签颜色工具 ----------
    getLightTagColor(tag) {
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        const idx = Math.abs(hash) % this.tagHues.length;
        const hue = this.tagHues[idx];
        // 浅色背景：饱和度 30%，亮度 85%
        return `hsl(${hue}, 30%, 85%)`;
    },

    // ---------- 标签 UI ----------
    refreshTagsUI() {
        const tags = Storage.getTags();
        const filterContainer = this.els.filterTags;
        if (filterContainer) {
            filterContainer.innerHTML = '';
            tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag-filter' + (this.selectedTags.includes(tag) ? ' active' : '');
                span.dataset.tag = tag;
                span.textContent = tag;
                span.style.backgroundColor = this.getLightTagColor(tag);
                span.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = this.selectedTags.indexOf(tag);
                    if (idx > -1) this.selectedTags.splice(idx, 1);
                    else this.selectedTags.push(tag);
                    this.renderWithDecryption();
                });
                filterContainer.appendChild(span);
            });
        }

        const selector = this.els.tagSelector;
        if (selector) {
            const currentNoteTags = this.els.ideaTags.value ? this.els.ideaTags.value.split(',').map(s => s.trim()).filter(Boolean) : [];
            selector.innerHTML = '';
            tags.forEach(tag => {
                const btn = document.createElement('span');
                btn.className = 'tag-option' + (currentNoteTags.includes(tag) ? ' active' : '');
                btn.textContent = tag;
                btn.style.backgroundColor = this.getLightTagColor(tag);
                btn.addEventListener('click', () => {
                    const input = this.els.ideaTags;
                    let current = input.value.split(',').map(s => s.trim()).filter(Boolean);
                    const idx = current.indexOf(tag);
                    if (idx > -1) current.splice(idx, 1);
                    else current.push(tag);
                    input.value = current.join(', ');
                    this.refreshTagsUI();
                });
                selector.appendChild(btn);
            });
        }
    },

    // ---------- 封装渲染（带解密） ----------
    async renderWithDecryption() {
        const raw = Storage.getAllSync();
        const decrypted = await this.ensureDecrypted(raw);
        this.render(decrypted);
        this.updateStats(decrypted);
        this.refreshTagsUI();
    },

    // ---------- 编辑器 ----------
    async showEditor(noteId = null) {
        this.isEditing = true;
        this.els.listView.style.display = 'none';
        this.els.editorView.style.display = 'block';
        this.els.fabAdd.style.display = 'none';

        if (noteId) {
            const note = Storage.getById(noteId);
            if (!note) return;
            this.els.editorTitle.innerHTML = '<i class="fas fa-feather-alt"></i> 编辑灵感';
            this.els.editId.value = note.id;
            this.els.ideaTitle.value = note.title;
            let content = note.content || '';
            const user = Storage.getCurrentUser();
            const password = Storage.getUserPassword();
            if (user && password && note._encrypted) {
                content = await Storage.decryptContent(content, password);
            }
            this.els.ideaContent.innerHTML = content;
            this.els.ideaTags.value = Array.isArray(note.tags) ? note.tags.join(', ') : '';
            this.els.ideaVisibility.value = note.visibility || 'private';
            this.setToggleActive(note.visibility || 'private');
            this.els.modalSubmit.innerHTML = '<i class="fas fa-save"></i> 更新';
        } else {
            this.els.editorTitle.innerHTML = '<i class="fas fa-feather-alt"></i> 新灵感';
            this.els.editId.value = '';
            this.els.ideaTitle.value = '';
            this.els.ideaContent.innerHTML = '';
            this.els.ideaTags.value = '';
            this.els.ideaVisibility.value = 'private';
            this.setToggleActive('private');
            this.els.modalSubmit.innerHTML = '<i class="fas fa-save"></i> 保存';
        }
        this.refreshTagsUI();
        this.els.ideaTitle.focus();
    },

    hideEditor() {
        this.isEditing = false;
        this.els.listView.style.display = 'block';
        this.els.editorView.style.display = 'none';
        this.els.fabAdd.style.display = 'block';
        this.renderWithDecryption();
    },

    setToggleActive(value) {
        this.els.toggleBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
        this.els.ideaVisibility.value = value;
    },

    // ---------- 预览 ----------
    setupPreview() {
        const overlay = this.els.previewOverlay;
        const close = this.els.previewClose;
        const editBtn = this.els.previewEditBtn;
        if (!overlay) return;

        close.addEventListener('click', () => {
            overlay.style.display = 'none';
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });
        editBtn.addEventListener('click', () => {
            overlay.style.display = 'none';
            if (this.previewNoteId) {
                this.showEditor(this.previewNoteId);
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.style.display === 'flex') {
                overlay.style.display = 'none';
            }
        });
    },

    async showPreview(noteId) {
        const note = Storage.getById(noteId);
        if (!note) return;
        let content = note.content || '';
        const user = Storage.getCurrentUser();
        const password = Storage.getUserPassword();
        if (user && password && note._encrypted) {
            content = await Storage.decryptContent(content, password);
        }
        this.previewNoteId = noteId;
        this.els.previewTitle.textContent = note.title || '无标题';
        this.els.previewContent.innerHTML = content || '<p style="color:var(--text-muted)">无内容</p>';
        const vis = note.visibility || 'private';
        this.els.previewVisibility.className = 'card-visibility ' + vis;
        this.els.previewVisibility.innerHTML = `<i class="fas ${vis === 'public' ? 'fa-globe' : 'fa-lock'}"></i> ${vis}`;
        const tags = Array.isArray(note.tags) ? note.tags : [];
        this.els.previewTags.innerHTML = tags.map(t =>
            `<span class="tag" style="background:${this.getLightTagColor(t)}">${t}</span>`
        ).join('');
        this.els.previewDate.textContent = new Date(note.createdAt).toLocaleString();
        this.els.previewOverlay.style.display = 'flex';
    },

    // ---------- 渲染 ----------
    render(notes) {
        const container = this.els.container;
        const empty = this.els.empty;
        if (!container) return;

        let filtered = notes;
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(n => n.visibility === this.currentFilter);
        }
        if (this.currentKeyword.trim()) {
            const kw = this.currentKeyword.trim().toLowerCase();
            filtered = filtered.filter(n => {
                const tags = Array.isArray(n.tags) ? n.tags : [];
                return n.title.toLowerCase().includes(kw) ||
                       n.content.toLowerCase().includes(kw) ||
                       tags.some(t => t.toLowerCase().includes(kw));
            });
        }
        if (this.selectedTags.length > 0) {
            filtered = filtered.filter(n => {
                const tags = Array.isArray(n.tags) ? n.tags : [];
                return this.selectedTags.every(t => tags.includes(t));
            });
        }

        container.innerHTML = '';
        if (filtered.length === 0) {
            if (empty) {
                container.appendChild(empty);
                empty.style.display = 'block';
            }
            this.updateStats(notes);
            this.refreshTagsUI();
            return;
        }
        if (empty) empty.style.display = 'none';

        container.className = this.viewMode === 'card' ? 'ideas-container' : 'ideas-container list-view';
        if (this.multiSelectMode) container.classList.add('multi-select-mode');

        filtered.forEach(note => {
            const card = document.createElement('div');
            card.className = 'idea-card';
            card.dataset.id = note.id;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'card-checkbox';
            checkbox.checked = this.selectedIds.has(note.id);
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                if (checkbox.checked) this.selectedIds.add(note.id);
                else this.selectedIds.delete(note.id);
                this.updateMultiSelectBar();
            });
            card.appendChild(checkbox);

            const visibilityClass = note.visibility === 'public' ? 'public' : 'private';
            const visibilityIcon = note.visibility === 'public' ? 'fa-globe' : 'fa-lock';
            const tags = Array.isArray(note.tags) ? note.tags : [];
            let tagsHtml = '';
            if (tags.length) {
                tagsHtml = `<div class="card-tags">${tags.map(t =>
                    `<span class="tag" style="background:${this.getLightTagColor(t)}">${t}</span>`
                ).join('')}</div>`;
            }
            const contentHtml = note.content || '';

            card.innerHTML += `
                <div class="card-header">
                    <span class="card-title" data-id="${note.id}">${this.escapeHtml(note.title)}</span>
                    <span class="card-visibility ${visibilityClass}"><i class="fas ${visibilityIcon}"></i> ${note.visibility}</span>
                </div>
                <div class="card-content">${this.sanitizeHtml(contentHtml)}</div>
                ${tagsHtml}
                <div class="card-footer">
                    <span>${new Date(note.createdAt).toLocaleDateString()}</span>
                    <div class="card-actions">
                        <button class="preview-btn" data-id="${note.id}" title="预览"><i class="fas fa-eye"></i></button>
                        <button class="edit-btn" data-id="${note.id}" title="编辑"><i class="fas fa-edit"></i></button>
                        <button class="delete-btn" data-id="${note.id}" title="删除"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });

        container.querySelectorAll('.preview-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.showPreview(id);
            });
        });
        container.querySelectorAll('.card-title').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                this.showPreview(id);
            });
        });
        container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.showEditor(id);
            });
        });
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const rect = btn.getBoundingClientRect();
                this.showConfirm('确定删除此灵感？', () => {
                    Storage.delete(id);
                    this.renderWithDecryption();
                }, rect);
            });
        });

        this.updateStats(notes);
        this.refreshTagsUI();
        this.updateMultiSelectBar();
    },

    // ---------- 统计 ----------
    updateStats(notes) {
        const total = notes.length;
        const publicCount = notes.filter(n => n.visibility === 'public').length;
        const privateCount = total - publicCount;
        if (this.els.totalNum) this.els.totalNum.textContent = total;
        if (this.els.publicNum) this.els.publicNum.textContent = publicCount;
        if (this.els.privateNum) this.els.privateNum.textContent = privateCount;
    },

    // ---------- 多选 ----------
    setupMultiSelect() {
        const toggle = this.els.multiSelectToggle;
        if (!toggle) return;
        toggle.addEventListener('click', () => {
            this.multiSelectMode = !this.multiSelectMode;
            if (!this.multiSelectMode) {
                this.selectedIds.clear();
                this.els.multiSelectBar.style.display = 'none';
            } else {
                this.els.multiSelectBar.style.display = 'flex';
            }
            this.renderWithDecryption();
        });

        this.els.cancelMultiSelect.addEventListener('click', () => {
            this.multiSelectMode = false;
            this.selectedIds.clear();
            this.els.multiSelectBar.style.display = 'none';
            this.renderWithDecryption();
        });

        this.els.batchDeleteBtn.addEventListener('click', () => {
            if (this.selectedIds.size === 0) {
                alert('请先选择要删除的笔记');
                return;
            }
            const rect = this.els.batchDeleteBtn.getBoundingClientRect();
            this.showConfirm(`确定要删除选中的 ${this.selectedIds.size} 条笔记吗？`, () => {
                const ids = Array.from(this.selectedIds);
                ids.forEach(id => Storage.delete(id));
                this.selectedIds.clear();
                this.multiSelectMode = false;
                this.els.multiSelectBar.style.display = 'none';
                this.renderWithDecryption();
            }, rect);
        });
    },

    updateMultiSelectBar() {
        const bar = this.els.multiSelectBar;
        if (!this.multiSelectMode) {
            bar.style.display = 'none';
            return;
        }
        bar.style.display = 'flex';
        this.els.selectedCount.textContent = `已选 ${this.selectedIds.size} 项`;
    },

    // ---------- 视图切换 ----------
    setupViewToggle() {
        const btn = this.els.viewToggle;
        if (!btn) return;
        btn.addEventListener('click', () => {
            this.viewMode = this.viewMode === 'card' ? 'list' : 'card';
            btn.innerHTML = this.viewMode === 'card' ? '<i class="fas fa-th-list"></i>' : '<i class="fas fa-th"></i>';
            this.renderWithDecryption();
        });
    },

    // ---------- 确认弹窗 ----------
    setupConfirmDialog() {
        this.els.confirmOk.addEventListener('click', () => {
            this.els.customConfirm.style.display = 'none';
            if (this.confirmCallback) {
                this.confirmCallback();
                this.confirmCallback = null;
            }
        });
        this.els.confirmCancel.addEventListener('click', () => {
            this.els.customConfirm.style.display = 'none';
            this.confirmCallback = null;
        });
        document.addEventListener('click', (e) => {
            if (this.els.customConfirm.style.display === 'block' && !this.els.customConfirm.contains(e.target)) {
                this.els.customConfirm.style.display = 'none';
                this.confirmCallback = null;
            }
        });
    },

    showConfirm(message, callback, rect) {
        this.els.confirmMessage.textContent = message;
        this.confirmCallback = callback;
        this.els.customConfirm.style.display = 'block';
        if (rect) {
            const left = rect.left + rect.width / 2;
            const top = rect.top + rect.height + 12;
            this.els.customConfirm.style.left = left + 'px';
            this.els.customConfirm.style.top = top + 'px';
        } else {
            this.els.customConfirm.style.left = '50%';
            this.els.customConfirm.style.top = '50%';
        }
    },

    // ---------- 用户管理 ----------
    setupUserManagement() {
        const toggle = this.els.userToggle;
        const overlay = this.els.userOverlay;
        const close = this.els.userClose;
        if (!toggle || !overlay) return;

        toggle.addEventListener('click', () => {
            overlay.style.display = 'flex';
            this.updateUserUI();
        });
        close.addEventListener('click', () => {
            overlay.style.display = 'none';
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });

        this.els.userLoginBtn.addEventListener('click', async () => {
            const username = this.els.userUsername.value.trim();
            const password = this.els.userPassword.value;
            if (!username) { this.showUserHint('请输入用户名'); return; }
            if (!Storage.userExists(username)) {
                this.showUserHint('用户不存在，请先注册');
                return;
            }
            if (Storage.checkPassword(username, password)) {
                Storage.setCurrentUser(username);
                if (password) Storage.setUserPassword(username, password);
                this.updateUserUI();
                await this.loadData();
                this.showUserHint('登录成功');
                setTimeout(() => overlay.style.display = 'none', 800);
            } else {
                this.showUserHint('密码错误');
            }
        });

        this.els.userRegisterBtn.addEventListener('click', async () => {
            const username = this.els.userUsername.value.trim();
            const password = this.els.userPassword.value;
            if (!username) { this.showUserHint('请输入用户名'); return; }
            if (!password) { this.showUserHint('请输入密码'); return; }
            if (Storage.userExists(username)) {
                this.showUserHint('用户名已存在');
                return;
            }
            Storage.setUserPassword(username, password);
            Storage.setCurrentUser(username);
            this.updateUserUI();
            await this.loadData();
            this.showUserHint('注册成功，已自动登录');
            setTimeout(() => overlay.style.display = 'none', 800);
        });

        this.els.userLogoutBtn.addEventListener('click', () => {
            Storage.setCurrentUser(null);
            Storage.clearUserPassword();
            this.updateUserUI();
            this.loadData();
            this.showUserHint('已登出');
            setTimeout(() => overlay.style.display = 'none', 600);
        });
    },

    showUserHint(msg) {
        this.els.userHint.textContent = msg;
        this.els.userHint.style.color = 'var(--accent)';
        setTimeout(() => {
            this.els.userHint.textContent = '';
        }, 3000);
    },

    updateUserUI() {
        const user = Storage.getCurrentUser();
        const display = this.els.userStatusDisplay;
        const logoutBtn = this.els.userLogoutBtn;
        if (user) {
            display.textContent = '已登录: ' + user + (Storage.getUserPassword() ? ' (加密)' : '');
            logoutBtn.style.display = 'inline-block';
        } else {
            display.textContent = '未登录 (公共空间)';
            logoutBtn.style.display = 'none';
        }
        const toggle = this.els.userToggle;
        if (toggle) {
            toggle.innerHTML = user ? '<i class="fas fa-user-check"></i>' : '<i class="fas fa-user-circle"></i>';
            toggle.style.borderColor = user ? 'var(--accent)' : 'var(--border-light)';
        }
    },

    // ---------- 设置面板 ----------
    setupSettings() {
        const toggle = this.els.settingsToggle;
        const overlay = this.els.settingsOverlay;
        const close = this.els.settingsClose;
        if (!toggle || !overlay) return;

        toggle.addEventListener('click', () => {
            overlay.style.display = 'flex';
            this.updateFolderStatus();
        });
        close.addEventListener('click', () => {
            overlay.style.display = 'none';
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.style.display = 'none';
        });

        this.els.settingThemeLight.addEventListener('click', () => {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            this.updateThemeIcon();
        });
        this.els.settingThemeDark.addEventListener('click', () => {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            this.updateThemeIcon();
        });
    },

    updateFolderStatus() {
        Storage.getFolderHandle().then(handle => {
            if (handle) {
                this.els.folderStatus.textContent = '已设置 (lanbitou)';
            } else {
                this.els.folderStatus.textContent = '未设置';
            }
        });
    },

    // ---------- 存储目录 ----------
    async setupFolder() {
        const btn = this.els.settingFolderBtn;
        if (!btn) return;
        btn.addEventListener('click', async () => {
            try {
                const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
                await Storage.setFolderHandle(handle);
                const data = await Storage.loadFromFolder();
                if (data && Array.isArray(data)) {
                    if (confirm('从目录加载数据，覆盖当前？')) {
                        Storage.saveAll(data);
                        this.renderWithDecryption();
                    }
                }
                this.updateFolderStatus();
                alert('存储目录设置成功 (已创建 lanbitou 子目录)');
            } catch (e) {
                if (e.code !== 'ERR_ABORTED') {
                    alert('设置目录失败：' + e.message);
                }
            }
        });
        // 自动加载
        const handle = await Storage.getFolderHandle();
        if (handle) {
            const data = await Storage.loadFromFolder();
            if (data && Array.isArray(data)) {
                Storage.saveAll(data);
                this.renderWithDecryption();
            }
        }
    },

    // ---------- 主题 ----------
    bindTheme() {
        const toggle = this.els.themeToggle;
        if (!toggle) return;
        const current = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', current);
        this.updateThemeIcon();
        toggle.addEventListener('click', () => {
            const now = document.documentElement.getAttribute('data-theme');
            const next = now === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
            this.updateThemeIcon();
        });
    },

    updateThemeIcon() {
        const toggle = this.els.themeToggle;
        if (!toggle) return;
        const now = document.documentElement.getAttribute('data-theme');
        toggle.innerHTML = now === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    },

    // ---------- 工具 ----------
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    sanitizeHtml(html) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        const scripts = div.querySelectorAll('script, iframe, object, embed');
        scripts.forEach(el => el.remove());
        return div.innerHTML;
    },

    // ---------- 灯箱 ----------
    openLightbox(src) {
        const lb = document.getElementById('lightbox');
        const img = lb.querySelector('img');
        img.src = src;
        lb.classList.add('active');
    },

    // ---------- 添加标签 ----------
    setupAddTag() {
        const btn = this.els.addTagBtn;
        const input = this.els.newTagInput;
        if (!btn || !input) return;

        const addTag = () => {
            const val = input.value.trim();
            if (!val) return;
            if (val.includes(',')) {
                alert('标签名不能包含逗号');
                return;
            }
            Storage.addTag(val);
            input.value = '';
            this.refreshTagsUI();
            // 自动添加到当前笔记的标签列表
            const tagInput = this.els.ideaTags;
            let current = tagInput.value.split(',').map(s => s.trim()).filter(Boolean);
            if (!current.includes(val)) {
                current.push(val);
                tagInput.value = current.join(', ');
            }
            // 重新渲染标签选择器
            this.refreshTagsUI();
        };

        btn.addEventListener('click', addTag);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
            }
        });
    }
};
