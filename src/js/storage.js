// storage.js – 数据持久化 + 加密 + 目录管理
const STORAGE_PREFIX = 'lanbitou_';

class Storage {
    static encryptionKey = null;

    // ---------- 用户管理 ----------
    static getCurrentUser() {
        return localStorage.getItem(STORAGE_PREFIX + 'user') || null;
    }

    static setCurrentUser(username) {
        if (username) {
            localStorage.setItem(STORAGE_PREFIX + 'user', username);
        } else {
            localStorage.removeItem(STORAGE_PREFIX + 'user');
            this.encryptionKey = null;
        }
    }

    static getUserKey() {
        const user = this.getCurrentUser();
        return user ? STORAGE_PREFIX + 'notes_' + user : STORAGE_PREFIX + 'notes_public';
    }

    static getTagsKey() {
        const user = this.getCurrentUser();
        return user ? STORAGE_PREFIX + 'tags_' + user : STORAGE_PREFIX + 'tags_public';
    }

    // ---------- 加密 ----------
    static async deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
        );
        return window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: enc.encode(salt),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    static async encryptContent(content, password) {
        if (!content || !password) return content;
        const salt = crypto.randomUUID();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this.deriveKey(password, salt);
        const enc = new TextEncoder();
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            enc.encode(content)
        );
        const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
        const saltBytes = new TextEncoder().encode(salt);
        combined.set(saltBytes, 0);
        combined.set(iv, saltBytes.length);
        combined.set(new Uint8Array(encrypted), saltBytes.length + iv.length);
        return btoa(String.fromCharCode(...combined));
    }

    static async decryptContent(encryptedData, password) {
        if (!encryptedData || !password) return encryptedData || '';
        try {
            const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
            const saltLen = 36;
            const saltBytes = combined.slice(0, saltLen);
            const salt = new TextDecoder().decode(saltBytes);
            const iv = combined.slice(saltLen, saltLen + 12);
            const data = combined.slice(saltLen + 12);
            const key = await this.deriveKey(password, salt);
            const decrypted = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                data
            );
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.warn('解密失败');
            return encryptedData;
        }
    }

    // ---------- 数据操作 (同步读取，异步加密存储) ----------
    static getAllSync() {
        const raw = localStorage.getItem(this.getUserKey());
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
    }

    static saveAll(notes) {
        localStorage.setItem(this.getUserKey(), JSON.stringify(notes));
        this.syncToFolder(notes);
    }

    static async add(note) {
        const notes = this.getAllSync();
        const tags = Array.isArray(note.tags) ? note.tags : (note.tags ? note.tags.split(',').map(s => s.trim()).filter(Boolean) : []);
        let content = note.content || '';
        const user = this.getCurrentUser();
        const password = this.getUserPassword();
        let encrypted = false;
        if (user && password && content) {
            content = await this.encryptContent(content, password);
            encrypted = true;
        }
        const newNote = {
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            title: note.title || '',
            content: content,
            tags: tags,
            visibility: note.visibility || 'private',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _encrypted: encrypted
        };
        notes.unshift(newNote);
        this.saveAll(notes);
        return newNote;
    }

    static async update(id, updates) {
        const notes = this.getAllSync();
        const index = notes.findIndex(n => n.id === id);
        if (index === -1) return null;
        const old = notes[index];
        const tags = updates.tags !== undefined
            ? (Array.isArray(updates.tags) ? updates.tags : (updates.tags ? updates.tags.split(',').map(s => s.trim()).filter(Boolean) : []))
            : old.tags;
        let content = updates.content !== undefined ? updates.content : old.content;
        const user = this.getCurrentUser();
        const password = this.getUserPassword();
        let encrypted = old._encrypted || false;
        if (user && password && content) {
            content = await this.encryptContent(content, password);
            encrypted = true;
        }
        notes[index] = {
            ...old,
            ...updates,
            tags: tags,
            content: content,
            _encrypted: encrypted,
            updatedAt: new Date().toISOString()
        };
        this.saveAll(notes);
        return notes[index];
    }

    static delete(id) {
        let notes = this.getAllSync();
        notes = notes.filter(n => n.id !== id);
        this.saveAll(notes);
        return notes;
    }

    static getById(id) {
        return this.getAllSync().find(n => n.id === id) || null;
    }

    // ---------- 用户密码 ----------
    static getUserPassword() {
        return sessionStorage.getItem(STORAGE_PREFIX + 'pass_' + this.getCurrentUser()) || null;
    }

    static setUserPassword(username, password) {
        if (!username) return;
        sessionStorage.setItem(STORAGE_PREFIX + 'pass_' + username, password);
        const key = STORAGE_PREFIX + 'pass_hash_' + username;
        localStorage.setItem(key, btoa(password));
    }

    static checkPassword(username, password) {
        if (!username) return false;
        const key = STORAGE_PREFIX + 'pass_hash_' + username;
        const stored = localStorage.getItem(key);
        if (!stored) return true;
        return stored === btoa(password);
    }

    static userExists(username) {
        if (!username) return false;
        const key = STORAGE_PREFIX + 'pass_hash_' + username;
        return localStorage.getItem(key) !== null;
    }

    static clearUserPassword() {
        const user = this.getCurrentUser();
        if (user) sessionStorage.removeItem(STORAGE_PREFIX + 'pass_' + user);
    }

    // ---------- 标签 ----------
    static getTags() {
        const data = localStorage.getItem(this.getTagsKey());
        if (data) {
            try { return JSON.parse(data); } catch {}
        }
        const defaults = ['工作', '生活', '创意', '学习', '灵感'];
        this.saveTags(defaults);
        return defaults;
    }

    static saveTags(tags) {
        localStorage.setItem(this.getTagsKey(), JSON.stringify(tags));
    }

    static addTag(tag) {
        const tags = this.getTags();
        if (!tags.includes(tag)) {
            tags.push(tag);
            this.saveTags(tags);
        }
        return tags;
    }

    // ---------- 工作区目录 ----------
    static async setFolderHandle(handle) {
        if (handle && handle.requestPermission) {
            await handle.requestPermission({ mode: 'readwrite' });
        }
        let targetHandle = handle;
        try {
            targetHandle = await handle.getDirectoryHandle('lanbitou', { create: true });
        } catch {
            // 若无法创建，则使用根目录
        }
        this.folderHandle = targetHandle;
        if (targetHandle) {
            localStorage.setItem(STORAGE_PREFIX + 'folder', 'true');
            const notes = this.getAllSync();
            await this.syncToFolder(notes);
        } else {
            localStorage.removeItem(STORAGE_PREFIX + 'folder');
            this.folderHandle = null;
        }
    }

    static async getFolderHandle() {
        if (this.folderHandle) return this.folderHandle;
        const has = localStorage.getItem(STORAGE_PREFIX + 'folder');
        if (has) {
            try {
                const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
                let target = handle;
                try {
                    target = await handle.getDirectoryHandle('lanbitou', { create: true });
                } catch {}
                this.folderHandle = target;
                return target;
            } catch (e) {
                localStorage.removeItem(STORAGE_PREFIX + 'folder');
                return null;
            }
        }
        return null;
    }

    static async syncToFolder(notes) {
        const handle = await this.getFolderHandle();
        if (!handle) return;
        try {
            const filename = this.getCurrentUser() ? `data_${this.getCurrentUser()}.json` : 'data_public.json';
            let fileHandle = await handle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            const json = JSON.stringify(notes, null, 2);
            await writable.write(json);
            await writable.close();
        } catch (e) {
            console.warn('同步到目录失败:', e);
        }
    }

    static async loadFromFolder() {
        const handle = await this.getFolderHandle();
        if (!handle) return null;
        try {
            const filename = this.getCurrentUser() ? `data_${this.getCurrentUser()}.json` : 'data_public.json';
            const fileHandle = await handle.getFileHandle(filename);
            const file = await fileHandle.getFile();
            const text = await file.text();
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    // ---------- 导入导出 ZIP ----------
    static async exportToZip() {
        const notes = this.getAllSync();
        const zip = new JSZip();
        const filename = this.getCurrentUser() ? `data_${this.getCurrentUser()}.json` : 'data_public.json';
        zip.file(filename, JSON.stringify(notes, null, 2));
        return await zip.generateAsync({ type: 'blob' });
    }

    static async importFromZip(zipBlob) {
        const zip = await JSZip.loadAsync(zipBlob);
        const files = zip.files;
        let jsonFile = null;
        for (let name in files) {
            if (name.startsWith('data_') && name.endsWith('.json')) {
                jsonFile = files[name];
                break;
            }
        }
        if (!jsonFile) throw new Error('未找到 data_*.json');
        const jsonText = await jsonFile.async('string');
        return JSON.parse(jsonText);
    }
}
