// ==================== IndexedDB 数据层 ====================
const DB_NAME = 'DoneListDB';
const DB_VERSION = 1;
let db = null;

const DEFAULT_CATEGORIES = [
    { name: '学习', icon: '📚', color: '#9DABBA' },
    { name: '兴趣爱好', icon: '🎨', color: '#C0A8B0' },
    { name: '陪伴家人朋友', icon: '👨‍👩‍👧', color: '#C9A88C' },
    { name: '家务', icon: '🏠', color: '#B0A4B8' },
    { name: '工作', icon: '💼', color: '#9BB4C7' },
    { name: '运动', icon: '🏃', color: '#9CAF88' },
];

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('categories')) {
                const catStore = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
                catStore.createIndex('name', 'name', { unique: false });
            }
            if (!db.objectStoreNames.contains('items')) {
                const itemStore = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
                itemStore.createIndex('date', 'date', { unique: false });
                itemStore.createIndex('category_id', 'category_id', { unique: false });
            }
        };
        req.onsuccess = async (e) => {
            db = e.target.result;
            await initCategories();
            resolve(db);
        };
        req.onerror = () => reject(req.error);
    });
}

async function initCategories() {
    const count = await countRecords('categories');
    if (count === 0) {
        const tx = db.transaction('categories', 'readwrite');
        const store = tx.objectStore('categories');
        for (const cat of DEFAULT_CATEGORIES) {
            store.add(cat);
        }
        await new Promise(r => { tx.oncomplete = r; });
    }
}

function countRecords(storeName) {
    return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
    });
}

function getAll(storeName) {
    return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result || []);
    });
}

function getByIndex(storeName, indexName, value) {
    return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).index(indexName).getAll(value);
        req.onsuccess = () => resolve(req.result || []);
    });
}

function addRecord(storeName, data) {
    return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).add(data);
        req.onsuccess = () => resolve(req.result);
    });
}

function updateRecord(storeName, id, data) {
    return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        data.id = id;
        tx.objectStore(storeName).put(data);
        tx.oncomplete = () => resolve();
    });
}

function deleteRecord(storeName, id) {
    return new Promise((resolve) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).delete(id);
        tx.oncomplete = () => resolve();
    });
}

// ==================== 工具函数 ====================

function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtTime(min) {
    if (min < 60) return `${min}分钟`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
}
function fmtShort(min) {
    if (min < 60) return `${min}min`;
    return `${(min / 60).toFixed(1)}h`;
}

// Toast
function toast(msg) {
    const div = document.createElement('div');
    div.textContent = msg;
    div.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;background:#5D534F;color:#fff;padding:10px 22px;border-radius:20px;font-size:0.9rem;box-shadow:0 4px 16px rgba(0,0,0,0.15);transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(div);
    setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 2000);
}

// ==================== 全局状态 ====================
let selectedDuration = 60; // 当前选中的快捷时长（分钟）
let selectedCategoryId = null;
let currentTab = 'tabToday';
let statChartInstance = null;

// ==================== 应用初始化 ====================
(async function init() {
    await openDB();
    updateHeader();
    await renderToday();
    setupNav();
    setupSheet();
    loadSettings();
})();

// ==================== 顶部栏 ====================
function updateHeader() {
    const now = new Date();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    document.getElementById('headerDate').textContent =
        `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${weekdays[now.getDay()]}`;
    updateStreak();
}

async function updateStreak() {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
        const ds = d.toISOString().slice(0, 10);
        const items = await getByIndex('items', 'date', ds);
        if (items.length > 0) {
            streak++;
            d.setDate(d.getDate() - 1);
        } else if (i === 0) {
            // 今天还没记录，继续往前查
            d.setDate(d.getDate() - 1);
        } else {
            break;
        }
    }
    document.getElementById('streakBadge').textContent = streak > 0 ? `🔥 ${streak}天` : '💪 开始记录';
}

// ==================== 底部导航 ====================
function setupNav() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
}

function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-page').forEach(p => p.classList.toggle('active', p.id === tabId));
    document.getElementById('fabBtn').style.display = tabId === 'tabToday' ? '' : 'none';
    if (tabId === 'tabToday') renderToday();
    if (tabId === 'tabStats') renderStats();
    if (tabId === 'tabSettings') renderSettings();
}

// ==================== 今天页 ====================
async function renderToday() {
    const items = await getByIndex('items', 'date', todayStr());
    const listEl = document.getElementById('itemList');
    const emptyEl = document.getElementById('emptyState');
    const summaryEl = document.getElementById('summaryItems');
    const hoursEl = document.getElementById('summaryHours');

    if (items.length === 0) {
        emptyEl.style.display = '';
        listEl.querySelectorAll('.item-card').forEach(c => c.remove());
        summaryEl.textContent = '0 件事';
        hoursEl.textContent = '0 小时';
        return;
    }

    emptyEl.style.display = 'none';
    const totalMin = items.reduce((s, i) => s + i.duration, 0);
    summaryEl.textContent = `${items.length} 件事`;
    hoursEl.textContent = fmtTime(totalMin);

    // 按创建时间倒序
    items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const cats = await getAll('categories');
    const catMap = {};
    cats.forEach(c => { catMap[c.id] = c; });

    let html = '';
    items.forEach((item, idx) => {
        const cat = catMap[item.category_id] || {};
        html += `
        <div class="item-card" style="animation-delay:${idx * 0.05}s" onclick="editItem(${item.id})">
            <div class="item-bar" style="background:${cat.color || '#9DABBA'}"></div>
            <div class="item-body">
                <div class="item-top">
                    <span class="item-title">${escHtml(item.title)}</span>
                    <span class="item-duration">${fmtTime(item.duration)}</span>
                </div>
                <div class="item-meta">
                    <span class="item-cat">${cat.icon || '📌'} ${cat.name || ''}</span>
                    ${item.note ? `<span class="item-note">· ${escHtml(item.note)}</span>` : ''}
                    <span class="item-time">· ${item.date}</span>
                </div>
            </div>
            <button class="item-delete" onclick="event.stopPropagation();deleteItem(${item.id})" title="删除">
                <i class="bi bi-x"></i>
            </button>
        </div>`;
    });

    // 保留 emptyState 外的卡片
    listEl.querySelectorAll('.item-card').forEach(c => c.remove());
    emptyEl.insertAdjacentHTML('afterend', html);
    updateHeader();
}

function escHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
}

// ==================== 添加/编辑 Sheet ====================
function setupSheet() {
    // 快捷时长按钮
    document.querySelectorAll('#durationChips .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#durationChips .chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const min = parseInt(chip.dataset.min);
            if (min === 0) {
                document.getElementById('customDuration').style.display = '';
                document.getElementById('customDuration').focus();
                selectedDuration = parseInt(document.getElementById('customDuration').value) || 30;
            } else {
                document.getElementById('customDuration').style.display = 'none';
                selectedDuration = min;
            }
        });
    });

    document.getElementById('customDuration').addEventListener('input', function () {
        selectedDuration = parseInt(this.value) || 0;
    });
}

async function showAddSheet() {
    document.getElementById('editId').value = '';
    document.getElementById('sheetTitle').textContent = '添加记录';
    document.getElementById('sheetSaveBtn').textContent = '保存';
    document.getElementById('itemTitle').value = '';
    document.getElementById('itemNote').value = '';
    document.getElementById('itemDate').value = todayStr();
    document.getElementById('customDuration').style.display = 'none';

    // 重置快捷时长为1小时
    document.querySelectorAll('#durationChips .chip').forEach(c => c.classList.remove('active'));
    document.querySelector('#durationChips .chip[data-min="60"]').classList.add('active');
    selectedDuration = 60;

    // 加载分类
    await renderCategoryChips();
    if (!selectedCategoryId) {
        const cats = await getAll('categories');
        if (cats.length > 0) selectedCategoryId = cats[0].id;
    }

    document.getElementById('sheetOverlay').classList.add('show');
    document.getElementById('bottomSheet').classList.add('show');
    setTimeout(() => document.getElementById('itemTitle').focus(), 300);
}

function hideAddSheet() {
    document.getElementById('sheetOverlay').classList.remove('show');
    document.getElementById('bottomSheet').classList.remove('show');
}

async function editItem(id) {
    const items = await getByIndex('items', 'date', todayStr());
    // 可能不在今天，需要全量搜索
    const allItems = await getAll('items');
    const item = allItems.find(i => i.id === id);
    if (!item) return;

    document.getElementById('editId').value = id;
    document.getElementById('sheetTitle').textContent = '编辑记录';
    document.getElementById('sheetSaveBtn').textContent = '更新';
    document.getElementById('itemTitle').value = item.title;
    document.getElementById('itemNote').value = item.note || '';
    document.getElementById('itemDate').value = item.date;
    document.getElementById('customDuration').style.display = 'none';

    selectedDuration = item.duration;
    selectedCategoryId = item.category_id;

    // 匹配快捷时长按钮
    document.querySelectorAll('#durationChips .chip').forEach(c => c.classList.remove('active'));
    const matchChip = document.querySelector(`#durationChips .chip[data-min="${item.duration}"]`);
    if (matchChip) {
        matchChip.classList.add('active');
    } else {
        document.querySelector('#durationChips .chip-custom').classList.add('active');
        document.getElementById('customDuration').style.display = '';
        document.getElementById('customDuration').value = item.duration;
    }

    await renderCategoryChips();
    document.getElementById('sheetOverlay').classList.add('show');
    document.getElementById('bottomSheet').classList.add('show');
}

async function saveItem() {
    const editId = document.getElementById('editId').value;
    const title = document.getElementById('itemTitle').value.trim();
    const date = document.getElementById('itemDate').value;
    const note = document.getElementById('itemNote').value.trim();

    if (!title) { toast('请输入标题'); return; }
    if (!selectedDuration || selectedDuration <= 0) { toast('请选择时长'); return; }
    if (!selectedCategoryId) { toast('请选择分类'); return; }

    const data = {
        title, duration: selectedDuration, category_id: selectedCategoryId,
        date, note, created_at: new Date().toISOString()
    };

    if (editId) {
        await updateRecord('items', parseInt(editId), data);
        toast('已更新');
    } else {
        await addRecord('items', data);
        toast('已记录 ✨');
    }

    hideAddSheet();
    await renderToday();
}

async function deleteItem(id) {
    if (!confirm('删除这条记录？')) return;
    await deleteRecord('items', id);
    toast('已删除');
    await renderToday();
}

// ==================== 分类选择 Chips ====================
async function renderCategoryChips() {
    const cats = await getAll('categories');
    const container = document.getElementById('categoryChips');
    let html = '';
    cats.forEach(c => {
        const sel = selectedCategoryId === c.id ? 'active' : '';
        html += `<button class="cat-chip ${sel}" data-cat="${c.id}" style="--cat-color:${c.color}">
            ${c.icon} ${c.name}</button>`;
    });
    container.innerHTML = html;

    container.querySelectorAll('.cat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            container.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedCategoryId = parseInt(chip.dataset.cat);
        });
    });
}

// ==================== 统计页 ====================
async function renderStats() {
    const period = document.querySelector('.segment-btn.active')?.dataset?.period || 'week';
    document.querySelectorAll('.segment-btn').forEach(b => {
        b.addEventListener('click', function () {
            document.querySelectorAll('.segment-btn').forEach(x => x.classList.remove('active'));
            this.classList.add('active');
            renderStats();
        });
    });

    const now = new Date();
    let startDate, endDate;
    if (period === 'week') {
        const day = now.getDay();
        startDate = new Date(now); startDate.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        endDate = new Date(now);
    } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now;
    } else {
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
    }
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const allItems = await getAll('items');
    const cats = await getAll('categories');

    // 筛选时间范围
    const filtered = allItems.filter(i => {
        const d = new Date(i.date);
        return d >= startDate && d <= endDate;
    });

    // 各分类时长
    const catMinutes = {};
    cats.forEach(c => { catMinutes[c.id] = 0; });
    filtered.forEach(i => { catMinutes[i.category_id] = (catMinutes[i.category_id] || 0) + i.duration; });

    // 更新概览
    const totalMin = filtered.reduce((s, i) => s + i.duration, 0);
    const uniqueDays = new Set(filtered.map(i => i.date)).size;
    document.getElementById('statDays').textContent = uniqueDays;
    document.getElementById('statTotal').textContent = fmtTime(totalMin);
    document.getElementById('statAvg').textContent = uniqueDays > 0 ? fmtShort(Math.round(totalMin / uniqueDays)) : '0min';

    // 柱状图
    const labels = cats.map(c => c.icon + ' ' + c.name);
    const data = cats.map(c => catMinutes[c.id] || 0);
    const colors = cats.map(c => c.color);
    const dataPresent = data.some(v => v > 0);

    if (statChartInstance) statChartInstance.destroy();
    const ctx = document.getElementById('statBarChart').getContext('2d');

    statChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors,
                borderRadius: 6,
                borderWidth: 0,
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => fmtTime(ctx.raw)
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: { callback: v => fmtShort(v) }
                }
            }
        }
    });

    // 热力图
    renderHeatmap(filtered, startDate);
}

function renderHeatmap(items, startDate) {
    const container = document.getElementById('heatmapContainer');
    // 按日期聚合
    const dateMap = {};
    items.forEach(i => {
        dateMap[i.date] = (dateMap[i.date] || 0) + i.duration;
    });

    const maxMin = Math.max(...Object.values(dateMap), 1);

    // 生成当月日历网格
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 0).getDay(); // 上月最后一天是周几

    let html = '<div class="heatmap-grid">';
    const dayHeaders = ['一', '二', '三', '四', '五', '六', '日'];
    dayHeaders.forEach(d => { html += `<div class="heatmap-header">${d}</div>`; });

    // 填充月初空白
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="heatmap-cell empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const mins = dateMap[ds] || 0;
        const intensity = mins > 0 ? Math.max(0.15, mins / maxMin) : 0;
        const bg = mins > 0 ? `rgba(158,175,136,${intensity.toFixed(2)})` : 'rgba(0,0,0,0.03)';
        html += `<div class="heatmap-cell" style="background:${bg}" title="${ds}: ${fmtTime(mins)}">${d}</div>`;
    }

    html += '</div>';
    html += '<div class="heatmap-legend"><span>少</span><span class="legend-bar"></span><span>多</span></div>';
    container.innerHTML = html;
}

// ==================== 设置页 ====================
async function renderSettings() {
    const cats = await getAll('categories');
    const listEl = document.getElementById('categoryList');
    let html = '<div class="list-group list-group-flush">';
    cats.forEach(c => {
        html += `
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
                <span style="font-size:1.2em">${c.icon}</span>
                <span class="ms-2">${escHtml(c.name)}</span>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-secondary me-1" onclick="editCategory(${c.id},'${escHtml(c.name)}','${c.icon}','${c.color}')">
                    <i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteCategory(${c.id})">
                    <i class="bi bi-trash"></i></button>
            </div>
        </div>`;
    });
    html += '</div>';
    listEl.innerHTML = html;
}

function showAddCategory() {
    document.getElementById('catEditId').value = '';
    document.getElementById('catModalTitle').textContent = '添加分类';
    document.getElementById('catName').value = '';
    document.getElementById('catIcon').value = '📌';
    document.getElementById('catColor').value = '#9DABBA';
    new bootstrap.Modal(document.getElementById('catModal')).show();
}

function editCategory(id, name, icon, color) {
    document.getElementById('catEditId').value = id;
    document.getElementById('catModalTitle').textContent = '编辑分类';
    document.getElementById('catName').value = name;
    document.getElementById('catIcon').value = icon;
    document.getElementById('catColor').value = color;
    new bootstrap.Modal(document.getElementById('catModal')).show();
}

async function saveCategory() {
    const editId = document.getElementById('catEditId').value;
    const name = document.getElementById('catName').value.trim();
    const icon = document.getElementById('catIcon').value.trim() || '📌';
    const color = document.getElementById('catColor').value;

    if (!name) { toast('请输入分类名称'); return; }

    if (editId) {
        await updateRecord('categories', parseInt(editId), { name, icon, color });
    } else {
        await addRecord('categories', { name, icon, color });
    }
    bootstrap.Modal.getInstance(document.getElementById('catModal')).hide();
    toast('分类已保存');
    await renderSettings();
}

async function deleteCategory(id) {
    if (!confirm('删除分类？已有记录不受影响。')) return;
    await deleteRecord('categories', id);
    toast('已删除');
    await renderSettings();
}

// ==================== 提醒 ====================
function loadSettings() {
    const reminderOn = localStorage.getItem('donelist_reminder') === 'true';
    const reminderTime = localStorage.getItem('donelist_reminder_time') || '21:00';
    document.getElementById('reminderToggle').checked = reminderOn;
    document.getElementById('reminderTime').value = reminderTime;
    document.getElementById('reminderTimeRow').style.display = reminderOn ? '' : 'none';
    if (reminderOn) scheduleReminder(reminderTime);
}

function toggleReminder() {
    const on = document.getElementById('reminderToggle').checked;
    localStorage.setItem('donelist_reminder', on);
    document.getElementById('reminderTimeRow').style.display = on ? '' : 'none';
    if (on) {
        scheduleReminder(document.getElementById('reminderTime').value);
    } else {
        cancelReminder();
    }
}

function saveReminderTime() {
    const time = document.getElementById('reminderTime').value;
    localStorage.setItem('donelist_reminder_time', time);
    scheduleReminder(time);
}

let reminderTimer = null;
function scheduleReminder(time) {
    cancelReminder();
    const [h, m] = time.split(':').map(Number);
    const now = new Date();
    const target = new Date(now);
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    const delay = target - now;
    reminderTimer = setTimeout(() => {
        // 用 Notification API
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Done List', { body: '今天做了什么？花1分钟记录一下吧 ✨', icon: 'static/icon-192.png' });
        }
        scheduleReminder(time); // 明天继续
    }, Math.min(delay, 2147483647)); // setTimeout 最大延迟

    // 请求通知权限
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function cancelReminder() {
    if (reminderTimer) { clearTimeout(reminderTimer); reminderTimer = null; }
}

// ==================== 导出/导入 ====================
async function exportData() {
    const items = await getAll('items');
    const categories = await getAll('categories');
    const data = { version: 1, exported_at: new Date().toISOString(), categories, items };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DoneList_备份_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('导出成功');
}

function importData() {
    document.getElementById('importFile').click();
}

async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.categories || !data.items) throw new Error('Invalid format');

        // 清空现有数据
        const tx1 = db.transaction('categories', 'readwrite');
        tx1.objectStore('categories').clear();
        await new Promise(r => { tx1.oncomplete = r; });

        const tx2 = db.transaction('items', 'readwrite');
        tx2.objectStore('items').clear();
        await new Promise(r => { tx2.oncomplete = r; });

        // 导入
        for (const c of data.categories) await addRecord('categories', c);
        for (const i of data.items) await addRecord('items', i);

        toast(`导入成功：${data.categories.length}个分类，${data.items.length}条记录`);
        if (currentTab === 'tabToday') renderToday();
        if (currentTab === 'tabSettings') renderSettings();
    } catch (e) {
        toast('导入失败：文件格式不正确');
    }
    event.target.value = '';
}

// ==================== 快捷键：回车保存 ====================
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('sheetOverlay').classList.contains('show')) {
        e.preventDefault();
        saveItem();
    }
});
