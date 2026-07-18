// ==UserScript==
// @name         Ozon CRM Мега-помощник
// @namespace    http://tampermonkey.net/
// @version      9.5
// @description  Полная версия с ИИ от GitHub
// @author       thatsblake
// @match        https://crm.o3team.ru/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const GITHUB_USER = 'thatsblake';
    const REPO_NAME = 'ozon-crm-helper';
    const CURRENT_VERSION = '9.5';
    const GITHUB_TOKEN = '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';
    const API_URL = 'https://models.inference.ai.azure.com/chat/completions';
    const API_MODEL = 'gpt-4o-mini';
    const SCRIPT_START_TIME = Date.now();
    const VERSION_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${REPO_NAME}/main/version.txt`;

    // ========== АВТООБНОВЛЕНИЕ ==========
    async function checkForUpdates() {
        try {
            const resp = await fetch(VERSION_URL + '?t=' + Date.now());
            if (!resp.ok) return;
            const latest = (await resp.text()).trim();
            if (latest !== CURRENT_VERSION) {
                console.log(`🔄 Обновление: ${CURRENT_VERSION} → ${latest}`);
                if (!localStorage.getItem('ozon_crm_update_shown_' + latest)) {
                    localStorage.setItem('ozon_crm_update_shown_' + latest, '1');
                    const T = themes[settings.theme] || themes.pink;
                    const n = document.createElement('div');
                    n.id = 'update-notification';
                    n.style.cssText = `position:fixed;top:20px;right:20px;width:350px;background:${T.bg};border:2px solid ${T.accent};border-radius:12px;padding:16px;z-index:99999999;box-shadow:0 0 30px rgba(255,107,157,0.3);font-family:'Segoe UI',sans-serif;color:${T.text};font-size:13px;`;
                    n.innerHTML = `<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:${T.accent};font-weight:600;font-size:15px;">🔄 Обновление ${latest}</span><button id="notif-close" style="background:none;border:none;color:${T.textMuted};cursor:pointer;font-size:18px;">✕</button></div><div style="margin-bottom:10px;">Доступна новая версия!</div><button id="notif-update" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accent2});color:white;border:none;padding:8px;border-radius:8px;cursor:pointer;font-size:13px;">🔄 Обновить</button>`;
                    document.body.appendChild(n);
                    document.getElementById('notif-close').onclick = () => n.remove();
                    document.getElementById('notif-update').onclick = () => { localStorage.removeItem('ozon_crm_update_shown_' + latest); location.reload(); };
                }
            }
        } catch(e) {}
    }

    // ========== НАСТРОЙКИ ==========
    function loadSettings() {
        const d = {
            greetingEnabled: true, theme: 'pink', maxHistory: 15, autoCopy: false, mode: 'paraphrase',
            templates: [
                { id: 'not_delivered', name: 'Не получил заказ', prompt: 'Клиент говорит что не получил заказ, посылка не пришла, задерживается доставка, потеря заказа', template: 'Здравствуйте! Проверим статус вашего заказа. Пожалуйста, ожидайте.', enabled: true },
                { id: 'cancel', name: 'Отмена заказа', prompt: 'Клиент хочет отменить заказ, отказаться от покупки, передумал', template: 'Здравствуйте! Мы подготовим отмену заказа.', enabled: true },
                { id: 'quality', name: 'Качество товара', prompt: 'Клиент жалуется на качество, товар сломан, брак, не работает, плохое качество', template: 'Здравствуйте! Приносим извинения. Передадим специалисту.', enabled: true },
                { id: 'refund', name: 'Возврат денег', prompt: 'Клиент хочет вернуть деньги, сделать возврат, оформить возврат средств', template: 'Здравствуйте! Мы оформим возврат средств. Ожидайте.', enabled: true },
                { id: 'greeting_question', name: 'Простой вопрос', prompt: 'Клиент просто здоровается, задаёт общий вопрос, уточняет информацию', template: 'Здравствуйте! Чем могу помочь?', enabled: true }
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

    const themes = {
        pink: { name: '🌸 Розовый', bg: '#0d0d1a', bg2: '#1a1a2e', border: '#ff6b9d', borderGlow: 'rgba(255,107,157,0.3)', text: '#e8d5e0', textMuted: '#a88b9e', inputBg: '#1a1a2e', inputBorder: '#3a2a3e', headerBg: 'linear-gradient(135deg, #ff6b9d, #c084fc)', headerText: '#ffffff', accent: '#ff6b9d', accent2: '#c084fc', resultBg: '#1a1a2e', resultText: '#e8d5e0', successBg: '#2a1a2e', successBorder: '#ff6b9d', successText: '#ff6b9d', primaryBg: '#2a1a3e', primaryBorder: '#c084fc', primaryText: '#c084fc', loadingText: '#ff6b9d', placeholder: '#5a4a5e', green: '#ff6b9d', red: '#ff4d6d', shadow: 'rgba(255,107,157,0.2)' },
        cyber: { name: '💚 Киберпанк', bg: '#0a0f0a', bg2: '#0f1a0f', border: '#00ff88', borderGlow: 'rgba(0,255,136,0.3)', text: '#ccffdd', textMuted: '#66aa77', inputBg: '#0f1a0f', inputBorder: '#1a2a1a', headerBg: 'linear-gradient(135deg, #00ff88, #00ccff)', headerText: '#001a0a', accent: '#00ff88', accent2: '#00ccff', resultBg: '#0f1a0f', resultText: '#ccffdd', successBg: '#0a1a0f', successBorder: '#00ff88', successText: '#00ff88', primaryBg: '#0a1a1a', primaryBorder: '#00ccff', primaryText: '#00ccff', loadingText: '#00ff88', placeholder: '#335544', green: '#00ff88', red: '#ff3355', shadow: 'rgba(0,255,136,0.2)' },
        ocean: { name: '🌊 Океан', bg: '#0a0d1a', bg2: '#0a1a2e', border: '#00ccff', borderGlow: 'rgba(0,204,255,0.3)', text: '#cce8ff', textMuted: '#6699bb', inputBg: '#0a1a2e', inputBorder: '#1a2a3e', headerBg: 'linear-gradient(135deg, #0066ff, #00ccff)', headerText: '#ffffff', accent: '#00ccff', accent2: '#0066ff', resultBg: '#0a1a2e', resultText: '#cce8ff', successBg: '#0a1a2e', successBorder: '#00ccff', successText: '#00ccff', primaryBg: '#0a1a2e', primaryBorder: '#0066ff', primaryText: '#0066ff', loadingText: '#00ccff', placeholder: '#335566', green: '#00ccff', red: '#ff4466', shadow: 'rgba(0,204,255,0.2)' },
        sunset: { name: '🌅 Закат', bg: '#1a0d0d', bg2: '#2e1a0a', border: '#ff8844', borderGlow: 'rgba(255,136,68,0.3)', text: '#ffddcc', textMuted: '#bb8866', inputBg: '#2e1a0a', inputBorder: '#3e2a1a', headerBg: 'linear-gradient(135deg, #ff4400, #ffaa00)', headerText: '#ffffff', accent: '#ff8844', accent2: '#ffaa00', resultBg: '#2e1a0a', resultText: '#ffddcc', successBg: '#2e1a0a', successBorder: '#ff8844', successText: '#ff8844', primaryBg: '#2e1a1a', primaryBorder: '#ff4400', primaryText: '#ff4400', loadingText: '#ff8844', placeholder: '#665544', green: '#ff8844', red: '#ff3355', shadow: 'rgba(255,136,68,0.2)' },
        light: { name: '🌕 Светлая', bg: '#f5f0f5', bg2: '#ffffff', border: '#ff6b9d', borderGlow: 'rgba(255,107,157,0.2)', text: '#2a1a2e', textMuted: '#887088', inputBg: '#ffffff', inputBorder: '#e0d5e0', headerBg: 'linear-gradient(135deg, #ff6b9d, #c084fc)', headerText: '#ffffff', accent: '#ff6b9d', accent2: '#c084fc', resultBg: '#f5f0f5', resultText: '#2a1a2e', successBg: '#fff0f5', successBorder: '#ff6b9d', successText: '#ff6b9d', primaryBg: '#f5f0ff', primaryBorder: '#c084fc', primaryText: '#c084fc', loadingText: '#ff6b9d', placeholder: '#bbaabb', green: '#ff6b9d', red: '#ff3355', shadow: 'rgba(255,107,157,0.1)' }
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
                    p.style.cssText = `position:fixed;top:${rect.top-40}px;left:${rect.left+rect.width/2-70}px;background:linear-gradient(135deg,${themes[settings.theme].accent},${themes[settings.theme].accent2});color:white;border:none;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;z-index:9999999;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-family:'Segoe UI',sans-serif;font-weight:500;white-space:nowrap;`;
                    p.textContent = '🧩 Анализировать';
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
        const T = themes[settings.theme] || themes.pink;
        const popup = document.createElement('div');
        popup.id = 'template-popup';
        popup.style.cssText = `position:fixed;bottom:80px;right:500px;width:300px;background:${T.bg};border:2px solid ${T.accent};border-radius:12px;padding:12px;z-index:9999999;box-shadow:0 0 30px rgba(255,107,157,0.3);font-family:'Segoe UI',sans-serif;color:${T.text};font-size:12px;`;
        popup.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="color:${T.accent};font-weight:600;font-size:13px;">🧩 ${tpl.name}</span>
                <button id="popup-close" style="background:none;border:none;color:${T.textMuted};cursor:pointer;font-size:14px;">✕</button>
            </div>
            <div style="background:${T.inputBg};border-radius:6px;padding:6px;margin-bottom:6px;border:1px solid ${T.inputBorder};">${tpl.template}</div>
            <button id="popup-insert" style="width:100%;background:linear-gradient(135deg,${T.accent},${T.accent2});color:white;border:none;padding:7px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;">📩 Вставить</button>`;
        document.body.appendChild(popup);
        document.getElementById('popup-insert').onclick = function() { if (smartPasteToChat(tpl.template)) { popup.remove(); showStatus('✅ Вставлено!'); lastHash = ''; } };
        document.getElementById('popup-close').onclick = () => popup.remove();
        templatePopupVisible = true;
        setTimeout(() => { if (document.getElementById('template-popup')) { document.getElementById('template-popup').remove(); templatePopupVisible = false; } }, 30000);
    }

    // ========== СОЗДАНИЕ UI ==========
    setTimeout(() => {
        const T = themes[settings.theme] || themes.pink;
        document.getElementById('paraphrase-container')?.remove();
        document.getElementById('paraphrase-toggle-btn')?.remove();

        const container = document.createElement('div');
        container.id = 'paraphrase-container';
        container.style.cssText = `position:fixed;bottom:20px;right:20px;width:440px;max-height:80vh;background:${T.bg};border:1px solid ${T.border};border-radius:16px;box-shadow:0 0 30px ${T.shadow},0 8px 32px rgba(0,0,0,0.6);z-index:999999;display:none;font-family:'Segoe UI',sans-serif;overflow:hidden;color:${T.text};backdrop-filter:blur(10px);flex-direction:column;`;

        const header = document.createElement('div');
        header.style.cssText = `background:${T.headerBg};color:${T.headerText};padding:8px 16px;font-size:13px;font-weight:600;display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;flex-shrink:0;`;
        header.innerHTML = `<span id="header-title">✦ Помощник</span>
            <div style="display:flex;gap:4px;align-items:center;">
                <button id="mode-toggle" style="background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);color:white;cursor:pointer;font-size:11px;padding:3px 8px;border-radius:4px;">💬</button>
                <button id="calc-toggle" style="background:rgba(255,255,255,0.15);border:none;color:white;cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px;">🧮</button>
                <button class="panel-btn" data-p="templates" style="background:rgba(255,255,255,0.15);border:none;color:white;cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px;">🧩</button>
                <button class="panel-btn" data-p="stats" style="background:rgba(255,255,255,0.15);border:none;color:white;cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px;">📊</button>
                <button class="panel-btn" data-p="history" style="background:rgba(255,255,255,0.15);border:none;color:white;cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px;">📚</button>
                <button class="panel-btn" data-p="settings" style="background:rgba(255,255,255,0.15);border:none;color:white;cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px;">⚙️</button>
                <button id="main-minimize" style="background:none;border:none;color:white;cursor:pointer;font-size:16px;opacity:0.8;">—</button>
                <button id="main-close" style="background:none;border:none;color:white;cursor:pointer;font-size:16px;opacity:0.8;">✕</button>
            </div>`;

        const body = document.createElement('div');
        body.style.cssText = `padding:10px 12px;overflow-y:auto;flex:1;max-height:calc(80vh - 45px);`;
        body.innerHTML = `
            <div id="status-message" style="display:none;font-size:11px;color:${T.accent};margin-bottom:6px;text-align:center;padding:4px;background:${T.inputBg};border-radius:6px;"></div>
            <div id="paraphrase-mode">
                <div style="font-size:11px;color:${T.textMuted};margin-bottom:4px;">ТВОЙ ТЕКСТ</div>
                <textarea id="paraphrase-input" style="width:100%;min-height:60px;padding:8px;border:1px solid ${T.inputBorder};border-radius:8px;font-size:13px;resize:vertical;box-sizing:border-box;outline:none;background:${T.inputBg};color:${T.text};font-family:inherit;" placeholder="Введите текст для перефразирования..."></textarea>
                <div style="display:flex;gap:6px;margin:6px 0;">
                    <button id="btn-copy-from-chat" style="flex:1;background:${T.primaryBg};border:1px solid ${T.primaryBorder};color:${T.primaryText};padding:5px 8px;border-radius:6px;cursor:pointer;font-size:11px;">📋 Из чата</button>
                    <button id="btn-retry-last" style="flex:1;background:${T.primaryBg};border:1px solid ${T.primaryBorder};color:${T.primaryText};padding:5px 8px;border-radius:6px;cursor:pointer;font-size:11px;">🔄 Последнее</button>
                    <button id="greeting-toggle" style="flex:1;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:500;border:1px solid ${T.green};background:${settings.greetingEnabled ? T.green : 'transparent'};color:${settings.greetingEnabled ? 'white' : T.red};">${settings.greetingEnabled ? '✨' : '🚫'}</button>
                </div>
                <div style="font-size:11px;color:${T.textMuted};margin:6px 0 4px;">СТИЛЬ</div>
                <select id="paraphrase-style" style="width:100%;padding:7px;border:1px solid ${T.inputBorder};border-radius:8px;font-size:13px;outline:none;background:${T.inputBg};color:${T.text};cursor:pointer;margin-bottom:6px;"><option value="friendly" selected>😊 Дружелюбный</option><option value="professional">💼 Деловой</option><option value="short">✂️ Краткий</option><option value="polite">🙏 Вежливый</option><option value="fix">📝 Исправить ошибки</option><option value="original">🔄 Перефразировать</option></select>
                <div style="display:flex;gap:6px;margin:6px 0;"><button id="btn-submit" style="flex:3;background:linear-gradient(135deg,${T.accent},${T.accent2});color:white;border:none;padding:9px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">⟳ Перефразировать</button><button id="btn-retry" style="flex:1;background:${T.primaryBg};border:1px solid ${T.primaryBorder};color:${T.primaryText};padding:9px;border-radius:8px;cursor:pointer;font-size:13px;">🔄</button></div>
                <div id="paraphrase-loading" style="display:none;text-align:center;padding:8px;color:${T.loadingText};font-size:13px;">⏳ Обработка...</div>
                <div id="paraphrase-result" style="display:none;margin-top:6px;border-top:1px solid ${T.inputBorder};padding-top:6px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><span style="font-size:11px;color:${T.textMuted};">РЕЗУЛЬТАТ</span><div style="display:flex;gap:3px;"><button class="quick-tone" data-s="friendly" style="background:none;border:1px solid ${T.inputBorder};color:${T.textMuted};padding:2px 6px;border-radius:4px;cursor:pointer;font-size:10px;">😊</button><button class="quick-tone" data-s="professional" style="background:none;border:1px solid ${T.inputBorder};color:${T.textMuted};padding:2px 6px;border-radius:4px;cursor:pointer;font-size:10px;">💼</button><button class="quick-tone" data-s="short" style="background:none;border:1px solid ${T.inputBorder};color:${T.textMuted};padding:2px 6px;border-radius:4px;cursor:pointer;font-size:10px;">✂️</button><button class="quick-tone" data-s="polite" style="background:none;border:1px solid ${T.inputBorder};color:${T.textMuted};padding:2px 6px;border-radius:4px;cursor:pointer;font-size:10px;">🙏</button></div></div>
                    <div id="paraphrase-result-text" style="background:${T.resultBg};padding:8px;border-radius:8px;border:1px solid ${T.inputBorder};font-size:13px;line-height:1.4;margin-bottom:6px;white-space:pre-wrap;word-break:break-word;color:${T.resultText};"></div>
                    <div style="display:flex;gap:6px;"><button id="btn-copy" style="flex:1;background:${T.successBg};border:1px solid ${T.successBorder};color:${T.successText};padding:7px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;">📋</button><button id="btn-paste" style="flex:1;background:${T.primaryBg};border:1px solid ${T.primaryBorder};color:${T.primaryText};padding:7px;border-radius:8px;cursor:pointer;font-size:12px;font-weight:500;">📩</button></div>
                </div>
            </div>
            <div id="chat-mode" style="display:none;">
                <div style="font-size:11px;color:${T.textMuted};margin-bottom:4px;">ЧАТ С ИИ</div>
                <div id="chat-messages" style="background:${T.inputBg};border-radius:8px;padding:8px;border:1px solid ${T.inputBorder};min-height:150px;max-height:300px;overflow-y:auto;margin-bottom:6px;font-size:12px;line-height:1.5;"><div style="color:${T.textMuted};text-align:center;padding:20px;">Задайте вопрос 👇</div></div>
                <div style="display:flex;gap:6px;"><textarea id="chat-input" style="flex:1;padding:8px;border:1px solid ${T.inputBorder};border-radius:8px;font-size:13px;resize:none;outline:none;background:${T.inputBg};color:${T.text};font-family:inherit;min-height:40px;max-height:80px;" placeholder="Напишите сообщение..." rows="1"></textarea><button id="chat-send" style="background:linear-gradient(135deg,${T.accent},${T.accent2});color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:16px;">➤</button></div>
                <div style="display:flex;gap:6px;margin-top:6px;"><button id="chat-clear" style="flex:1;background:transparent;border:1px solid ${T.red};color:${T.red};padding:5px;border-radius:6px;cursor:pointer;font-size:11px;">🗑</button><button id="chat-copy-all" style="flex:1;background:${T.primaryBg};border:1px solid ${T.primaryBorder};color:${T.primaryText};padding:5px;border-radius:6px;cursor:pointer;font-size:11px;">📋</button></div>
            </div>
            <div id="calculator-mode" style="display:none;">
                <div style="background:${T.inputBg};border:1px solid ${T.inputBorder};border-radius:8px;padding:8px;">
                    <div id="calc-display" style="background:${T.bg};border:1px solid ${T.inputBorder};border-radius:6px;padding:10px;font-size:20px;text-align:right;color:${T.text};margin-bottom:8px;font-family:monospace;min-height:28px;">0</div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">${['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','⌫','='].map(b => `<button class="calc-btn" data-val="${b}" style="padding:10px;border:1px solid ${T.inputBorder};border-radius:6px;background:${['÷','×','−','+','='].includes(b)?T.accent:['C','±','%'].includes(b)?T.inputBg:T.bg2};color:${['÷','×','−','+','='].includes(b)?'white':T.text};cursor:pointer;font-size:16px;${b==='0'?'grid-column:span 2;':''}">${b}</button>`).join('')}</div>
                    <button id="calc-copy" style="width:100%;margin-top:6px;padding:6px;border-radius:6px;border:1px solid ${T.accent2};background:${T.primaryBg};color:${T.primaryText};cursor:pointer;font-size:11px;">📋</button>
                    <button id="calc-paste" style="width:100%;margin-top:4px;padding:6px;border-radius:6px;border:1px solid ${T.accent};background:transparent;color:${T.accent};cursor:pointer;font-size:11px;">📩</button>
                </div>
            </div>
            <div id="panel-templates" class="panel" style="display:none;margin-top:8px;border-top:1px solid ${T.inputBorder};padding-top:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:12px;color:${T.textMuted};">🧩 ШАБЛОНЫ (${settings.templates.length})</span>
                    <button id="btn-add-template" style="background:${T.accent};border:none;color:white;padding:3px 8px;border-radius:6px;cursor:pointer;font-size:11px;">➕</button>
                </div>
                <div id="templates-list"></div>
                <div id="add-template-form" style="display:none;margin-top:6px;border-top:1px solid ${T.inputBorder};padding-top:6px;">
                    <input type="text" id="tpl-name" placeholder="Название" style="width:100%;padding:5px;border:1px solid ${T.inputBorder};border-radius:6px;font-size:12px;outline:none;background:${T.inputBg};color:${T.text};margin-bottom:4px;">
                    <textarea id="tpl-prompt" placeholder="Описание для ИИ" style="width:100%;min-height:30px;padding:5px;border:1px solid ${T.inputBorder};border-radius:6px;font-size:11px;outline:none;background:${T.inputBg};color:${T.text};resize:vertical;margin-bottom:4px;"></textarea>
                    <textarea id="tpl-text" placeholder="Текст шаблона" style="width:100%;min-height:40px;padding:5px;border:1px solid ${T.inputBorder};border-radius:6px;font-size:11px;outline:none;background:${T.inputBg};color:${T.text};resize:vertical;margin-bottom:4px;"></textarea>
                    <input type="hidden" id="tpl-edit-id" value="">
                    <div style="display:flex;gap:6px;"><button id="btn-save-tpl" style="flex:1;background:${T.green};border:none;color:white;padding:5px;border-radius:6px;cursor:pointer;font-size:11px;">💾</button><button id="btn-cancel-tpl" style="flex:1;background:transparent;border:1px solid ${T.red};color:${T.red};padding:5px;border-radius:6px;cursor:pointer;font-size:11px;">✕</button></div>
                </div>
            </div>
            <div id="panel-stats" class="panel" style="display:none;margin-top:8px;border-top:1px solid ${T.inputBorder};padding-top:6px;"></div>
            <div id="panel-history" class="panel" style="display:none;margin-top:8px;border-top:1px solid ${T.inputBorder};padding-top:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><span style="font-size:12px;color:${T.textMuted};">📚</span><button id="btn-clear-history" style="background:none;border:none;color:${T.red};cursor:pointer;font-size:11px;">🗑</button></div>
                <div id="history-list"></div>
            </div>
            <div id="panel-settings" class="panel" style="display:none;margin-top:8px;border-top:1px solid ${T.inputBorder};padding-top:6px;">
                <div style="font-size:12px;color:${T.textMuted};margin-bottom:6px;">⚙️</div>
                <div style="font-size:11px;color:${T.textMuted};margin-bottom:4px;">ТЕМА</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;" id="theme-selector">${Object.entries(themes).map(([k,t])=>`<button class="theme-btn" data-theme="${k}" style="flex:1;min-width:70px;padding:5px;border-radius:6px;border:1px solid ${settings.theme===k?t.accent:T.inputBorder};background:${settings.theme===k?t.accent:'transparent'};color:${settings.theme===k?'white':T.text};cursor:pointer;font-size:10px;">${t.name}</button>`).join('')}</div>
                <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-bottom:6px;"><input type="checkbox" id="chk-auto-greeting-settings" ${settings.greetingEnabled?'checked':''} style="accent-color:${T.accent};"> Автоприветствие</label>
                <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin-bottom:8px;"><input type="checkbox" id="chk-autocopy" ${settings.autoCopy?'checked':''} style="accent-color:${T.accent};"> Автокопировать</label>
                <details><summary style="font-size:11px;color:${T.textMuted};cursor:pointer;">⌨️</summary><div style="margin-top:4px;display:flex;flex-direction:column;gap:3px;font-size:11px;">${['paraphrase|⟳','retry|🔄','copyFromChat|📋','pasteToChat|📩','toggleGreeting|✨','quickFriendly|😊','quickProfessional|💼','quickShort|✂️','quickPolite|🙏'].map(x=>{const[k,l]=x.split('|');return `<div style="display:flex;justify-content:space-between;align-items:center;"><span style="color:${T.textMuted};">${l}</span><input type="text" id="hk-${k}" value="${settings.hotkeys[k]||''}" style="width:50px;padding:3px;border-radius:4px;border:1px solid ${T.inputBorder};background:${T.inputBg};color:${T.text};text-align:center;font-size:11px;outline:none;"></div>`;}).join('\n')}<button id="btn-save-hotkeys" style="margin-top:4px;width:100%;padding:5px;border-radius:6px;border:1px solid ${T.accent};background:${T.accent};color:white;cursor:pointer;font-size:11px;">💾</button></div></details>
            </div>`;

        container.append(header, body);
        document.body.appendChild(container);

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'paraphrase-toggle-btn'; toggleBtn.innerHTML = '✦';
        toggleBtn.style.cssText = `position:fixed;bottom:20px;right:20px;width:48px;height:48px;background:linear-gradient(135deg,${T.accent},${T.accent2});color:white;border:none;border-radius:50%;font-size:20px;cursor:pointer;box-shadow:0 0 20px ${T.shadow};z-index:999998;display:flex;align-items:center;justify-content:center;`;
        toggleBtn.onmouseenter = () => toggleBtn.style.transform = 'scale(1.1)';
        toggleBtn.onmouseleave = () => toggleBtn.style.transform = 'scale(1)';
        toggleBtn.onclick = function() { const v = container.style.display !== 'none'; container.style.display = v ? 'none' : 'block'; toggleBtn.style.display = v ? 'flex' : 'none'; };
        document.body.appendChild(toggleBtn);

        // ===== КАЛЬКУЛЯТОР =====
        let cur = '0', prev = '', op = null, reset = false;
        function upd() { const d = document.getElementById('calc-display'); if (d) d.textContent = cur; }
        document.querySelectorAll('.calc-btn').forEach(b => {
            b.onclick = function() {
                const v = this.dataset.val;
                if (v === 'C') { cur = '0'; prev = ''; op = null; reset = false; }
                else if (v === '±') { cur = String(-parseFloat(cur)); }
                else if (v === '%') { cur = String(parseFloat(cur)/100); }
                else if (v === '⌫') { cur = cur.length>1?cur.slice(0,-1):'0'; }
                else if (['+','−','×','÷'].includes(v)) { if(op&&!reset)calc(); prev=cur; op=v; reset=true; }
                else if (v === '=') { calc(); op=null; reset=true; }
                else if (v === '.') { if(reset){cur='0.';reset=false;}else if(!cur.includes('.'))cur+='.'; }
                else { if(reset){cur=v;reset=false;}else cur=cur==='0'?v:cur+v; }
                upd();
            };
        });
        function calc() {
            if(!op||!prev)return;
            const a=parseFloat(prev),b=parseFloat(cur);
            switch(op){case'+':cur=String(a+b);break;case'−':cur=String(a-b);break;case'×':cur=String(a*b);break;case'÷':cur=b!==0?String(a/b):'Ошибка';break;}
            if(cur.length>15)cur=parseFloat(cur).toExponential(5);upd();
        }
        document.getElementById('calc-copy').onclick=function(){navigator.clipboard.writeText(cur).then(()=>{this.textContent='✅';setTimeout(()=>this.textContent='📋',2000);});};
        document.getElementById('calc-paste').onclick=function(){if(smartPasteToChat(cur)){this.textContent='✅';setTimeout(()=>this.textContent='📩',2000);}};

        // ===== РЕЖИМЫ =====
        const pm=document.getElementById('paraphrase-mode'),cm=document.getElementById('chat-mode'),cam=document.getElementById('calculator-mode'),mt=document.getElementById('mode-toggle'),ct=document.getElementById('calc-toggle'),ht=document.getElementById('header-title');
        let co=false;
        function sm(){chatMode=!chatMode;pm.style.display=chatMode?'none':'block';cm.style.display=chatMode?'block':'none';cam.style.display='none';co=false;mt.textContent=chatMode?'✏️':'💬';ht.textContent=chatMode?'✦ Чат':'✦ Помощник';settings.mode=chatMode?'chat':'paraphrase';saveSettings();}
        function tc(){co=!co;if(co){pm.style.display='none';cm.style.display='none';cam.style.display='block';ht.textContent='🧮';}else{cam.style.display='none';if(chatMode){cm.style.display='block';ht.textContent='✦ Чат';}else{pm.style.display='block';ht.textContent='✦ Помощник';}}}
        mt.onclick=sm;ct.onclick=tc;
        if(chatMode){pm.style.display='none';cm.style.display='block';mt.textContent='✏️';ht.textContent='✦ Чат';}

        // ===== ЧАТ =====
        const cmsg=document.getElementById('chat-messages'),cinp=document.getElementById('chat-input'),csnd=document.getElementById('chat-send');
        function acm(r,t){chatHistory.push({role:r,text:t});const d=document.createElement('div');d.style.cssText=`margin-bottom:8px;padding:6px 8px;border-radius:8px;font-size:12px;`;if(r==='user'){d.style.cssText+=`background:${T.primaryBg};border:1px solid ${T.primaryBorder};text-align:right;`;d.innerHTML=`<div style="color:${T.text};">${t}</div>`;}else{d.style.cssText+=`background:${T.resultBg};border:1px solid ${T.inputBorder};`;d.innerHTML=`<div style="color:${T.accent};font-size:10px;margin-bottom:2px;">🤖</div><div style="color:${T.text};">${t}</div>`;}cmsg.appendChild(d);cmsg.scrollTop=cmsg.scrollHeight;}
        function cc(){cmsg.innerHTML='<div style="color:'+T.textMuted+';text-align:center;padding:20px;">Задайте вопрос 👇</div>';chatHistory=[];}
        csnd.onclick=async function(){const t=cinp.value.trim();if(!t)return;cinp.value='';acm('user',t);const ld=document.createElement('div');ld.style.cssText=`color:${T.loadingText};font-size:11px;padding:4px 8px;`;ld.textContent='⏳';cmsg.appendChild(ld);cmsg.scrollTop=cmsg.scrollHeight;try{const r=await askAI([{role:'system',content:'Ты помощник.'},...chatHistory.filter(m=>m.role!=='system').slice(-10).map(m=>({role:m.role,content:m.text})),{role:'user',content:t}]);ld.remove();acm('assistant',r);}catch(e){ld.remove();acm('assistant','❌ '+e.message);}};
        cinp.addEventListener('keydown',function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();csnd.click();}});
        document.getElementById('chat-clear').onclick=cc;
        document.getElementById('chat-copy-all').onclick=function(){navigator.clipboard.writeText(chatHistory.map(m=>`${m.role==='user'?'Вы':'ИИ'}: ${m.text}`).join('\n\n')).then(()=>{this.textContent='✅';setTimeout(()=>this.textContent='📋',2000);});};

        // ===== ШАБЛОНЫ =====
        function renderTemplates(){const l=document.getElementById('templates-list');if(!l)return;if(!settings.templates.length){l.innerHTML='<div style="color:'+T.textMuted+';font-size:11px;text-align:center;padding:10px;">Нет шаблонов</div>';return;}l.innerHTML=settings.templates.map((t,i)=>`
            <div style="background:${T.inputBg};border-radius:6px;padding:6px;margin-bottom:4px;border:1px solid ${T.inputBorder};font-size:11px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
                    <span class="tpl-name" data-id="${t.id}" style="color:${T.text};font-weight:600;cursor:pointer;">${t.name} ✏️</span>
                    <div style="display:flex;gap:4px;">
                        <button class="tpl-toggle" data-i="${i}" style="background:none;border:1px solid ${t.enabled?T.green:T.red};color:${t.enabled?T.green:T.red};padding:1px 5px;border-radius:4px;cursor:pointer;font-size:10px;">${t.enabled?'✅':'⛔'}</button>
                        <button class="tpl-del" data-i="${i}" style="background:none;border:none;color:${T.red};cursor:pointer;font-size:11px;">🗑</button>
                    </div>
                </div>
                <div style="color:${T.textMuted};font-size:9px;">${t.template.substring(0,50)}${t.template.length>50?'...':''}</div>
            </div>`).join('');
            document.querySelectorAll('.tpl-toggle').forEach(b=>{b.onclick=function(){const i=parseInt(this.dataset.i);settings.templates[i].enabled=!settings.templates[i].enabled;saveSettings();renderTemplates();};});
            document.querySelectorAll('.tpl-del').forEach(b=>{b.onclick=function(){settings.templates.splice(parseInt(this.dataset.i),1);saveSettings();renderTemplates();};});
            document.querySelectorAll('.tpl-name').forEach(el=>{el.onclick=function(){const id=this.dataset.id,tpl=settings.templates.find(t=>t.id===id);if(tpl){document.getElementById('add-template-form').style.display='block';document.getElementById('tpl-name').value=tpl.name;document.getElementById('tpl-prompt').value=tpl.prompt;document.getElementById('tpl-text').value=tpl.template;document.getElementById('tpl-edit-id').value=tpl.id;document.getElementById('btn-save-tpl').textContent='💾 Обновить';}};});
        }
        document.getElementById('btn-add-template').onclick=function(){const f=document.getElementById('add-template-form');if(f.style.display==='block'){f.style.display='none';}else{f.style.display='block';document.getElementById('tpl-name').value='';document.getElementById('tpl-prompt').value='';document.getElementById('tpl-text').value='';document.getElementById('tpl-edit-id').value='';document.getElementById('btn-save-tpl').textContent='💾 Сохранить';}};
        document.getElementById('btn-cancel-tpl').onclick=function(){document.getElementById('add-template-form').style.display='none';};
        document.getElementById('btn-save-tpl').onclick=function(){const n=document.getElementById('tpl-name').value.trim(),p=document.getElementById('tpl-prompt').value.trim(),t=document.getElementById('tpl-text').value.trim(),eid=document.getElementById('tpl-edit-id').value;if(!n||!p||!t){alert('Заполните все поля');return;}if(eid){const idx=settings.templates.findIndex(x=>x.id===eid);if(idx!==-1){settings.templates[idx].name=n;settings.templates[idx].prompt=p;settings.templates[idx].template=t;showStatus('✅ Обновлён');}}else{settings.templates.push({id:'c_'+Date.now(),name:n,prompt:p,template:t,enabled:true});showStatus('✅ Добавлен');}saveSettings();renderTemplates();document.getElementById('btn-cancel-tpl').click();};

        // ===== ОБЩИЕ ОБРАБОТЧИКИ =====
        document.getElementById('main-close').onclick=function(){container.style.display='none';toggleBtn.style.display='flex';};
        let minimized=false;
        document.getElementById('main-minimize').onclick=function(){minimized=!minimized;body.style.display=minimized?'none':'block';this.textContent=minimized?'□':'—';};
        let dragging=false,ox,oy;
        header.onmousedown=function(e){if(e.target.tagName==='BUTTON')return;dragging=true;ox=e.clientX-container.getBoundingClientRect().left;oy=e.clientY-container.getBoundingClientRect().top;document.onmousemove=function(e){if(dragging){container.style.left=(e.clientX-ox)+'px';container.style.top=(e.clientY-oy)+'px';container.style.right='auto';container.style.bottom='auto';}};document.onmouseup=function(){dragging=false;document.onmousemove=null;document.onmouseup=null;};};
        let ap=null;
        document.querySelectorAll('.panel-btn').forEach(b=>{b.onclick=function(){const p=this.dataset.p,el=document.getElementById('panel-'+p);if(ap===p){el.style.display='none';ap=null;}else{document.querySelectorAll('.panel').forEach(x=>x.style.display='none');el.style.display='block';ap=p;if(p==='history')renderHistory();if(p==='stats')updateStats();if(p==='templates')renderTemplates();}};});
        function updateStats(){const panel=document.getElementById('panel-stats'),now=Date.now(),st=settings.stats,total=st.paraphrased+st.copied+st.pasted;panel.innerHTML=`<div style="font-size:12px;color:${T.textMuted};margin-bottom:6px;">📊</div><div style="background:${T.inputBg};border-radius:8px;padding:10px;border:1px solid ${T.inputBorder};"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;"><div style="color:${T.textMuted};">🔄</div><div style="color:${T.text};text-align:right;">${st.paraphrased}</div><div style="color:${T.textMuted};">📋</div><div style="color:${T.text};text-align:right;">${st.copied}</div><div style="color:${T.textMuted};">📩</div><div style="color:${T.text};text-align:right;">${st.pasted}</div><div style="color:${T.textMuted};">❌</div><div style="color:${st.errors>3?T.red:T.text};text-align:right;">${st.errors}</div><div style="color:${T.textMuted};">📝</div><div style="color:${T.text};text-align:right;">${(st.totalChars||0).toLocaleString()}</div><div style="color:${T.textMuted};">⏱</div><div style="color:${T.text};text-align:right;">${formatTime(now-(st.sessionStart||now))}</div><div style="color:${T.textMuted};">🧠</div><div style="color:${T.text};text-align:right;">${formatTime(now-SCRIPT_START_TIME)}</div><div style="color:${T.textMuted};">🎯</div><div style="color:${T.accent};text-align:right;font-weight:600;">${total}</div></div><div style="margin-top:8px;text-align:center;"><button id="btn-reset-stats" style="background:none;border:1px solid ${T.red};color:${T.red};padding:4px 12px;border-radius:6px;cursor:pointer;font-size:10px;">🔄</button></div></div>`;document.getElementById('btn-reset-stats').onclick=function(){settings.stats={paraphrased:0,copied:0,pasted:0,opened:0,errors:0,totalChars:0,sessionStart:Date.now()};saveSettings();updateStats();showStatus('📊 Сброшено');};}
        document.getElementById('greeting-toggle').onclick=function(){settings.greetingEnabled=!settings.greetingEnabled;saveSettings();this.textContent=settings.greetingEnabled?'✨':'🚫';this.style.background=settings.greetingEnabled?T.green:'transparent';this.style.color=settings.greetingEnabled?'white':T.red;document.getElementById('chk-auto-greeting-settings').checked=settings.greetingEnabled;if(!settings.greetingEnabled){stopProtection();alreadyGreeted=false;}};
        document.getElementById('chk-auto-greeting-settings').onchange=function(){document.getElementById('greeting-toggle').click();};
        document.getElementById('chk-autocopy').onchange=function(){settings.autoCopy=this.checked;saveSettings();};
        document.getElementById('btn-copy-from-chat').onclick=function(){const f=getChatField();if(f&&f.value){document.getElementById('paraphrase-input').value=f.value;showStatus('✅');}};
        document.getElementById('btn-retry-last').onclick=function(){if(history.length){document.getElementById('paraphrase-input').value=history[0].text;showStatus('✅');}else showStatus('📭');};
        document.getElementById('btn-submit').onclick=async function(){const text=document.getElementById('paraphrase-input').value.trim();if(!text){alert('Введите текст');return;}const style=document.getElementById('paraphrase-style').value,btn=this;btn.disabled=true;btn.textContent='⏳...';document.getElementById('paraphrase-loading').style.display='block';document.getElementById('paraphrase-result').style.display='none';try{const p={professional:'Перепиши в деловом стиле.',friendly:'Перепиши дружелюбно.',short:'Сократи.',polite:'Перепиши вежливо.',fix:'Исправь ошибки.',original:'Перефразируй.'},n={professional:'Деловой',friendly:'Дружелюбный',short:'Краткий',polite:'Вежливый',fix:'Исправление',original:'Перефразирование'};const r=await askAI([{role:'system',content:'Отвечай ТОЛЬКО перефразированным текстом.'},{role:'user',content:`${p[style]||p.original}\n\nТекст: "${text}"`}]);document.getElementById('paraphrase-result-text').textContent=r;document.getElementById('paraphrase-result').style.display='block';settings.stats.paraphrased++;settings.stats.totalChars+=text.length;saveSettings();addHistory(r,n[style]||style);showStatus('✅');if(settings.autoCopy)navigator.clipboard.writeText(r);}catch(e){document.getElementById('paraphrase-result-text').textContent='❌ '+e.message;document.getElementById('paraphrase-result').style.display='block';settings.stats.errors++;saveSettings();}finally{document.getElementById('paraphrase-loading').style.display='none';btn.disabled=false;btn.textContent='⟳';}};
        document.getElementById('btn-retry').onclick=function(){document.getElementById('btn-submit').click();};
        document.getElementById('btn-copy').onclick=function(){navigator.clipboard.writeText(document.getElementById('paraphrase-result-text').textContent).then(()=>{this.textContent='✅';settings.stats.copied++;saveSettings();setTimeout(()=>this.textContent='📋',2000);});};
        document.getElementById('btn-paste').onclick=function(){if(smartPasteToChat(document.getElementById('paraphrase-result-text').textContent)){this.textContent='✅';settings.stats.pasted++;saveSettings();setTimeout(()=>this.textContent='📩',2000);}};
        document.querySelectorAll('.quick-tone').forEach(b=>{b.onclick=function(){const t=document.getElementById('paraphrase-result-text');if(t&&t.textContent&&!t.textContent.startsWith('❌')){document.getElementById('paraphrase-input').value=t.textContent;document.getElementById('paraphrase-style').value=this.dataset.s;document.getElementById('btn-submit').click();}};});
        document.querySelectorAll('.theme-btn').forEach(b=>{b.onclick=function(){settings.theme=this.dataset.theme;saveSettings();showStatus('🎨 '+themes[settings.theme].name);setTimeout(()=>location.reload(),500);};});
        document.getElementById('btn-save-hotkeys').onclick=function(){['paraphrase','retry','copyFromChat','pasteToChat','toggleGreeting','quickFriendly','quickProfessional','quickShort','quickPolite'].forEach(f=>{const e=document.getElementById('hk-'+f);if(e)settings.hotkeys[f]=e.value||' ';});saveSettings();showStatus('✅');};
        document.getElementById('btn-clear-history').onclick=function(){history=[];localStorage.setItem('ozon_crm_history','[]');renderHistory();showStatus('🗑');};
        function renderHistory(){const l=document.getElementById('history-list');if(!l)return;if(!history.length){l.innerHTML='<div style="color:'+T.textMuted+';font-size:11px;text-align:center;padding:15px;">Пусто</div>';return;}l.innerHTML=history.slice(0,10).map(i=>`<div style="background:${T.inputBg};border-radius:6px;padding:7px;margin-bottom:4px;cursor:pointer;border:1px solid ${T.inputBorder};font-size:11px;" onclick="document.getElementById('paraphrase-input').value='${i.text.replace(/'/g,"\\'").replace(/"/g,'&quot;').replace(/\n/g,'\\n')}';showStatus('✅');"><div style="display:flex;justify-content:space-between;color:${T.textMuted};font-size:10px;margin-bottom:3px;"><span>${i.type}</span><span>${i.date}</span></div><div style="color:${T.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.text.substring(0,80)}${i.text.length>80?'...':''}</div></div>`).join('');}

        console.log('✅ Ozon CRM v9.5 — готово!');
    }, 2000);

    // Автоанализ
    setInterval(() => {
        const c = document.getElementById('paraphrase-container');
        if (!c || c.style.display === 'none' || templatePopupVisible) return;
        analyzeClientMessages();
    }, 5000);

    // Проверка обновлений
    setTimeout(checkForUpdates, 10000);
    setInterval(checkForUpdates, 3600000);
})();
