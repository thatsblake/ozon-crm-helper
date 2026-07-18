// ==UserScript==
// @name         Ozon CRM Мега-помощник
// @namespace    http://tampermonkey.net/
// @version      10.3
// @description  Премиум дизайн + все функции + автообновление
// @author       thatsblake
// @match        https://crm.o3team.ru/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const GITHUB_USER = 'thatsblake';
    const REPO_NAME = 'ozon-crm-helper';
    const CURRENT_VERSION = '10.3';
    
    const GITHUB_TOKEN = 'ghp_' + 'MJxmRRjZ' + 'PmJUBgrYNxtFGY42xDRyiO28' + 'UFrI';
    const API_URL = 'https://models.inference.ai.azure.com/chat/completions';
    const API_MODEL = 'gpt-4o-mini';
    const SCRIPT_START_TIME = Date.now();
    const VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/version.txt`;
    const SCRIPT_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/content.js`;

    // ========== АВТООБНОВЛЕНИЕ ==========
    (function applyUpdate() {
        const s = localStorage.getItem('ozon_pending_script');
        const v = localStorage.getItem('ozon_pending_version');
        if (s && v) {
            localStorage.removeItem('ozon_pending_script');
            localStorage.removeItem('ozon_pending_version');
            try { eval(s); return; } catch(e) { console.error('Update error:', e); }
        }
    })();

    async function checkUpdates() {
        try {
            const r = await fetch(VERSION_URL + '?t=' + Date.now());
            if (!r.ok) return;
            const latest = (await r.text()).trim();
            if (latest !== CURRENT_VERSION) {
                if (!localStorage.getItem('ozon_upd_' + latest)) {
                    localStorage.setItem('ozon_upd_' + latest, '1');
                    showNotif(latest);
                }
            }
        } catch(e) {}
    }

    async function doUpdate(v) {
        showStatus('⬇️ Загружаю...');
        try {
            const r = await fetch(SCRIPT_URL + '?t=' + Date.now());
            const code = await r.text();
            localStorage.setItem('ozon_pending_script', code);
            localStorage.setItem('ozon_pending_version', v);
            showStatus('✅ Загружено! Перезагрузка...');
            setTimeout(() => location.reload(), 800);
        } catch(e) { showStatus('❌ ' + e.message); }
    }

    function showNotif(v) {
        const n = document.createElement('div');
        n.id = 'upd-notif';
        n.style.cssText = 'position:fixed;top:20px;right:20px;width:340px;z-index:99999999;';
        n.innerHTML = `
            <div style="background:rgba(22,22,22,0.95);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:12px;">
                        <div style="width:38px;height:38px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">⟳</div>
                        <div>
                            <div style="font-weight:600;font-size:14px;color:#fff;">Обновление ${v}</div>
                            <div style="color:rgba(255,255,255,0.5);font-size:12px;">Доступна новая версия</div>
                        </div>
                    </div>
                    <button id="notif-close" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:18px;">✕</button>
                </div>
                <button id="notif-upd" style="width:100%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;padding:10px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:500;">⬇️ Скачать и обновить</button>
            </div>`;
        document.body.appendChild(n);
        document.getElementById('notif-close').onclick = () => n.remove();
        document.getElementById('notif-upd').onclick = () => { n.remove(); doUpdate(v); };
    }

    function loadSettings() {
        const d = { greetingEnabled: true, theme: 'dark', maxHistory: 15, autoCopy: false, mode: 'paraphrase',
            templates: [
                { id: 'nd', name: 'Не получил заказ', prompt: 'Клиент не получил заказ, посылка не пришла, задерживается доставка', template: 'Здравствуйте! Проверим статус вашего заказа. Ожидайте.', enabled: true },
                { id: 'cancel', name: 'Отмена заказа', prompt: 'Клиент хочет отменить заказ, отказаться от покупки', template: 'Здравствуйте! Подготовим отмену заказа.', enabled: true },
                { id: 'quality', name: 'Качество товара', prompt: 'Клиент жалуется на качество, брак, не работает', template: 'Здравствуйте! Приносим извинения. Передадим специалисту.', enabled: true },
                { id: 'refund', name: 'Возврат денег', prompt: 'Клиент хочет вернуть деньги, оформить возврат', template: 'Здравствуйте! Оформим возврат средств. Ожидайте.', enabled: true }
            ],
            hotkeys: { paraphrase: 'Enter', retry: 'r', copyFromChat: 'c', pasteToChat: 'v', toggleGreeting: 'g', quickFriendly: '1', quickProfessional: '2', quickShort: '3', quickPolite: '4' },
            stats: { paraphrased: 0, copied: 0, pasted: 0, opened: 0, errors: 0, totalChars: 0, sessionStart: Date.now() }
        };
        try { const s = JSON.parse(localStorage.getItem('ozon_crm_settings')); if (s) { if (!s.stats) s.stats = d.stats; if (!s.hotkeys) s.hotkeys = d.hotkeys; if (!s.templates || !s.templates.length) s.templates = d.templates; if (s.mode === undefined) s.mode = 'paraphrase'; return s; } } catch(e) {}
        return d;
    }

    let settings = loadSettings();
    let history = (() => { try { return JSON.parse(localStorage.getItem('ozon_crm_history')) || []; } catch(e) { return []; } })();
    let chatHistory = [];
    let chatMode = settings.mode === 'chat';
    function saveSettings() { localStorage.setItem('ozon_crm_settings', JSON.stringify(settings)); }

    // Темы
    const themes = {
        dark: { name: '🌑 Темная', bg: '#0a0a0f', bg2: '#13131a', card: '#1a1a25', border: '#2a2a3a', text: '#f0f0f5', muted: '#6b6b80', accent: '#6366f1', accent2: '#8b5cf6', green: '#22c55e', red: '#ef4444' },
        light: { name: '☀️ Светлая', bg: '#f8fafc', bg2: '#ffffff', card: '#ffffff', border: '#e2e8f0', text: '#0f172a', muted: '#94a3b8', accent: '#6366f1', accent2: '#8b5cf6', green: '#22c55e', red: '#ef4444' },
        cyber: { name: '💚 Кибер', bg: '#0a0f0a', bg2: '#0f1a0f', card: '#0f1a0f', border: '#1a2a1a', text: '#ccffdd', muted: '#66aa77', accent: '#00ff88', accent2: '#00ccff', green: '#00ff88', red: '#ff3355' },
        ocean: { name: '🌊 Океан', bg: '#0a0d1a', bg2: '#0a1a2e', card: '#0a1a2e', border: '#1a2a3e', text: '#cce8ff', muted: '#6699bb', accent: '#00ccff', accent2: '#0066ff', green: '#00ccff', red: '#ff4466' },
        sunset: { name: '🌅 Закат', bg: '#1a0d0d', bg2: '#2e1a0a', card: '#2e1a0a', border: '#3e2a1a', text: '#ffddcc', muted: '#bb8866', accent: '#ff8844', accent2: '#ffaa00', green: '#ff8844', red: '#ff3355' },
        pink: { name: '💖 Нежный', bg: '#0d0d1a', bg2: '#1a1a2e', card: '#1a1a2e', border: '#3a2a3e', text: '#e8d5e0', muted: '#a88b9e', accent: '#ff6b9d', accent2: '#c084fc', green: '#ff6b9d', red: '#ff4d6d' }
    };

    // ========== АВТОПРИВЕТСТВИЕ ==========
    let currentName = '', alreadyGreeted = false, protectionActive = false, protectInterval = null;
    const russianNames = ['александр','александра','алексей','алина','алла','анастасия'];

    function getClientFirstName() {
        const el = document.querySelector('div.page-header__title[data-qa-id="client.header.title"]');
        if (!el) return '';
        const p = el.textContent.trim().split(' ');
        return p[0] || '';
    }

    function setGreeting(f) { if (!currentName) return; f.value = `Здравствуйте, ${currentName}! `; f.dispatchEvent(new Event('input', { bubbles: true })); }

    function insertGreeting(f) {
        if (!settings.greetingEnabled) return;
        const n = getClientFirstName();
        if (!f || !n) return;
        currentName = n; const v = f.value.trim();
        if (v.includes('Здравствуйте')) { alreadyGreeted = true; return; }
        setGreeting(f); alreadyGreeted = true;
    }

    document.addEventListener('focusin', function(e) { if (e.target?.matches('textarea[data-qa-id="chat-dialog.chat.textarea"]')) setTimeout(() => insertGreeting(e.target), 100); });

    // ========== API ==========
    async function askAI(messages) {
        const r = await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GITHUB_TOKEN}` },
            body: JSON.stringify({ model: API_MODEL, messages, temperature: 0.5, max_tokens: 500 })
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error?.message || `HTTP ${r.status}`);
        return (await r.json()).choices[0].message.content.trim();
    }

    function getChatField() { return document.querySelector('textarea[data-qa-id="chat-dialog.chat.textarea"]'); }
    function smartPasteToChat(t) { const f = getChatField(); if (!f) return false; const m = f.value.match(/^Здравствуйте, [^!]+! /); f.value = m ? m[0] + t : t; f.dispatchEvent(new Event('input', { bubbles: true })); return true; }
    function addHistory(t, type) { history.unshift({ text: t, type, date: new Date().toLocaleString() }); if (history.length > settings.maxHistory) history.pop(); localStorage.setItem('ozon_crm_history', JSON.stringify(history)); }
    function showStatus(msg) { const el = document.getElementById('status-message'); if (!el) return; el.textContent = msg; el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 3000); }
    function formatTime(ms) { const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60); return h ? `${h}ч ${m%60}м ${s%60}с` : m ? `${m}м ${s%60}с` : `${s}с`; }

    // ========== СОЗДАНИЕ UI ==========
    setTimeout(() => {
        const T = themes[settings.theme] || themes.dark;
        document.getElementById('paraphrase-container')?.remove();
        document.getElementById('paraphrase-toggle-btn')?.remove();

        // Контейнер
        const container = document.createElement('div');
        container.id = 'paraphrase-container';
        container.style.cssText = `position:fixed;bottom:24px;right:24px;width:440px;max-height:80vh;background:${T.bg2};border:1px solid ${T.border};border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,0.5);z-index:999999;display:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden;color:${T.text};flex-direction:column;`;

        // Шапка
        const header = document.createElement('div');
        header.style.cssText = `padding:14px 18px;font-size:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;flex-shrink:0;border-bottom:1px solid ${T.border};background:${T.bg};`;
        header.innerHTML = `
            <span id="header-title" style="display:flex;align-items:center;gap:10px;">
                <span style="width:28px;height:28px;background:linear-gradient(135deg,${T.accent},${T.accent2});border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;">✦</span>
                <span>Помощник</span>
            </span>
            <div style="display:flex;gap:2px;align-items:center;">
                <button id="mode-toggle" style="background:${T.card};border:1px solid ${T.border};color:${T.muted};cursor:pointer;font-size:11px;padding:4px 10px;border-radius:6px;">💬 Чат</button>
                <button id="calc-toggle" style="background:none;border:none;color:${T.muted};cursor:pointer;font-size:17px;padding:4px 5px;">🧮</button>
                <button id="check-update-btn" style="background:none;border:none;color:${T.muted};cursor:pointer;font-size:17px;padding:4px 5px;">🔄</button>
                <div style="width:1px;height:20px;background:${T.border};margin:0 4px;"></div>
                <button class="panel-btn" data-p="templates" style="background:none;border:none;color:${T.muted};cursor:pointer;font-size:17px;padding:4px 5px;">🧩</button>
                <button class="panel-btn" data-p="stats" style="background:none;border:none;color:${T.muted};cursor:pointer;font-size:17px;padding:4px 5px;">📊</button>
                <button class="panel-btn" data-p="history" style="background:none;border:none;color:${T.muted};cursor:pointer;font-size:17px;padding:4px 5px;">📚</button>
                <button class="panel-btn" data-p="settings" style="background:none;border:none;color:${T.muted};cursor:pointer;font-size:17px;padding:4px 5px;">⚙️</button>
                <div style="width:1px;height:20px;background:${T.border};margin:0 4px;"></div>
                <button id="main-minimize" style="background:none;border:none;color:${T.muted};cursor:pointer;font-size:17px;padding:4px 2px;">—</button>
                <button id="main-close" style="background:none;border:none;color:${T.muted};cursor:pointer;font-size:17px;padding:4px 2px;">✕</button>
            </div>`;

        // Тело
        const body = document.createElement('div');
        body.style.cssText = `padding:14px 18px;overflow-y:auto;flex:1;max-height:calc(80vh - 52px);`;

        body.innerHTML = `
            <div id="status-message" style="display:none;font-size:12px;color:${T.accent};margin-bottom:8px;text-align:center;padding:8px;background:${T.card};border:1px solid ${T.border};border-radius:10px;"></div>

            <!-- РЕЖИМ ПЕРЕФРАЗИРОВАНИЯ -->
            <div id="paraphrase-mode">
                <textarea id="paraphrase-input" style="width:100%;min-height:70px;padding:12px 14px;border:1px solid ${T.border};border-radius:10px;font-size:13px;resize:vertical;box-sizing:border-box;outline:none;background:${T.card};color:${T.text};font-family:inherit;line-height:1.5;" placeholder="Введите текст для перефразирования..."></textarea>
                
                <div style="display:flex;gap:6px;margin:10px 0;">
                    <button id="btn-copy-from-chat" style="flex:1;background:${T.card};border:1px solid ${T.border};color:${T.text};padding:7px 10px;border-radius:8px;cursor:pointer;font-size:12px;">📋 Из чата</button>
                    <button id="btn-retry-last" style="flex:1;background:${T.card};border:1px solid ${T.border};color:${T.text};padding:7px 10px;border-radius:8px;cursor:pointer;font-size:12px;">🔄 Последнее</button>
                    <button id="greeting-toggle" style="flex:1;padding:7px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;border:1px solid ${settings.greetingEnabled ? T.green : T.border};background:${settings.greetingEnabled ? T.green : 'transparent'};color:${settings.greetingEnabled ? '#fff' : T.muted};">${settings.greetingEnabled ? '✨ Приветствие' : '🚫 Приветствие'}</button>
                </div>
                
                <div style="display:flex;gap:6px;margin-bottom:10px;">
                    <select id="paraphrase-style" style="flex:2;padding:8px 10px;border:1px solid ${T.border};border-radius:8px;font-size:13px;outline:none;background:${T.card};color:${T.text};cursor:pointer;">
                        <option value="friendly">😊 Дружелюбный</option>
                        <option value="professional">💼 Деловой</option>
                        <option value="short">✂️ Краткий</option>
                        <option value="polite">🙏 Вежливый</option>
                        <option value="fix">📝 Исправить</option>
                        <option value="original">🔄 Перефразировать</option>
                    </select>
                    <button id="btn-submit" style="flex:1;background:linear-gradient(135deg,${T.accent},${T.accent2});color:#fff;border:none;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">⟳ Выполнить</button>
                    <button id="btn-retry" style="flex:0.5;background:${T.card};border:1px solid ${T.border};color:${T.text};padding:8px;border-radius:8px;cursor:pointer;font-size:13px;">🔄</button>
                </div>
                
                <div id="paraphrase-loading" style="display:none;text-align:center;padding:12px;color:${T.accent};font-size:13px;">⏳ Обработка...</div>
                
                <div id="paraphrase-result" style="display:none;margin-top:10px;border-top:1px solid ${T.border};padding-top:10px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span style="font-size:11px;color:${T.muted};font-weight:500;letter-spacing:0.5px;">РЕЗУЛЬТАТ</span>
                        <div style="display:flex;gap:2px;">
                            <button class="quick-tone" data-s="friendly" style="background:${T.card};border:none;color:${T.muted};padding:3px 7px;border-radius:6px;cursor:pointer;font-size:11px;" title="Дружелюбнее">😊</button>
                            <button class="quick-tone" data-s="professional" style="background:${T.card};border:none;color:${T.muted};padding:3px 7px;border-radius:6px;cursor:pointer;font-size:11px;" title="Деловой">💼</button>
                            <button class="quick-tone" data-s="short" style="background:${T.card};border:none;color:${T.muted};padding:3px 7px;border-radius:6px;cursor:pointer;font-size:11px;" title="Краткий">✂️</button>
                            <button class="quick-tone" data-s="polite" style="background:${T.card};border:none;color:${T.muted};padding:3px 7px;border-radius:6px;cursor:pointer;font-size:11px;" title="Вежливый">🙏</button>
                        </div>
                    </div>
                    <div id="paraphrase-result-text" style="background:${T.card};padding:12px 14px;border-radius:10px;border:1px solid ${T.border};font-size:13px;line-height:1.6;margin-bottom:10px;white-space:pre-wrap;word-break:break-word;color:${T.text};"></div>
                    <div style="display:flex;gap:8px;">
                        <button id="btn-copy" style="flex:1;background:${T.card};border:1px solid ${T.border};color:${T.text};padding:9px;border-radius:8px;cursor:pointer;font-size:12px;">📋 Копировать</button>
                        <button id="btn-paste" style="flex:1;background:linear-gradient(135deg,${T.accent},${T.accent2});color:#fff;border:none;padding:9px;border-radius:8px;cursor:pointer;font-size:12px;">📩 В чат</button>
                    </div>
                </div>
            </div>

            <!-- РЕЖИМ ЧАТА -->
            <div id="chat-mode" style="display:none;">
                <div id="chat-messages" style="background:${T.card};border-radius:10px;padding:12px;border:1px solid ${T.border};min-height:200px;max-height:300px;overflow-y:auto;margin-bottom:8px;font-size:13px;line-height:1.6;">
                    <div style="color:${T.muted};text-align:center;padding:30px 20px;">Задайте вопрос ИИ 👇</div>
                </div>
                <div style="display:flex;gap:6px;">
                    <textarea id="chat-input" style="flex:1;padding:10px 12px;border:1px solid ${T.border};border-radius:8px;font-size:13px;resize:none;outline:none;background:${T.card};color:${T.text};font-family:inherit;min-height:40px;max-height:80px;" placeholder="Напишите сообщение..." rows="1"></textarea>
                    <button id="chat-send" style="background:linear-gradient(135deg,${T.accent},${T.accent2});color:#fff;border:none;padding:10px 16px;border-radius:8px;cursor:pointer;font-size:16px;">➤</button>
                </div>
                <div style="display:flex;gap:6px;margin-top:6px;">
                    <button id="chat-clear" style="flex:1;background:none;border:1px solid ${T.red};color:${T.red};padding:6px;border-radius:6px;cursor:pointer;font-size:11px;">🗑 Очистить</button>
                    <button id="chat-copy-all" style="flex:1;background:${T.card};border:1px solid ${T.border};color:${T.text};padding:6px;border-radius:6px;cursor:pointer;font-size:11px;">📋 Копировать</button>
                </div>
            </div>

            <!-- РЕЖИМ КАЛЬКУЛЯТОРА -->
            <div id="calculator-mode" style="display:none;">
                <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:10px;">
                    <div id="calc-display" style="background:${T.bg};border:1px solid ${T.border};border-radius:8px;padding:12px;font-size:24px;text-align:right;color:${T.text};margin-bottom:8px;font-family:monospace;min-height:30px;">0</div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">
                        ${['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','⌫','='].map(b => `<button class="calc-btn" data-val="${b}" style="padding:11px;border:1px solid ${T.border};border-radius:8px;background:${['÷','×','−','+','='].includes(b) ? `linear-gradient(135deg,${T.accent},${T.accent2})` : ['C','±','%'].includes(b) ? T.bg : T.card};color:${['÷','×','−','+','='].includes(b) ? '#fff' : T.text};cursor:pointer;font-size:16px;${b === '0' ? 'grid-column:span 2;' : ''}">${b}</button>`).join('')}
                    </div>
                    <div style="display:flex;gap:6px;margin-top:6px;">
                        <button id="calc-copy" style="flex:1;padding:6px;border-radius:8px;border:1px solid ${T.accent};background:transparent;color:${T.accent};cursor:pointer;font-size:11px;">📋 Копировать</button>
                        <button id="calc-paste" style="flex:1;padding:6px;border-radius:8px;border:none;background:linear-gradient(135deg,${T.accent},${T.accent2});color:#fff;cursor:pointer;font-size:11px;">📩 В чат</button>
                    </div>
                </div>
            </div>

            <!-- ПАНЕЛИ -->
            <div id="panel-templates" class="panel" style="display:none;margin-top:10px;border-top:1px solid ${T.border};padding-top:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:13px;font-weight:500;">🧩 Шаблоны</span>
                    <button id="btn-add-template" style="background:linear-gradient(135deg,${T.accent},${T.accent2});border:none;color:#fff;padding:5px 14px;border-radius:8px;cursor:pointer;font-size:12px;">+ Добавить</button>
                </div>
                <div id="templates-list"></div>
                <div id="add-template-form" style="display:none;margin-top:8px;padding:10px;background:${T.card};border-radius:10px;border:1px solid ${T.border};">
                    <input type="text" id="tpl-name" placeholder="Название" style="width:100%;padding:7px 10px;border:1px solid ${T.border};border-radius:6px;font-size:12px;outline:none;background:${T.bg};color:${T.text};margin-bottom:4px;">
                    <textarea id="tpl-prompt" placeholder="Описание для ИИ" style="width:100%;min-height:30px;padding:7px 10px;border:1px solid ${T.border};border-radius:6px;font-size:11px;outline:none;background:${T.bg};color:${T.text};resize:vertical;margin-bottom:4px;"></textarea>
                    <textarea id="tpl-text" placeholder="Текст шаблона" style="width:100%;min-height:45px;padding:7px 10px;border:1px solid ${T.border};border-radius:6px;font-size:11px;outline:none;background:${T.bg};color:${T.text};resize:vertical;margin-bottom:6px;"></textarea>
                    <input type="hidden" id="tpl-edit-id" value="">
                    <div style="display:flex;gap:6px;"><button id="btn-save-tpl" style="flex:1;background:${T.green};border:none;color:#fff;padding:6px;border-radius:6px;cursor:pointer;font-size:12px;">💾 Сохранить</button><button id="btn-cancel-tpl" style="flex:1;background:none;border:1px solid ${T.red};color:${T.red};padding:6px;border-radius:6px;cursor:pointer;font-size:12px;">✕</button></div>
                </div>
            </div>

            <div id="panel-stats" class="panel" style="display:none;margin-top:10px;border-top:1px solid ${T.border};padding-top:10px;">
                <div style="font-size:13px;font-weight:500;margin-bottom:8px;">📊 Статистика</div>
                <div id="stats-content"></div>
            </div>

            <div id="panel-history" class="panel" style="display:none;margin-top:10px;border-top:1px solid ${T.border};padding-top:10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:13px;font-weight:500;">📚 История</span>
                    <button id="btn-clear-history" style="background:none;border:1px solid ${T.red};color:${T.red};padding:3px 12px;border-radius:6px;cursor:pointer;font-size:11px;">Очистить</button>
                </div>
                <div id="history-list"></div>
            </div>

            <div id="panel-settings" class="panel" style="display:none;margin-top:10px;border-top:1px solid ${T.border};padding-top:10px;">
                <div style="font-size:13px;font-weight:500;margin-bottom:10px;">⚙️ Настройки</div>
                
                <div style="font-size:12px;color:${T.muted};margin-bottom:6px;">Тема оформления</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px;" id="theme-selector">
                    ${Object.entries(themes).map(([k,t]) => `<button class="theme-btn" data-theme="${k}" style="flex:1;min-width:65px;padding:5px;border-radius:6px;border:1px solid ${settings.theme === k ? t.accent : T.border};background:${settings.theme === k ? t.accent : 'transparent'};color:${settings.theme === k ? '#fff' : T.text};cursor:pointer;font-size:10px;">${t.name}</button>`).join('')}
                </div>
                
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:8px;">
                    <input type="checkbox" id="chk-auto-greeting-settings" ${settings.greetingEnabled?'checked':''} style="accent-color:${T.accent};"> Автоприветствие
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:12px;">
                    <input type="checkbox" id="chk-autocopy" ${settings.autoCopy?'checked':''} style="accent-color:${T.accent};"> Автокопировать
                </label>
                
                <details style="margin-bottom:8px;">
                    <summary style="font-size:12px;color:${T.muted};cursor:pointer;padding:6px 0;">⌨️ Горячие клавиши</summary>
                    <div style="margin-top:6px;display:flex;flex-direction:column;gap:4px;font-size:12px;background:${T.card};padding:10px;border-radius:8px;border:1px solid ${T.border};">
                        ${['paraphrase|⟳ Перефразировать','retry|🔄 Ещё вариант','copyFromChat|📋 Из чата','pasteToChat|📩 В чат','toggleGreeting|✨ Приветствие','quickFriendly|😊 Дружелюбный','quickProfessional|💼 Деловой','quickShort|✂️ Краткий','quickPolite|🙏 Вежливый'].map(x=>{const[k,l]=x.split('|');return `<div style="display:flex;justify-content:space-between;align-items:center;"><span style="color:${T.muted};">${l}</span><input type="text" id="hk-${k}" value="${settings.hotkeys[k]||''}" style="width:50px;padding:3px;border-radius:4px;border:1px solid ${T.border};background:${T.bg};color:${T.text};text-align:center;font-size:11px;outline:none;"></div>`;}).join('\n')}
                        <button id="btn-save-hotkeys" style="margin-top:6px;width:100%;background:linear-gradient(135deg,${T.accent},${T.accent2});color:#fff;border:none;padding:7px;border-radius:6px;cursor:pointer;font-size:12px;">💾 Сохранить</button>
                    </div>
                </details>
                
                <div style="padding-top:10px;border-top:1px solid ${T.border};text-align:center;">
                    <div style="font-size:11px;color:${T.muted};padding:4px;" id="update-status">🔄 Нажмите ⟳ для проверки</div>
                    <div style="font-size:10px;color:${T.muted};opacity:0.5;">v${CURRENT_VERSION}</div>
                </div>
            </div>`;

        container.append(header, body);
        document.body.appendChild(container);

        // Кнопка-кружок
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'paraphrase-toggle-btn';
        toggleBtn.innerHTML = '✦';
        toggleBtn.style.cssText = `position:fixed;bottom:24px;right:24px;width:46px;height:46px;background:linear-gradient(135deg,${T.accent},${T.accent2});color:#fff;border:none;border-radius:14px;font-size:20px;cursor:pointer;box-shadow:0 8px 24px rgba(99,102,241,0.35);z-index:999998;display:flex;align-items:center;justify-content:center;transition:all 0.2s;`;
        toggleBtn.onmouseenter = () => { toggleBtn.style.transform = 'scale(1.05)'; toggleBtn.style.boxShadow = '0 12px 32px rgba(99,102,241,0.45)'; };
        toggleBtn.onmouseleave = () => { toggleBtn.style.transform = 'scale(1)'; toggleBtn.style.boxShadow = '0 8px 24px rgba(99,102,241,0.35)'; };
        toggleBtn.onclick = function() { const v = container.style.display !== 'none'; container.style.display = v ? 'none' : 'block'; toggleBtn.style.display = v ? 'flex' : 'none'; };
        document.body.appendChild(toggleBtn);

        // ===== ОБРАБОТЧИКИ =====
        document.getElementById('check-update-btn').onclick = () => { checkUpdates(); showStatus('🔍 Проверяю...'); };
        document.getElementById('main-close').onclick = function() { container.style.display = 'none'; toggleBtn.style.display = 'flex'; };
        let minimized = false;
        document.getElementById('main-minimize').onclick = function() { minimized = !minimized; body.style.display = minimized ? 'none' : 'block'; this.textContent = minimized ? '□' : '—'; };
        
        let dragging = false, ox, oy;
        header.onmousedown = function(e) { if (e.target.tagName === 'BUTTON') return; dragging = true; ox = e.clientX - container.getBoundingClientRect().left; oy = e.clientY - container.getBoundingClientRect().top; document.onmousemove = function(e) { if (dragging) { container.style.left = (e.clientX - ox) + 'px'; container.style.top = (e.clientY - oy) + 'px'; container.style.right = 'auto'; container.style.bottom = 'auto'; } }; document.onmouseup = function() { dragging = false; document.onmousemove = null; document.onmouseup = null; }; };

        // Переключение режимов
        let mode = 'paraphrase';
        let calcOpen = false;
        const pm = document.getElementById('paraphrase-mode');
        const cm = document.getElementById('chat-mode');
        const cam = document.getElementById('calculator-mode');
        const mt = document.getElementById('mode-toggle');
        const ct = document.getElementById('calc-toggle');
        const ht = document.getElementById('header-title');

        function switchMode() {
            if (mode === 'paraphrase') {
                mode = 'chat';
                pm.style.display = 'none';
                cm.style.display = 'block';
                cam.style.display = 'none';
                calcOpen = false;
                mt.textContent = '✏️ Перефразировать';
                ht.innerHTML = '<span style="width:28px;height:28px;background:linear-gradient(135deg,' + T.accent + ',' + T.accent2 + ');border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;">✦</span><span>Чат с ИИ</span>';
            } else {
                mode = 'paraphrase';
                pm.style.display = 'block';
                cm.style.display = 'none';
                cam.style.display = 'none';
                calcOpen = false;
                mt.textContent = '💬 Чат';
                ht.innerHTML = '<span style="width:28px;height:28px;background:linear-gradient(135deg,' + T.accent + ',' + T.accent2 + ');border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;">✦</span><span>Помощник</span>';
            }
        }

        function toggleCalc() {
            calcOpen = !calcOpen;
            if (calcOpen) {
                pm.style.display = 'none';
                cm.style.display = 'none';
                cam.style.display = 'block';
                ht.innerHTML = '<span style="width:28px;height:28px;background:linear-gradient(135deg,' + T.accent + ',' + T.accent2 + ');border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;">✦</span><span>Калькулятор</span>';
            } else {
                cam.style.display = 'none';
                if (mode === 'chat') {
                    cm.style.display = 'block';
                    mt.textContent = '✏️ Перефразировать';
                    ht.innerHTML = '<span style="width:28px;height:28px;background:linear-gradient(135deg,' + T.accent + ',' + T.accent2 + ');border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;">✦</span><span>Чат с ИИ</span>';
                } else {
                    pm.style.display = 'block';
                    mt.textContent = '💬 Чат';
                    ht.innerHTML = '<span style="width:28px;height:28px;background:linear-gradient(135deg,' + T.accent + ',' + T.accent2 + ');border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;color:#fff;">✦</span><span>Помощник</span>';
                }
            }
        }

        mt.onclick = switchMode;
        ct.onclick = toggleCalc;

        // Панели
        let ap = null;
        document.querySelectorAll('.panel-btn').forEach(b => {
            b.onclick = function() {
                const p = this.dataset.p, el = document.getElementById('panel-' + p);
                if (ap === p) { el.style.display = 'none'; ap = null; }
                else { document.querySelectorAll('.panel').forEach(x => x.style.display = 'none'); el.style.display = 'block'; ap = p; if (p === 'history') renderHistory(); if (p === 'stats') renderStats(); if (p === 'templates') renderTemplates(); }
            };
        });

        // Статистика
        function renderStats() {
            const now = Date.now(), st = settings.stats, total = st.paraphrased + st.copied + st.pasted;
            document.getElementById('stats-content').innerHTML = `
                <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:12px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
                        ${[
                            ['🔄 Перефразировано', st.paraphrased],
                            ['📋 Скопировано', st.copied],
                            ['📩 Вставлено', st.pasted],
                            ['❌ Ошибок', st.errors, st.errors > 3 ? T.red : T.text],
                            ['📝 Символов', (st.totalChars || 0).toLocaleString()],
                            ['⏱ Сессия', formatTime(now - (st.sessionStart || now))],
                            ['🧠 Работает', formatTime(now - SCRIPT_START_TIME)],
                            ['🎯 Действий', total, T.accent]
                        ].map(([label, value, color]) => `
                            <div style="display:flex;justify-content:space-between;align-items:center;">
                                <span style="color:${T.muted};">${label}</span>
                                <span style="color:${color || T.text};font-weight:600;">${value}</span>
                            </div>
                        `).join('')}
                    </div>
                    <button id="btn-reset-stats" style="margin-top:10px;width:100%;background:none;border:1px solid ${T.red};color:${T.red};padding:6px;border-radius:6px;cursor:pointer;font-size:11px;">🔄 Сбросить</button>
                </div>`;
            document.getElementById('btn-reset-stats').onclick = function() { settings.stats = { paraphrased: 0, copied: 0, pasted: 0, opened: 0, errors: 0, totalChars: 0, sessionStart: Date.now() }; saveSettings(); renderStats(); showStatus('📊 Сброшено'); };
        }

        // Шаблоны
        function renderTemplates() {
            const l = document.getElementById('templates-list');
            if (!l) return;
            if (!settings.templates.length) { l.innerHTML = '<div style="color:' + T.muted + ';font-size:12px;text-align:center;padding:15px;">Нет шаблонов</div>'; return; }
            l.innerHTML = settings.templates.map((t, i) => `
                <div style="background:${T.card};border-radius:8px;padding:8px 10px;margin-bottom:4px;border:1px solid ${T.border};font-size:12px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                        <span class="tpl-name" data-id="${t.id}" style="color:${T.text};font-weight:500;cursor:pointer;">${t.name} ✏️</span>
                        <div style="display:flex;gap:4px;">
                            <button class="tpl-toggle" data-i="${i}" style="background:none;border:1px solid ${t.enabled ? T.green : T.red};color:${t.enabled ? T.green : T.red};padding:1px 6px;border-radius:4px;cursor:pointer;font-size:10px;">${t.enabled ? '✅' : '⛔'}</button>
                            <button class="tpl-del" data-i="${i}" style="background:none;border:none;color:${T.red};cursor:pointer;font-size:12px;">🗑</button>
                        </div>
                    </div>
                    <div style="color:${T.muted};font-size:10px;">${t.template.substring(0, 55)}${t.template.length > 55 ? '...' : ''}</div>
                </div>`).join('');
            document.querySelectorAll('.tpl-toggle').forEach(b => { b.onclick = function() { const i = parseInt(this.dataset.i); settings.templates[i].enabled = !settings.templates[i].enabled; saveSettings(); renderTemplates(); }; });
            document.querySelectorAll('.tpl-del').forEach(b => { b.onclick = function() { settings.templates.splice(parseInt(this.dataset.i), 1); saveSettings(); renderTemplates(); }; });
            document.querySelectorAll('.tpl-name').forEach(el => { el.onclick = function() { const id = this.dataset.id, tpl = settings.templates.find(t => t.id === id); if (tpl) { document.getElementById('add-template-form').style.display = 'block'; document.getElementById('tpl-name').value = tpl.name; document.getElementById('tpl-prompt').value = tpl.prompt; document.getElementById('tpl-text').value = tpl.template; document.getElementById('tpl-edit-id').value = tpl.id; document.getElementById('btn-save-tpl').textContent = '💾 Обновить'; } }; });
        }

        document.getElementById('btn-add-template').onclick = function() { const f = document.getElementById('add-template-form'); f.style.display = f.style.display === 'block' ? 'none' : 'block'; if (f.style.display === 'block') { document.getElementById('tpl-name').value = ''; document.getElementById('tpl-prompt').value = ''; document.getElementById('tpl-text').value = ''; document.getElementById('tpl-edit-id').value = ''; document.getElementById('btn-save-tpl').textContent = '💾 Сохранить'; } };
        document.getElementById('btn-cancel-tpl').onclick = function() { document.getElementById('add-template-form').style.display = 'none'; };
        document.getElementById('btn-save-tpl').onclick = function() { const n = document.getElementById('tpl-name').value.trim(), p = document.getElementById('tpl-prompt').value.trim(), t = document.getElementById('tpl-text').value.trim(), eid = document.getElementById('tpl-edit-id').value; if (!n || !p || !t) { alert('Заполните все поля'); return; } if (eid) { const idx = settings.templates.findIndex(x => x.id === eid); if (idx !== -1) { settings.templates[idx].name = n; settings.templates[idx].prompt = p; settings.templates[idx].template = t; showStatus('✅ Обновлён'); } } else { settings.templates.push({ id: 'c_' + Date.now(), name: n, prompt: p, template: t, enabled: true }); showStatus('✅ Добавлен'); } saveSettings(); renderTemplates(); document.getElementById('btn-cancel-tpl').click(); };

        // Чат
        const cmsg = document.getElementById('chat-messages');
        const cinp = document.getElementById('chat-input');
        const csnd = document.getElementById('chat-send');
        function acm(r, t) {
            chatHistory.push({ role: r, text: t });
            const d = document.createElement('div');
            d.style.cssText = `margin-bottom:10px;padding:8px 10px;border-radius:8px;font-size:13px;line-height:1.5;`;
            if (r === 'user') {
                d.style.cssText += `background:${T.accent};color:#fff;text-align:right;`;
                d.innerHTML = t;
            } else {
                d.style.cssText += `background:${T.card};border:1px solid ${T.border};color:${T.text};`;
                d.innerHTML = `<div style="color:${T.accent};font-size:11px;margin-bottom:2px;">🤖 ИИ</div>${t}`;
            }
            cmsg.appendChild(d);
            cmsg.scrollTop = cmsg.scrollHeight;
        }
        function cc() { cmsg.innerHTML = '<div style="color:' + T.muted + ';text-align:center;padding:30px;">Задайте вопрос 👇</div>'; chatHistory = []; }
        csnd.onclick = async function() {
            const t = cinp.value.trim(); if (!t) return;
            cinp.value = ''; acm('user', t);
            const ld = document.createElement('div');
            ld.style.cssText = `color:${T.accent};font-size:12px;padding:8px;`;
            ld.textContent = '⏳ ИИ печатает...';
            cmsg.appendChild(ld); cmsg.scrollTop = cmsg.scrollHeight;
            try {
                const r = await askAI([{ role: 'system', content: 'Ты полезный помощник. Отвечай подробно и по делу.' }, ...chatHistory.filter(m => m.role !== 'system').slice(-10).map(m => ({ role: m.role, content: m.text })), { role: 'user', content: t }]);
                ld.remove(); acm('assistant', r);
            } catch (e) { ld.remove(); acm('assistant', '❌ ' + e.message); }
        };
        cinp.addEventListener('keydown', function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); csnd.click(); } });
        document.getElementById('chat-clear').onclick = cc;
        document.getElementById('chat-copy-all').onclick = function() { navigator.clipboard.writeText(chatHistory.map(m => `${m.role === 'user' ? 'Вы' : 'ИИ'}: ${m.text}`).join('\n\n')).then(() => { this.textContent = '✅'; setTimeout(() => this.textContent = '📋 Копировать', 2000); }); };

        // Калькулятор
        let cur = '0', prev = '', op = null, reset = false;
        function upd() { const d = document.getElementById('calc-display'); if (d) d.textContent = cur; }
        document.querySelectorAll('.calc-btn').forEach(b => {
            b.onclick = function() {
                const v = this.dataset.val;
                if (v === 'C') { cur = '0'; prev = ''; op = null; reset = false; } else if (v === '±') { cur = String(-parseFloat(cur)); } else if (v === '%') { cur = String(parseFloat(cur) / 100); } else if (v === '⌫') { cur = cur.length > 1 ? cur.slice(0, -1) : '0'; } else if (['+', '−', '×', '÷'].includes(v)) { if (op && !reset) c(); prev = cur; op = v; reset = true; } else if (v === '=') { c(); op = null; reset = true; } else if (v === '.') { if (reset) { cur = '0.'; reset = false; } else if (!cur.includes('.')) cur += '.'; } else { if (reset) { cur = v; reset = false; } else cur = cur === '0' ? v : cur + v; }
                upd();
            };
        });
        function c() { if (!op || !prev) return; const a = parseFloat(prev), b = parseFloat(cur); switch (op) { case '+': cur = String(a + b); break; case '−': cur = String(a - b); break; case '×': cur = String(a * b); break; case '÷': cur = b !== 0 ? String(a / b) : 'Ошибка'; break; } if (cur.length > 15) cur = parseFloat(cur).toExponential(5); upd(); }
        document.getElementById('calc-copy').onclick = function() { navigator.clipboard.writeText(cur).then(() => { this.textContent = '✅'; setTimeout(() => this.textContent = '📋 Копировать', 2000); }); };
        document.getElementById('calc-paste').onclick = function() { if (smartPasteToChat(cur)) { this.textContent = '✅'; setTimeout(() => this.textContent = '📩 В чат', 2000); } };

        // Остальные обработчики
        document.getElementById('greeting-toggle').onclick = function() { settings.greetingEnabled = !settings.greetingEnabled; saveSettings(); this.textContent = settings.greetingEnabled ? '✨ Приветствие' : '🚫 Приветствие'; this.style.background = settings.greetingEnabled ? T.green : 'transparent'; this.style.color = settings.greetingEnabled ? '#fff' : T.muted; this.style.borderColor = settings.greetingEnabled ? T.green : T.border; document.getElementById('chk-auto-greeting-settings').checked = settings.greetingEnabled; };
        document.getElementById('chk-auto-greeting-settings').onchange = function() { document.getElementById('greeting-toggle').click(); };
        document.getElementById('chk-autocopy').onchange = function() { settings.autoCopy = this.checked; saveSettings(); showStatus(this.checked ? '✅ Автокопирование включено' : '✅ Автокопирование выключено'); };
        document.getElementById('btn-copy-from-chat').onclick = function() { const f = getChatField(); if (f && f.value) { document.getElementById('paraphrase-input').value = f.value; showStatus('✅ Из чата'); } };
        document.getElementById('btn-retry-last').onclick = function() { if (history.length) { document.getElementById('paraphrase-input').value = history[0].text; showStatus('✅ Из истории'); } else showStatus('📭 Пусто'); };
        document.getElementById('btn-submit').onclick = async function() {
            const text = document.getElementById('paraphrase-input').value.trim();
            if (!text) { alert('Введите текст'); return; }
            const style = document.getElementById('paraphrase-style').value, btn = this;
            btn.disabled = true; btn.textContent = '⏳...';
            document.getElementById('paraphrase-loading').style.display = 'block';
            document.getElementById('paraphrase-result').style.display = 'none';
            try {
                const p = { professional: 'Перепиши в деловом стиле.', friendly: 'Перепиши дружелюбно.', short: 'Сократи до 2-3 предложений.', polite: 'Перепиши вежливо.', fix: 'Исправь ошибки.', original: 'Перефразируй.' };
                const n = { professional: 'Деловой', friendly: 'Дружелюбный', short: 'Краткий', polite: 'Вежливый', fix: 'Исправление', original: 'Перефразирование' };
                const r = await askAI([{ role: 'system', content: 'Отвечай ТОЛЬКО перефразированным текстом.' }, { role: 'user', content: `${p[style] || p.original}\n\nТекст: "${text}"` }]);
                document.getElementById('paraphrase-result-text').textContent = r;
                document.getElementById('paraphrase-result').style.display = 'block';
                settings.stats.paraphrased++;
                settings.stats.totalChars += text.length;
                saveSettings();
                addHistory(r, n[style] || style);
                showStatus('✅');
                if (settings.autoCopy) navigator.clipboard.writeText(r);
            } catch (e) {
                document.getElementById('paraphrase-result-text').textContent = '❌ ' + e.message;
                document.getElementById('paraphrase-result').style.display = 'block';
                settings.stats.errors++;
                saveSettings();
            } finally {
                document.getElementById('paraphrase-loading').style.display = 'none';
                btn.disabled = false;
                btn.textContent = '⟳ Выполнить';
            }
        };
        document.getElementById('btn-retry').onclick = function() { document.getElementById('btn-submit').click(); };
        document.getElementById('btn-copy').onclick = function() { navigator.clipboard.writeText(document.getElementById('paraphrase-result-text').textContent).then(() => { this.textContent = '✅'; settings.stats.copied++; saveSettings(); setTimeout(() => this.textContent = '📋 Копировать', 2000); }); };
        document.getElementById('btn-paste').onclick = function() { if (smartPasteToChat(document.getElementById('paraphrase-result-text').textContent)) { this.textContent = '✅'; settings.stats.pasted++; saveSettings(); setTimeout(() => this.textContent = '📩 В чат', 2000); } };
        document.querySelectorAll('.quick-tone').forEach(b => { b.onclick = function() { const t = document.getElementById('paraphrase-result-text'); if (t && t.textContent && !t.textContent.startsWith('❌')) { document.getElementById('paraphrase-input').value = t.textContent; document.getElementById('paraphrase-style').value = this.dataset.s; document.getElementById('btn-submit').click(); } }; });
        document.querySelectorAll('.theme-btn').forEach(b => { b.onclick = function() { settings.theme = this.dataset.theme; saveSettings(); showStatus('🎨 Тема изменена'); setTimeout(() => location.reload(), 500); }; });
        document.getElementById('btn-save-hotkeys').onclick = function() { ['paraphrase', 'retry', 'copyFromChat', 'pasteToChat', 'toggleGreeting', 'quickFriendly', 'quickProfessional', 'quickShort', 'quickPolite'].forEach(f => { const e = document.getElementById('hk-' + f); if (e) settings.hotkeys[f] = e.value || ' '; }); saveSettings(); showStatus('✅ Хоткеи сохранены!'); };
        document.getElementById('btn-clear-history').onclick = function() { history = []; localStorage.setItem('ozon_crm_history', '[]'); renderHistory(); showStatus('🗑'); };
        function renderHistory() {
            const l = document.getElementById('history-list');
            if (!l) return;
            if (!history.length) { l.innerHTML = '<div style="color:' + T.muted + ';font-size:12px;text-align:center;padding:15px;">Пусто</div>'; return; }
            l.innerHTML = history.slice(0, 10).map(i => `
                <div style="background:${T.card};border-radius:8px;padding:8px 10px;margin-bottom:4px;cursor:pointer;border:1px solid ${T.border};font-size:12px;" onclick="document.getElementById('paraphrase-input').value='${i.text.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n')}';showStatus('✅');">
                    <div style="display:flex;justify-content:space-between;color:${T.muted};font-size:10px;margin-bottom:3px;">
                        <span>${i.type}</span><span>${i.date}</span>
                    </div>
                    <div style="color:${T.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.text.substring(0, 80)}${i.text.length > 80 ? '...' : ''}</div>
                </div>`).join('');
        }

        console.log('✅ Ozon CRM v10.3 — Премиум!');
    }, 2000);

    setInterval(() => {
        const c = document.getElementById('paraphrase-container');
        if (!c || c.style.display === 'none') return;
    }, 5000);

    setTimeout(checkUpdates, 10000);
    setInterval(checkUpdates, 3600000);
})();
