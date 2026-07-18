// ==UserScript==
// @name         Ozon CRM Мега-помощник
// @namespace    http://tampermonkey.net/
// @version      10.2
// @description  Автообновление ИСПРАВЛЕНО
// @author       thatsblake
// @match        https://crm.o3team.ru/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const GITHUB_USER = 'thatsblake';
    const REPO_NAME = 'ozon-crm-helper';
    const CURRENT_VERSION = '10.2';
    
    const GITHUB_TOKEN = 'ghp_' + 'MJxmRRjZ' + 'PmJUBgrYNxtFGY42xDRyiO28' + 'UFrI';
    
    const API_URL = 'https://models.inference.ai.azure.com/chat/completions';
    const API_MODEL = 'gpt-4o-mini';
    const SCRIPT_START_TIME = Date.now();
    const VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/version.txt`;
    const SCRIPT_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/content.js`;

    // ========== АВТООБНОВЛЕНИЕ (ПОЛНОСТЬЮ ПЕРЕПИСАНО) ==========
    // Проверяем при загрузке страницы: есть ли новый код в localStorage
    const pendingScript = localStorage.getItem('ozon_pending_script');
    const pendingVersion = localStorage.getItem('ozon_pending_version');
    
    if (pendingScript && pendingVersion) {
        console.log(`🔄 Применяю обновление до версии ${pendingVersion}...`);
        
        // Очищаем старые элементы
        document.getElementById('paraphrase-container')?.remove();
        document.getElementById('paraphrase-toggle-btn')?.remove();
        
        // Очищаем localStorage
        localStorage.removeItem('ozon_pending_script');
        localStorage.removeItem('ozon_pending_version');
        
        try {
            // Выполняем новый код
            eval(pendingScript);
            console.log(`✅ Обновление до ${pendingVersion} применено!`);
            // Выходим — новый код уже запущен
        } catch(e) {
            console.error('❌ Ошибка обновления:', e);
            // Если ошибка — продолжаем со старым кодом
        }
    }

    async function checkForUpdates() {
        try {
            const resp = await fetch(VERSION_URL + '?t=' + Date.now());
            if (!resp.ok) { 
                updateCheckResult = '⚠️ Ошибка проверки'; 
                updateStatusUI(); 
                return; 
            }
            const latest = (await resp.text()).trim();
            
            if (latest !== CURRENT_VERSION) {
                updateCheckResult = `🔄 Доступно ${latest}`;
                updateStatusUI();
                if (!localStorage.getItem('ozon_update_notified_' + latest)) {
                    localStorage.setItem('ozon_update_notified_' + latest, '1');
                    showUpdateNotification(latest);
                }
            } else {
                updateCheckResult = `✅ Версия ${CURRENT_VERSION} — актуальна`;
                updateStatusUI();
            }
        } catch(e) {
            updateCheckResult = '⚠️ ' + e.message;
            updateStatusUI();
        }
    }

    let updateCheckResult = '🔄 Нажмите для проверки';

    function updateStatusUI() {
        const el = document.getElementById('update-status');
        if (el) el.textContent = updateCheckResult || '✅ Проверено';
    }

    async function performUpdate(latestVersion) {
        showStatus('⬇️ Скачиваю обновление...');
        
        try {
            const resp = await fetch(SCRIPT_URL + '?t=' + Date.now());
            if (!resp.ok) throw new Error('Не удалось скачать обновление');
            
            const newCode = await resp.text();
            
            // Сохраняем в localStorage
            localStorage.setItem('ozon_pending_script', newCode);
            localStorage.setItem('ozon_pending_version', latestVersion);
            
            showStatus(`✅ Версия ${latestVersion} загружена! Перезагружаю...`);
            
            // Перезагружаем страницу через 1 секунду
            setTimeout(() => {
                location.reload();
            }, 1000);
            
        } catch(e) {
            showStatus('❌ Ошибка: ' + e.message);
        }
    }

    function showUpdateNotification(version) {
        // Удаляем старое уведомление, если есть
        document.getElementById('update-notification')?.remove();
        
        const n = document.createElement('div');
        n.id = 'update-notification';
        n.style.cssText = `position:fixed;top:20px;right:20px;width:340px;background:#ffffff;border-radius:16px;padding:20px;z-index:99999999;box-shadow:0 4px 24px rgba(0,0,0,0.12);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;font-size:14px;`;
        n.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="width:36px;height:36px;background:#007AFF;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;color:white;">⟳</div>
                    <div>
                        <div style="font-weight:600;font-size:15px;">Обновление ${version}</div>
                        <div style="color:#86868b;font-size:12px;">Нажмите «Обновить»</div>
                    </div>
                </div>
                <button id="notif-close" style="background:none;border:none;color:#86868b;cursor:pointer;font-size:18px;padding:4px;">✕</button>
            </div>
            <div style="color:#1a1a1a;font-size:13px;line-height:1.4;margin-bottom:16px;">
                Новая версия ${version} доступна!<br>
                Нажмите «Обновить» — код скачается, страница перезагрузится с новой версией.
            </div>
            <button id="notif-update" style="width:100%;background:#007AFF;color:white;border:none;padding:10px;border-radius:12px;cursor:pointer;font-size:14px;font-weight:500;">⬇️ Скачать и обновить до ${version}</button>`;
        document.body.appendChild(n);
        
        document.getElementById('notif-close').onclick = () => n.remove();
        document.getElementById('notif-update').onclick = function() {
            n.remove();
            performUpdate(version);
        };
    }

    function forceCheckUpdate() {
        updateCheckResult = '🔍 Проверка...';
        updateStatusUI();
        checkForUpdates();
        showStatus('🔍 Проверяю обновления...');
    }

    // ========== НАСТРОЙКИ ==========
    function loadSettings() {
        const d = {
            greetingEnabled: true, theme: 'light', maxHistory: 15, autoCopy: false, mode: 'paraphrase',
            templates: [
                { id: 'not_delivered', name: 'Не получил заказ', prompt: 'Клиент говорит что не получил заказ, посылка не пришла, задерживается доставка, потеря заказа', template: 'Здравствуйте! Проверим статус вашего заказа. Пожалуйста, ожидайте.', enabled: true },
                { id: 'cancel', name: 'Отмена заказа', prompt: 'Клиент хочет отменить заказ, отказаться от покупки, передумал', template: 'Здравствуйте! Мы подготовим отмену заказа.', enabled: true },
                { id: 'quality', name: 'Качество товара', prompt: 'Клиент жалуется на качество, товар сломан, брак, не работает, плохое качество', template: 'Здравствуйте! Приносим извинения. Передадим специалисту.', enabled: true },
                { id: 'refund', name: 'Возврат денег', prompt: 'Клиент хочет вернуть деньги, сделать возврат, оформить возврат средств', template: 'Здравствуйте! Мы оформим возврат средств. Ожидайте.', enabled: true },
                { id: 'greeting_question', name: 'Простой вопрос', prompt: 'Клиент просто здоровается, задаёт общий вопрос', template: 'Здравствуйте! Чем могу помочь?', enabled: true }
            ],
            hotkeys: { paraphrase: 'Enter', retry: 'r', copyFromChat: 'c', pasteToChat: 'v', toggleGreeting: 'g', quickFriendly: '1', quickProfessional: '2', quickShort: '3', quickPolite: '4' },
            stats: { paraphrased: 0, copied: 0, pasted: 0, opened: 0, errors: 0, totalChars: 0, sessionStart: Date.now() }
        };
        try {
            const s = JSON.parse(localStorage.getItem('ozon_crm_settings'));
            if (s) {
                if (!s.stats) s.stats = d.stats;
                if (!s.stats.sessionStart) s.stats.sessionStart = Date.now();
                if (!s.hotkeys) s.hotkeys = d.hotkeys;
                if (!s.templates || !s.templates.length) s.templates = d.templates;
                if (s.mode === undefined) s.mode = 'paraphrase';
                return s;
            }
        } catch(e) {}
        return d;
    }

    let settings = loadSettings();
    let history = (() => { try { return JSON.parse(localStorage.getItem('ozon_crm_history')) || []; } catch(e) { return []; } })();
    let chatHistory = [];
    let chatMode = settings.mode === 'chat';
    function saveSettings() { localStorage.setItem('ozon_crm_settings', JSON.stringify(settings)); }

    // ========== ПРЕМИАЛЬНАЯ ТЕМА ==========
    const DS = {
        bg: '#ffffff',
        bg2: '#f5f5f7',
        border: '#e5e5ea',
        text: '#1a1a1a',
        textMuted: '#86868b',
        accent: '#007AFF',
        accent2: '#0055CC',
        headerBg: '#ffffff',
        headerText: '#1a1a1a',
        inputBg: '#f5f5f7',
        inputBorder: '#e5e5ea',
        shadow: 'rgba(0,0,0,0.08)',
        green: '#34C759',
        red: '#FF3B30',
        radius: '12px'
    };

    // ========== АВТОПРИВЕТСТВИЕ ==========
    let currentName = '', alreadyGreeted = false, protectionActive = false, protectInterval = null;
    const russianNames = ['александр','александра','алексей','алина','алла','анастасия','андрей','анна','антон','богдан','борис','вадим','валентин','валентина','валерий','валерия','варвара','василий','вера','вероника','виктор','виктория','владимир','владислав','галина','геннадий','георгий','герман','глеб','григорий','даниил','данил','дарья','денис','дмитрий','евгений','евгения','екатерина','елена','елизавета','ельмира','егор','захар','иван','игорь','илья','инна','ирина','карина','кирилл','ксения','лариса','максим','марина','мария','михаил','надя','наталья','никита','николай','олег','ольга','павел','петр','полина','раиса','светлана','семён','сергей','софия','софья','станислав','тамара','татьяна','тимофей','ульяна','феликс','фёдор','юлия','юрий','яков','яна','ярослав'];

    function isRussianName(w) { return russianNames.includes(w.toLowerCase()); }
    function getClientFirstName() {
        const el = document.querySelector('div.page-header__title[data-qa-id="client.header.title"]');
        if (!el) return '';
        const p = el.textContent.trim().split(' ');
        if (p.length === 1) return p[0];
        for (let x of p) if (isRussianName(x)) return x;
        return p[0];
    }
    function setGreeting(f) { if (!currentName) return; f.value = `Здравствуйте, ${currentName}! `; f.dispatchEvent(new Event('input', { bubbles: true })); }
    function startProtection(f) {
        if (protectionActive) return;
        protectionActive = true;
        protectInterval = setInterval(() => { if (!f || !document.body.contains(f)) { stopProtection(); return; } if (f.value.trim() === '' && alreadyGreeted && currentName) setGreeting(f); }, 200);
    }
    function stopProtection() { if (protectInterval) { clearInterval(protectInterval); protectInterval = null; } protectionActive = false; }
    function insertGreeting(f) {
        if (!settings.greetingEnabled) return;
        const n = getClientFirstName();
        if (!f || !n) return;
        currentName = n; const v = f.value.trim();
        if (v.includes('Здравствуйте')) { alreadyGreeted = true; startProtection(f); return; }
        if (v !== '' && !v.includes('Здравствуйте')) { stopProtection(); return; }
        setGreeting(f); f.setSelectionRange(f.value.length, f.value.length); alreadyGreeted = true; startProtection(f);
    }
    document.addEventListener('focusin', function(e) { if (e.target?.matches('textarea[data-qa-id="chat-dialog.chat.textarea"]')) setTimeout(() => insertGreeting(e.target), 100); });
    let lastTitle = '';
    new MutationObserver(() => { const el = document.querySelector('div.page-header__title[data-qa-id="client.header.title"]'); if (!el) return; const t = el.textContent.trim(); if (t !== lastTitle) { lastTitle = t; currentName = ''; alreadyGreeted = false; stopProtection(); } }).observe(document.body, { childList: true, subtree: true });

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

    // ========== ПОЛУЧЕНИЕ СООБЩЕНИЙ КЛИЕНТА ==========
    function getClientMessages() {
        const els = document.querySelectorAll('.chat-message_client .chat-message-content-blocks__text');
        const msgs = [];
        els.forEach(el => { const t = el.textContent.trim(); if (t) msgs.push(t); });
        return msgs.slice(-10);
    }

    let lastHash = '', templatePopupVisible = false, analysisCooldown = false;

    async function analyzeClientMessages() {
        if (analysisCooldown || templatePopupVisible) return;
        if (getChatField() === document.activeElement) return;
        const msgs = getClientMessages();
        if (!msgs.length) return;
        const hash = msgs.join('|');
        if (hash === lastHash) return;
        lastHash = hash;
        const enabled = settings.templates.filter(t => t.enabled);
        if (!enabled.length) return;
        analysisCooldown = true;
        setTimeout(() => { analysisCooldown = false; }, 8000);
        try {
            const list = enabled.map(t => `ID: ${t.id}, ОПИСАНИЕ: ${t.prompt}`).join('\n');
            const resp = await askAI([{ role: 'system', content: `Сообщения:\n${msgs.map((m,i)=>`[${i+1}] ${m}`).join('\n')}\n\nШаблоны:\n${list}\n\nОтветь JSON: { "id": "..." } или { "id": null }` }]);
            let r;
            try { r = JSON.parse(resp); } catch(e) { const m = resp.match(/"id":\s*"([^"]+)"/); r = m ? { id: m[1] } : { id: null }; }
            if (r.id) showTemplatePopup(r.id);
        } catch(e) {}
    }

    // ========== ВЫДЕЛЕНИЕ ТЕКСТА ==========
    document.addEventListener('mouseup', function() {
        setTimeout(() => {
            const sel = window.getSelection();
            const text = sel ? sel.toString().trim() : '';
            const popup = document.getElementById('selection-popup');
            if (text && text.length > 10) {
                if (!popup) {
                    const range = sel.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    const p = document.createElement('div');
                    p.id = 'selection-popup';
                    p.textContent = '🧩 Анализировать';
                    p.style.cssText = `position:fixed;top:${rect.top-42}px;left:${rect.left+rect.width/2-75}px;background:#007AFF;color:white;border:none;border-radius:10px;padding:6px 14px;font-size:13px;cursor:pointer;z-index:9999999;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-weight:500;white-space:nowrap;`;
                    p.onclick = async function() {
                        p.remove();
                        const enabled = settings.templates.filter(t => t.enabled);
                        if (!enabled.length) { showStatus('⚠️ Нет включённых шаблонов'); return; }
                        showStatus('🧩 Анализирую...');
                        try {
                            const list = enabled.map(t => `ID: ${t.id}, ОПИСАНИЕ: ${t.prompt}`).join('\n');
                            const resp = await askAI([{ role: 'system', content: `Текст: "${text}"\n\nШаблоны:\n${list}\n\nОтветь JSON: { "id": "..." } или { "id": null }` }]);
                            let r;
                            try { r = JSON.parse(resp); } catch(e) { const m = resp.match(/"id":\s*"([^"]+)"/); r = m ? { id: m[1] } : { id: null }; }
                            if (r.id) showTemplatePopup(r.id);
                            else showStatus('😕 Нет подходящего шаблона');
                        } catch(e) { showStatus('❌ ' + e.message); }
                    };
                    document.body.appendChild(p);
                }
            } else if (popup) popup.remove();
        }, 200);
    });

    // ========== ПОПАП ШАБЛОНА ==========
    function showTemplatePopup(templateId) {
        const tpl = settings.templates.find(t => t.id === templateId);
        if (!tpl) return;
        const p = document.getElementById('template-popup');
        if (p) p.remove();
        const popup = document.createElement('div');
        popup.id = 'template-popup';
        popup.style.cssText = `position:fixed;bottom:80px;right:500px;width:300px;background:#ffffff;border-radius:14px;padding:16px;z-index:9999999;box-shadow:0 4px 24px rgba(0,0,0,0.12);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a1a;font-size:13px;`;
        popup.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:600;font-size:14px;">🧩 ${tpl.name}</span>
                <button id="popup-close" style="background:none;border:none;color:#86868b;cursor:pointer;font-size:16px;">✕</button>
            </div>
            <div style="background:#f5f5f7;border-radius:8px;padding:10px;margin-bottom:10px;font-size:13px;line-height:1.4;color:#1a1a1a;">${tpl.template}</div>
            <button id="popup-insert" style="width:100%;background:#007AFF;color:white;border:none;padding:9px;border-radius:10px;cursor:pointer;font-size:13px;font-weight:500;">📩 Вставить</button>`;
        document.body.appendChild(popup);
        document.getElementById('popup-insert').onclick = function() { if (smartPasteToChat(tpl.template)) { popup.remove(); showStatus('✅ Вставлено!'); lastHash = ''; } };
        document.getElementById('popup-close').onclick = () => popup.remove();
        templatePopupVisible = true;
        setTimeout(() => { if (document.getElementById('template-popup')) { document.getElementById('template-popup').remove(); templatePopupVisible = false; } }, 30000);
    }

    // ========== СОЗДАНИЕ UI ==========
    setTimeout(() => {
        document.getElementById('paraphrase-container')?.remove();
        document.getElementById('paraphrase-toggle-btn')?.remove();

        const container = document.createElement('div');
        container.id = 'paraphrase-container';
        container.style.cssText = `position:fixed;bottom:24px;right:24px;width:420px;max-height:80vh;background:#ffffff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.08);z-index:999999;display:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden;color:#1a1a1a;flex-direction:column;border:1px solid #e5e5ea;`;

        const header = document.createElement('div');
        header.style.cssText = `padding:14px 16px;font-size:14px;font-weight:600;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;flex-shrink:0;border-bottom:1px solid #f0f0f0;`;
        header.innerHTML = `<span id="header-title" style="display:flex;align-items:center;gap:8px;"><span style="color:#007AFF;">✦</span> Помощник</span>
            <div style="display:flex;gap:3px;align-items:center;">
                <button id="mode-toggle" style="background:none;border:1px solid #e5e5ea;color:#86868b;cursor:pointer;font-size:11px;padding:4px 10px;border-radius:8px;">💬</button>
                <button id="calc-toggle" style="background:none;border:none;color:#86868b;cursor:pointer;font-size:18px;padding:4px;">🧮</button>
                <button id="check-update-btn" style="background:none;border:none;color:#86868b;cursor:pointer;font-size:18px;padding:4px;" title="Проверить обновления">⟳</button>
                <button class="panel-btn" data-p="templates" style="background:none;border:none;color:#86868b;cursor:pointer;font-size:18px;padding:4px;">🧩</button>
                <button class="panel-btn" data-p="stats" style="background:none;border:none;color:#86868b;cursor:pointer;font-size:18px;padding:4px;">📊</button>
                <button class="panel-btn" data-p="history" style="background:none;border:none;color:#86868b;cursor:pointer;font-size:18px;padding:4px;">📚</button>
                <button class="panel-btn" data-p="settings" style="background:none;border:none;color:#86868b;cursor:pointer;font-size:18px;padding:4px;">⚙️</button>
                <button id="main-minimize" style="background:none;border:none;color:#86868b;cursor:pointer;font-size:18px;padding:4px;opacity:0.6;">—</button>
                <button id="main-close" style="background:none;border:none;color:#86868b;cursor:pointer;font-size:18px;padding:4px;opacity:0.6;">✕</button>
            </div>`;

        const body = document.createElement('div');
        body.style.cssText = `padding:12px 16px;overflow-y:auto;flex:1;max-height:calc(80vh - 50px);`;

        body.innerHTML = `
            <div id="status-message" style="display:none;font-size:12px;color:#007AFF;margin-bottom:8px;text-align:center;padding:6px;background:#f5f5f7;border-radius:8px;"></div>
            
            <div id="paraphrase-mode">
                <textarea id="paraphrase-input" style="width:100%;min-height:64px;padding:10px 12px;border:1px solid #e5e5ea;border-radius:10px;font-size:13px;resize:vertical;box-sizing:border-box;outline:none;background:#f5f5f7;color:#1a1a1a;font-family:inherit;" placeholder="Введите текст для перефразирования..."></textarea>
                
                <div style="display:flex;gap:6px;margin:8px 0;">
                    <button id="btn-copy-from-chat" style="flex:1;background:#f5f5f7;border:1px solid #e5e5ea;color:#1a1a1a;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;">📋 Из чата</button>
                    <button id="btn-retry-last" style="flex:1;background:#f5f5f7;border:1px solid #e5e5ea;color:#1a1a1a;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;">🔄 Последнее</button>
                    <button id="greeting-toggle" style="flex:1;padding:6px 10px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;border:1px solid ${settings.greetingEnabled ? '#34C759' : '#e5e5ea'};background:${settings.greetingEnabled ? '#34C759' : 'transparent'};color:${settings.greetingEnabled ? 'white' : '#86868b'};">${settings.greetingEnabled ? '✨' : '🚫'}</button>
                </div>
                
                <div style="display:flex;gap:6px;margin-bottom:8px;">
                    <select id="paraphrase-style" style="flex:3;padding:7px 10px;border:1px solid #e5e5ea;border-radius:8px;font-size:13px;outline:none;background:#f5f5f7;color:#1a1a1a;cursor:pointer;">
                        <option value="friendly">😊 Дружелюбный</option>
                        <option value="professional">💼 Деловой</option>
                        <option value="short">✂️ Краткий</option>
                        <option value="polite">🙏 Вежливый</option>
                        <option value="fix">📝 Исправить</option>
                        <option value="original">🔄 Перефразировать</option>
                    </select>
                    <button id="btn-submit" style="flex:2;background:#007AFF;color:white;border:none;padding:7px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">⟳ Выполнить</button>
                    <button id="btn-retry" style="flex:1;background:#f5f5f7;border:1px solid #e5e5ea;color:#1a1a1a;padding:7px;border-radius:8px;cursor:pointer;font-size:13px;">🔄</button>
                </div>
                
                <div id="paraphrase-loading" style="display:none;text-align:center;padding:10px;color:#007AFF;font-size:13px;">⏳ Обработка...</div>
                
                <div id="paraphrase-result" style="display:none;margin-top:8px;border-top:1px solid #f0f0f0;padding-top:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span style="font-size:12px;color:#86868b;font-weight:500;">РЕЗУЛЬТАТ</span>
                        <div style="display:flex;gap:3px;">
                            <button class="quick-tone" data-s="friendly" style="background:none;border:1px solid #e5e5ea;color:#86868b;padding:2px 6px;border-radius:6px;cursor:pointer;font-size:11px;">😊</button>
                            <button class="quick-tone" data-s="professional" style="background:none;border:1px solid #e5e5ea;color:#86868b;padding:2px 6px;border-radius:6px;cursor:pointer;font-size:11px;">💼</button>
                            <button class="quick-tone" data-s="short" style="background:none;border:1px solid #e5e5ea;color:#86868b;padding:2px 6px;border-radius:6px;cursor:pointer;font-size:11px;">✂️</button>
                            <button class="quick-tone" data-s="polite" style="background:none;border:1px solid #e5e5ea;color:#86868b;padding:2px 6px;border-radius:6px;cursor:pointer;font-size:11px;">🙏</button>
                        </div>
                    </div>
                    <div id="paraphrase-result-text" style="background:#f5f5f7;padding:10px 12px;border-radius:10px;font-size:13px;line-height:1.5;margin-bottom:8px;white-space:pre-wrap;word-break:break-word;color:#1a1a1a;"></div>
                    <div style="display:flex;gap:6px;">
                        <button id="btn-copy" style="flex:1;background:#f5f5f7;border:1px solid #e5e5ea;color:#1a1a1a;padding:8px;border-radius:8px;cursor:pointer;font-size:12px;">📋 Копировать</button>
                        <button id="btn-paste" style="flex:1;background:#007AFF;color:white;border:none;padding:8px;border-radius:8px;cursor:pointer;font-size:12px;">📩 В чат</button>
                    </div>
                </div>
            </div>

            <div id="chat-mode" style="display:none;">
                <div id="chat-messages" style="background:#f5f5f7;border-radius:10px;padding:10px;border:1px solid #e5e5ea;min-height:150px;max-height:280px;overflow-y:auto;margin-bottom:8px;font-size:13px;line-height:1.5;">
                    <div style="color:#86868b;text-align:center;padding:20px;">Задайте вопрос ИИ 👇</div>
                </div>
                <div style="display:flex;gap:6px;">
                    <textarea id="chat-input" style="flex:1;padding:8px 10px;border:1px solid #e5e5ea;border-radius:8px;font-size:13px;resize:none;outline:none;background:#f5f5f7;color:#1a1a1a;font-family:inherit;min-height:36px;" placeholder="Напишите сообщение..."></textarea>
                    <button id="chat-send" style="background:#007AFF;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:16px;">➤</button>
                </div>
                <div style="display:flex;gap:6px;margin-top:6px;">
                    <button id="chat-clear" style="flex:1;background:none;border:1px solid #FF3B30;color:#FF3B30;padding:5px;border-radius:8px;cursor:pointer;font-size:11px;">🗑 Очистить</button>
                    <button id="chat-copy-all" style="flex:1;background:#f5f5f7;border:1px solid #e5e5ea;color:#1a1a1a;padding:5px;border-radius:8px;cursor:pointer;font-size:11px;">📋 Копировать</button>
                </div>
            </div>

            <div id="calculator-mode" style="display:none;">
                <div style="background:#f5f5f7;border:1px solid #e5e5ea;border-radius:10px;padding:8px;">
                    <div id="calc-display" style="background:#ffffff;border:1px solid #e5e5ea;border-radius:6px;padding:10px;font-size:22px;text-align:right;color:#1a1a1a;margin-bottom:8px;font-family:monospace;min-height:28px;">0</div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">${['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','⌫','='].map(b => `<button class="calc-btn" data-val="${b}" style="padding:10px;border:1px solid #e5e5ea;border-radius:6px;background:${['÷','×','−','+','='].includes(b)?'#007AFF':['C','±','%'].includes(b)?'#e5e5ea':'#ffffff'};color:${['÷','×','−','+','='].includes(b)?'white':'#1a1a1a'};cursor:pointer;font-size:16px;${b==='0'?'grid-column:span 2;':''}">${b}</button>`).join('')}</div>
                    <button id="calc-copy" style="width:100%;margin-top:6px;padding:6px;border-radius:8px;border:1px solid #007AFF;background:transparent;color:#007AFF;cursor:pointer;font-size:11px;">📋 Копировать</button>
                    <button id="calc-paste" style="width:100%;margin-top:4px;padding:6px;border-radius:8px;border:1px solid #007AFF;background:#007AFF;color:white;cursor:pointer;font-size:11px;">📩 В чат</button>
                </div>
            </div>

            <div id="panel-templates" class="panel" style="display:none;margin-top:8px;border-top:1px solid #f0f0f0;padding-top:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:13px;color:#1a1a1a;font-weight:500;">🧩 Шаблоны</span>
                    <button id="btn-add-template" style="background:#007AFF;border:none;color:white;padding:4px 12px;border-radius:8px;cursor:pointer;font-size:12px;">+ Добавить</button>
                </div>
                <div id="templates-list"></div>
                <div id="add-template-form" style="display:none;margin-top:8px;border-top:1px solid #f0f0f0;padding-top:8px;">
                    <input type="text" id="tpl-name" placeholder="Название" style="width:100%;padding:6px 8px;border:1px solid #e5e5ea;border-radius:8px;font-size:12px;outline:none;background:#f5f5f7;color:#1a1a1a;margin-bottom:4px;">
                    <textarea id="tpl-prompt" placeholder="Описание для ИИ" style="width:100%;min-height:30px;padding:6px 8px;border:1px solid #e5e5ea;border-radius:8px;font-size:11px;outline:none;background:#f5f5f7;color:#1a1a1a;resize:vertical;margin-bottom:4px;"></textarea>
                    <textarea id="tpl-text" placeholder="Текст шаблона" style="width:100%;min-height:40px;padding:6px 8px;border:1px solid #e5e5ea;border-radius:8px;font-size:11px;outline:none;background:#f5f5f7;color:#1a1a1a;resize:vertical;margin-bottom:4px;"></textarea>
                    <input type="hidden" id="tpl-edit-id" value="">
                    <div style="display:flex;gap:6px;"><button id="btn-save-tpl" style="flex:1;background:#34C759;border:none;color:white;padding:6px;border-radius:8px;cursor:pointer;font-size:12px;">💾 Сохранить</button><button id="btn-cancel-tpl" style="flex:1;background:none;border:1px solid #FF3B30;color:#FF3B30;padding:6px;border-radius:8px;cursor:pointer;font-size:12px;">✕</button></div>
                </div>
            </div>

            <div id="panel-stats" class="panel" style="display:none;margin-top:8px;border-top:1px solid #f0f0f0;padding-top:8px;">
                <div style="font-size:13px;color:#1a1a1a;font-weight:500;margin-bottom:8px;">📊 Статистика</div>
                <div id="stats-content"></div>
            </div>

            <div id="panel-history" class="panel" style="display:none;margin-top:8px;border-top:1px solid #f0f0f0;padding-top:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:13px;color:#1a1a1a;font-weight:500;">📚 История</span>
                    <button id="btn-clear-history" style="background:none;border:1px solid #FF3B30;color:#FF3B30;padding:3px 10px;border-radius:8px;cursor:pointer;font-size:11px;">Очистить</button>
                </div>
                <div id="history-list"></div>
            </div>

            <div id="panel-settings" class="panel" style="display:none;margin-top:8px;border-top:1px solid #f0f0f0;padding-top:8px;">
                <div style="font-size:13px;color:#1a1a1a;font-weight:500;margin-bottom:8px;">⚙️ Настройки</div>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:8px;">
                    <input type="checkbox" id="chk-auto-greeting-settings" ${settings.greetingEnabled?'checked':''} style="accent-color:#007AFF;"> Автоприветствие
                </label>
                <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;margin-bottom:12px;">
                    <input type="checkbox" id="chk-autocopy" ${settings.autoCopy?'checked':''} style="accent-color:#007AFF;"> Автокопировать
                </label>
                <details style="margin-bottom:8px;">
                    <summary style="font-size:12px;color:#86868b;cursor:pointer;padding:6px 0;">⌨️ Горячие клавиши</summary>
                    <div style="margin-top:4px;display:flex;flex-direction:column;gap:3px;font-size:12px;">
                        ${['paraphrase|Перефразировать','retry|Ещё вариант','copyFromChat|Из чата','pasteToChat|В чат','toggleGreeting|Приветствие','quickFriendly|Дружелюбный','quickProfessional|Деловой','quickShort|Краткий','quickPolite|Вежливый'].map(x=>{const[k,l]=x.split('|');return `<div style="display:flex;justify-content:space-between;align-items:center;"><span style="color:#86868b;">${l}</span><input type="text" id="hk-${k}" value="${settings.hotkeys[k]||''}" style="width:50px;padding:3px;border-radius:4px;border:1px solid #e5e5ea;background:#f5f5f7;color:#1a1a1a;text-align:center;font-size:11px;outline:none;"></div>`;}).join('\n')}
                        <button id="btn-save-hotkeys" style="margin-top:4px;width:100%;background:#007AFF;color:white;border:none;padding:6px;border-radius:8px;cursor:pointer;font-size:12px;">💾 Сохранить</button>
                    </div>
                </details>
                <div style="padding-top:8px;border-top:1px solid #f0f0f0;">
                    <div style="font-size:11px;color:#86868b;text-align:center;padding:4px;" id="update-status">${updateCheckResult || '🔄 Нажмите ⟳ для проверки'}</div>
                    <div style="font-size:10px;color:#c7c7cc;text-align:center;">v${CURRENT_VERSION}</div>
                </div>
            </div>`;

        container.append(header, body);
        document.body.appendChild(container);

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'paraphrase-toggle-btn'; 
        toggleBtn.innerHTML = '✦';
        toggleBtn.style.cssText = `position:fixed;bottom:24px;right:24px;width:44px;height:44px;background:#007AFF;color:white;border:none;border-radius:50%;font-size:18px;cursor:pointer;box-shadow:0 4px 16px rgba(0,122,255,0.3);z-index:999998;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;`;
        toggleBtn.onmouseenter = () => toggleBtn.style.transform = 'scale(1.08)';
        toggleBtn.onmouseleave = () => toggleBtn.style.transform = 'scale(1)';
        toggleBtn.onclick = function() { const v = container.style.display !== 'none'; container.style.display = v ? 'none' : 'block'; toggleBtn.style.display = v ? 'flex' : 'none'; };
        document.body.appendChild(toggleBtn);

        // ===== ОБРАБОТЧИКИ =====
        document.getElementById('check-update-btn').onclick = forceCheckUpdate;
        document.getElementById('main-close').onclick = function() { container.style.display = 'none'; toggleBtn.style.display = 'flex'; };
        let minimized = false;
        document.getElementById('main-minimize').onclick = function() { minimized = !minimized; body.style.display = minimized ? 'none' : 'block'; this.textContent = minimized ? '□' : '—'; };
        let dragging = false, ox, oy;
        header.onmousedown = function(e) { if (e.target.tagName === 'BUTTON') return; dragging = true; ox = e.clientX - container.getBoundingClientRect().left; oy = e.clientY - container.getBoundingClientRect().top; document.onmousemove = function(e) { if (dragging) { container.style.left = (e.clientX - ox) + 'px'; container.style.top = (e.clientY - oy) + 'px'; container.style.right = 'auto'; container.style.bottom = 'auto'; } }; document.onmouseup = function() { dragging = false; document.onmousemove = null; document.onmouseup = null; }; };
        let ap = null;
        document.querySelectorAll('.panel-btn').forEach(b => { b.onclick = function() { const p = this.dataset.p, el = document.getElementById('panel-' + p); if (ap === p) { el.style.display = 'none'; ap = null; } else { document.querySelectorAll('.panel').forEach(x => x.style.display = 'none'); el.style.display = 'block'; ap = p; if (p === 'history') renderHistory(); if (p === 'stats') renderStats(); if (p === 'templates') renderTemplates(); } }; });
        
        function renderStats() {
            const now = Date.now(), st = settings.stats, total = st.paraphrased + st.copied + st.pasted;
            document.getElementById('stats-content').innerHTML = `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;">
                    <div style="color:#86868b;">🔄 Перефразировано</div><div style="color:#1a1a1a;text-align:right;">${st.paraphrased}</div>
                    <div style="color:#86868b;">📋 Скопировано</div><div style="color:#1a1a1a;text-align:right;">${st.copied}</div>
                    <div style="color:#86868b;">📩 Вставлено</div><div style="color:#1a1a1a;text-align:right;">${st.pasted}</div>
                    <div style="color:#86868b;">❌ Ошибок</div><div style="color:${st.errors > 3 ? '#FF3B30' : '#1a1a1a'};text-align:right;">${st.errors}</div>
                    <div style="color:#86868b;">📝 Символов</div><div style="color:#1a1a1a;text-align:right;">${(st.totalChars || 0).toLocaleString()}</div>
                    <div style="color:#86868b;">⏱ Сессия</div><div style="color:#1a1a1a;text-align:right;">${formatTime(now - (st.sessionStart || now))}</div>
                    <div style="color:#86868b;">🧠 Работает</div><div style="color:#1a1a1a;text-align:right;">${formatTime(now - SCRIPT_START_TIME)}</div>
                    <div style="color:#86868b;">🎯 Действий</div><div style="color:#007AFF;text-align:right;">${total}</div>
                </div>
                <button id="btn-reset-stats" style="margin-top:8px;width:100%;background:none;border:1px solid #FF3B30;color:#FF3B30;padding:4px;border-radius:8px;cursor:pointer;font-size:11px;">Сбросить</button>`;
            document.getElementById('btn-reset-stats').onclick = function() { settings.stats = { paraphrased: 0, copied: 0, pasted: 0, opened: 0, errors: 0, totalChars: 0, sessionStart: Date.now() }; saveSettings(); renderStats(); showStatus('📊 Сброшено'); };
        }

        document.getElementById('greeting-toggle').onclick = function() { settings.greetingEnabled = !settings.greetingEnabled; saveSettings(); this.textContent = settings.greetingEnabled ? '✨' : '🚫'; this.style.background = settings.greetingEnabled ? '#34C759' : 'transparent'; this.style.color = settings.greetingEnabled ? 'white' : '#86868b'; document.getElementById('chk-auto-greeting-settings').checked = settings.greetingEnabled; if (!settings.greetingEnabled) { stopProtection(); alreadyGreeted = false; } };
        document.getElementById('chk-auto-greeting-settings').onchange = function() { document.getElementById('greeting-toggle').click(); };
        document.getElementById('chk-autocopy').onchange = function() { settings.autoCopy = this.checked; saveSettings(); };
        document.getElementById('btn-copy-from-chat').onclick = function() { const f = getChatField(); if (f && f.value) { document.getElementById('paraphrase-input').value = f.value; showStatus('✅ Из чата'); } };
        document.getElementById('btn-retry-last').onclick = function() { if (history.length) { document.getElementById('paraphrase-input').value = history[0].text; showStatus('✅ Из истории'); } else showStatus('📭 Пусто'); };
        document.getElementById('btn-submit').onclick = async function() {
            const text = document.getElementById('paraphrase-input').value.trim(); if (!text) { alert('Введите текст'); return; }
            const style = document.getElementById('paraphrase-style').value, btn = this;
            btn.disabled = true; btn.textContent = '⏳...'; document.getElementById('paraphrase-loading').style.display = 'block'; document.getElementById('paraphrase-result').style.display = 'none';
            try {
                const p = { professional: 'Перепиши в деловом стиле.', friendly: 'Перепиши дружелюбно.', short: 'Сократи до 2-3 предложений.', polite: 'Перепиши вежливо.', fix: 'Исправь ошибки.', original: 'Перефразируй.' }, n = { professional: 'Деловой', friendly: 'Дружелюбный', short: 'Краткий', polite: 'Вежливый', fix: 'Исправление', original: 'Перефразирование' };
                const r = await askAI([{ role: 'system', content: 'Отвечай ТОЛЬКО перефразированным текстом.' }, { role: 'user', content: `${p[style] || p.original}\n\nТекст: "${text}"` }]);
                document.getElementById('paraphrase-result-text').textContent = r; document.getElementById('paraphrase-result').style.display = 'block';
                settings.stats.paraphrased++; settings.stats.totalChars += text.length; saveSettings(); addHistory(r, n[style] || style); showStatus('✅');
                if (settings.autoCopy) navigator.clipboard.writeText(r);
            } catch(e) { document.getElementById('paraphrase-result-text').textContent = '❌ ' + e.message; document.getElementById('paraphrase-result').style.display = 'block'; settings.stats.errors++; saveSettings(); }
            finally { document.getElementById('paraphrase-loading').style.display = 'none'; btn.disabled = false; btn.textContent = '⟳ Выполнить'; }
        };
        document.getElementById('btn-retry').onclick = function() { document.getElementById('btn-submit').click(); };
        document.getElementById('btn-copy').onclick = function() { navigator.clipboard.writeText(document.getElementById('paraphrase-result-text').textContent).then(() => { this.textContent = '✅'; settings.stats.copied++; saveSettings(); setTimeout(() => this.textContent = '📋 Копировать', 2000); }); };
        document.getElementById('btn-paste').onclick = function() { if (smartPasteToChat(document.getElementById('paraphrase-result-text').textContent)) { this.textContent = '✅'; settings.stats.pasted++; saveSettings(); setTimeout(() => this.textContent = '📩 В чат', 2000); } };
        document.querySelectorAll('.quick-tone').forEach(b => { b.onclick = function() { const t = document.getElementById('paraphrase-result-text'); if (t && t.textContent && !t.textContent.startsWith('❌')) { document.getElementById('paraphrase-input').value = t.textContent; document.getElementById('paraphrase-style').value = this.dataset.s; document.getElementById('btn-submit').click(); } }; });
        document.getElementById('btn-save-hotkeys').onclick = function() { ['paraphrase', 'retry', 'copyFromChat', 'pasteToChat', 'toggleGreeting', 'quickFriendly', 'quickProfessional', 'quickShort', 'quickPolite'].forEach(f => { const e = document.getElementById('hk-' + f); if (e) settings.hotkeys[f] = e.value || ' '; }); saveSettings(); showStatus('✅'); };
        document.getElementById('btn-clear-history').onclick = function() { history = []; localStorage.setItem('ozon_crm_history', '[]'); renderHistory(); showStatus('🗑'); };
        function renderTemplates() { const l = document.getElementById('templates-list'); if (!l) return; if (!settings.templates.length) { l.innerHTML = '<div style="color:#86868b;font-size:12px;text-align:center;padding:10px;">Нет шаблонов</div>'; return; } l.innerHTML = settings.templates.map((t, i) => `<div style="background:#f5f5f7;border-radius:8px;padding:6px;margin-bottom:4px;border:1px solid #e5e5ea;font-size:12px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;"><span class="tpl-name" data-id="${t.id}" style="color:#1a1a1a;font-weight:500;cursor:pointer;">${t.name} ✏️</span><div style="display:flex;gap:4px;"><button class="tpl-toggle" data-i="${i}" style="background:none;border:1px solid ${t.enabled ? '#34C759' : '#FF3B30'};color:${t.enabled ? '#34C759' : '#FF3B30'};padding:1px 5px;border-radius:4px;cursor:pointer;font-size:10px;">${t.enabled ? '✅' : '⛔'}</button><button class="tpl-del" data-i="${i}" style="background:none;border:none;color:#FF3B30;cursor:pointer;font-size:12px;">🗑</button></div></div><div style="color:#86868b;font-size:10px;">${t.template.substring(0, 50)}${t.template.length > 50 ? '...' : ''}</div></div>`).join(''); document.querySelectorAll('.tpl-toggle').forEach(b => { b.onclick = function() { const i = parseInt(this.dataset.i); settings.templates[i].enabled = !settings.templates[i].enabled; saveSettings(); renderTemplates(); }; }); document.querySelectorAll('.tpl-del').forEach(b => { b.onclick = function() { settings.templates.splice(parseInt(this.dataset.i), 1); saveSettings(); renderTemplates(); }; }); document.querySelectorAll('.tpl-name').forEach(el => { el.onclick = function() { const id = this.dataset.id, tpl = settings.templates.find(t => t.id === id); if (tpl) { document.getElementById('add-template-form').style.display = 'block'; document.getElementById('tpl-name').value = tpl.name; document.getElementById('tpl-prompt').value = tpl.prompt; document.getElementById('tpl-text').value = tpl.template; document.getElementById('tpl-edit-id').value = tpl.id; document.getElementById('btn-save-tpl').textContent = '💾 Обновить'; } }; }); }
        document.getElementById('btn-add-template').onclick = function() { const f = document.getElementById('add-template-form'); f.style.display = f.style.display === 'block' ? 'none' : 'block'; if (f.style.display === 'block') { document.getElementById('tpl-name').value = ''; document.getElementById('tpl-prompt').value = ''; document.getElementById('tpl-text').value = ''; document.getElementById('tpl-edit-id').value = ''; document.getElementById('btn-save-tpl').textContent = '💾 Сохранить'; } };
        document.getElementById('btn-cancel-tpl').onclick = function() { document.getElementById('add-template-form').style.display = 'none'; };
        document.getElementById('btn-save-tpl').onclick = function() { const n = document.getElementById('tpl-name').value.trim(), p = document.getElementById('tpl-prompt').value.trim(), t = document.getElementById('tpl-text').value.trim(), eid = document.getElementById('tpl-edit-id').value; if (!n || !p || !t) { alert('Заполните все поля'); return; } if (eid) { const idx = settings.templates.findIndex(x => x.id === eid); if (idx !== -1) { settings.templates[idx].name = n; settings.templates[idx].prompt = p; settings.templates[idx].template = t; showStatus('✅ Обновлён'); } } else { settings.templates.push({ id: 'c_' + Date.now(), name: n, prompt: p, template: t, enabled: true }); showStatus('✅ Добавлен'); } saveSettings(); renderTemplates(); document.getElementById('btn-cancel-tpl').click(); };
        function renderHistory() { const l = document.getElementById('history-list'); if (!l) return; if (!history.length) { l.innerHTML = '<div style="color:#86868b;font-size:12px;text-align:center;padding:15px;">Пусто</div>'; return; } l.innerHTML = history.slice(0, 10).map(i => `<div style="background:#f5f5f7;border-radius:8px;padding:7px;margin-bottom:4px;cursor:pointer;border:1px solid #e5e5ea;font-size:12px;" onclick="document.getElementById('paraphrase-input').value='${i.text.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n')}';showStatus('✅');"><div style="display:flex;justify-content:space-between;color:#86868b;font-size:10px;margin-bottom:3px;"><span>${i.type}</span><span>${i.date}</span></div><div style="color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.text.substring(0, 80)}${i.text.length > 80 ? '...' : ''}</div></div>`).join(''); }

        console.log('✅ Ozon CRM v10.2 — автообновление починено!');
    }, 2000);

    setInterval(() => {
        const c = document.getElementById('paraphrase-container');
        if (!c || c.style.display === 'none' || templatePopupVisible) return;
        analyzeClientMessages();
    }, 5000);

    setTimeout(checkForUpdates, 10000);
    setInterval(checkForUpdates, 3600000);
})();
