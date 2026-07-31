// app.js – 主程序
document.addEventListener('DOMContentLoaded', () => {
    UI.init();

    function refresh() {
        UI.renderWithDecryption();
    }

    // ---------- 筛选 ----------
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            UI.currentFilter = tab.dataset.filter;
            UI.selectedTags = [];
            refresh();
        });
    });

    // ---------- 搜索 ----------
    const searchInput = UI.els.searchInput;
    const clearSearch = UI.els.clearSearch;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            UI.currentKeyword = searchInput.value;
            if (clearSearch) clearSearch.style.display = UI.currentKeyword ? 'block' : 'none';
            refresh();
        });
    }
    if (clearSearch) {
        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            UI.currentKeyword = '';
            clearSearch.style.display = 'none';
            refresh();
            searchInput.focus();
        });
    }

    // ---------- 添加 ----------
    const fabAdd = UI.els.fabAdd;
    if (fabAdd) {
        fabAdd.addEventListener('click', () => {
            UI.showEditor();
        });
    }

    // ---------- 编辑器取消 ----------
    if (UI.els.editorCancel) {
        UI.els.editorCancel.addEventListener('click', () => {
            UI.hideEditor();
        });
    }

    // ---------- 表单提交 ----------
    if (UI.els.form) {
        UI.els.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editId = UI.els.editId.value;
            const title = UI.els.ideaTitle.value.trim();
            const content = UI.els.ideaContent.innerHTML.trim();
            const tagsRaw = UI.els.ideaTags.value.trim();
            const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
            const visibility = UI.els.ideaVisibility.value;

            if (!title || !content) {
                alert('标题和内容不能为空');
                return;
            }
            const noteData = { title, content, tags, visibility };
            if (editId) {
                await Storage.update(editId, noteData);
            } else {
                await Storage.add(noteData);
            }
            UI.hideEditor();
        });
    }

    // ---------- 导出 ----------
    if (UI.els.exportBtn) {
        UI.els.exportBtn.addEventListener('click', async () => {
            try {
                const zipBlob = await Storage.exportToZip();
                saveAs(zipBlob, `lanbitou_${new Date().toISOString().slice(0,10)}.zip`);
            } catch (err) {
                alert('导出失败：' + err.message);
            }
        });
    }

    // ---------- 导入 ----------
    if (UI.els.importBtn && UI.els.fileInput) {
        UI.els.importBtn.addEventListener('click', () => UI.els.fileInput.click());
        UI.els.fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const imported = await Storage.importFromZip(file);
                if (Array.isArray(imported)) {
                    if (confirm(`导入 ${imported.length} 条数据，覆盖当前？`)) {
                        Storage.saveAll(imported);
                    } else {
                        const current = Storage.getAllSync();
                        const ids = new Set(current.map(n => n.id));
                        const merged = [...current, ...imported.filter(n => !ids.has(n.id))];
                        Storage.saveAll(merged);
                    }
                    UI.renderWithDecryption();
                }
            } catch (err) {
                alert('导入失败：' + err.message);
            }
            e.target.value = '';
        });
    }

    // ---------- 删除事件 ----------
    document.addEventListener('delete', (e) => {
        const [id] = e.detail;
        Storage.delete(id);
        UI.renderWithDecryption();
    });

    // ---------- ESC ----------
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (UI.isEditing) {
                UI.hideEditor();
            }
            if (UI.els.customConfirm.style.display === 'block') {
                UI.els.customConfirm.style.display = 'none';
                UI.confirmCallback = null;
            }
            if (UI.els.settingsOverlay.style.display === 'flex') {
                UI.els.settingsOverlay.style.display = 'none';
            }
            if (UI.els.previewOverlay.style.display === 'flex') {
                UI.els.previewOverlay.style.display = 'none';
            }
            if (UI.els.userOverlay.style.display === 'flex') {
                UI.els.userOverlay.style.display = 'none';
            }
        }
    });

    // ---------- 自动同步 ----------
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            Storage.syncToFolder(Storage.getAllSync());
        }
    });
    window.addEventListener('beforeunload', () => {
        Storage.syncToFolder(Storage.getAllSync());
    });
});
