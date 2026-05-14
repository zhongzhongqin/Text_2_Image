// ==UserScript==
// @name         文本轉圖片工具 (穩定沉浸版 V8.2) webpage-text-2-image
// @namespace    http://tampermonkey.net/
// @version      8.2
// @description  取消懸浮回歸左右穩定佈局，保留 QR Code 與所有高階排版功能
// @author       Coverlone & Gemini
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      api.qrserver.com
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. 卡片渲染核心樣式 ---
    const cardStyles = `
        :root {
            --c-bg: #F4F5F7; --c-card: #FFFFFF; --c-accent: #4A90E2;
            --c-title: #1A202C; --c-content: #2C3E50; --c-idea: #475569;
            --f-title: system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif;
            --f-content: system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif;
            --f-idea: system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif;
        }
        #txt2img-card-wrapper { background: var(--c-bg); padding: 50px; border-radius: 24px; width: 840px; box-sizing: border-box; display: inline-flex; flex-direction: column; gap: 20px; text-align: left; margin: 0 auto; position: relative; }
        .t2i-card-inner { background: var(--c-card); border-radius: 16px; padding: 40px; box-shadow: 0 12px 30px rgba(0,0,0,0.08); display: flex; flex-direction: column; gap: 24px; }
        .t2i-header { display: flex; flex-direction: column; gap: 6px; }
        .t2i-title-main { color: var(--c-title); font-family: var(--f-title); font-size: 34px; font-weight: bold; line-height: 1.3; margin:0; }
        .t2i-title-sub { color: var(--c-title); font-family: var(--f-title); font-size: 20px; opacity: 0.7; margin:0; }
        .t2i-content-box { border-left: 6px solid var(--c-accent); padding-left: 20px; border-radius: 3px; }
        .t2i-content { color: var(--c-content); font-family: var(--f-content); font-size: 24px; line-height: 1.6; word-break: break-word; }
        .t2i-content ruby { font-size: 1.1em; }
        .t2i-content sup { color: var(--c-accent); font-weight: bold; }

        .t2i-ext-link { color: #3366cc; text-decoration: none; }
        #txt2img-card-wrapper.t2i-no-blue .t2i-ext-link { color: inherit; font-weight: bold; border-bottom: 2px solid var(--c-accent); padding-bottom: 2px; }

        .t2i-references { margin-top: 24px; padding-top: 20px; border-top: 2px dashed rgba(150,150,150,0.2); font-size: 16px; color: var(--c-content); opacity: 0.85; }
        .t2i-ref-title { font-weight: bold; margin-bottom: 12px; font-size: 18px; color: var(--c-accent); display: flex; align-items: center; gap: 6px; }
        .t2i-ref-item { margin-bottom: 12px; line-height: 1.5; display: flex; align-items: flex-start; gap: 8px; font-size: 15px; }
        .t2i-ref-num { color: var(--c-accent); font-weight: bold; white-space: nowrap; font-family: Arial, sans-serif; }
        .t2i-ref-text { flex: 1; word-break: break-word; }
        .t2i-ref-url { color: var(--c-content); opacity: 0.4; font-size: 0.85em; margin-left: 4px; font-family: Arial, sans-serif; }

        .t2i-idea-box { background: rgba(100, 116, 139, 0.06); padding: 20px; border-radius: 12px; display: flex; flex-direction: column; gap: 10px; }
        .t2i-idea-label { color: var(--c-accent); font-family: var(--f-idea); font-size: 16px; font-weight: bold; display: flex; align-items: center; gap: 6px; }
        .t2i-idea { color: var(--c-idea); font-family: var(--f-idea); font-size: 20px; line-height: 1.5; opacity: 0.9; margin: 0; word-break: break-word; }
        .t2i-footer { border-top: 1px solid rgba(150, 150, 150, 0.2); padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
        .t2i-meta { color: var(--c-content); opacity: 0.5; font-family: Arial, sans-serif; font-size: 14px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .t2i-author-qr-group { display: flex; align-items: flex-end; gap: 15px; }
        .t2i-author { font-family: var(--f-title); font-size: 18px; font-weight: bold; color: var(--c-title); opacity: 0.8; margin-bottom: 5px; }
        #p-qrcode { background: white; padding: 4px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); display: none; }
        #p-qrcode img { display: block; border-radius: 4px; width: 50px; height: 50px; }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = 'txt2img-dynamic-styles'; styleEl.innerHTML = cardStyles;
    document.head.appendChild(styleEl);

    // --- 2. 編輯器 UI 樣式 (穩定左右佈局) ---
    GM_addStyle(`
        #txt2img-btn { position: absolute; z-index: 2147483647; display: none; background: #2C3E50; color: white; border: none; padding: 10px 18px; border-radius: 30px; cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,0.25); font-weight: bold; font-family: sans-serif; transition: 0.2s; }
        #txt2img-btn:hover { background: #1A252F; transform: scale(1.05); }

        #txt2img-editor-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 2147483647; display: none; justify-content: center; align-items: center; font-family: sans-serif; }
        #txt2img-editor-overlay * { box-sizing: border-box; }

        #txt2img-editor-container { display: flex; width: 95vw; max-width: 1400px; height: 90vh; background: #f8f9fa; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.4); }

        #txt2img-sidebar { width: 420px; background: white; padding: 25px 20px; overflow-y: auto; border-right: 1px solid #e0e0e0; display: flex; flex-direction: column; gap: 15px; flex-shrink: 0; }
        .t2i-sidebar-header { font-size: 18px; font-weight: bold; color: #333; margin-bottom: 5px; display: flex; align-items: center; gap: 8px; }

        .t2i-panel-section { background: #fcfcfc; border: 1px solid #eee; padding: 12px; border-radius: 8px; }
        .t2i-input-row { display: flex; gap: 8px; margin-bottom: 8px; }
        .t2i-input { flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; width: 100%; outline: none; }
        .t2i-checkbox-label { font-size: 13px; color: #444; display: flex; align-items: center; gap: 6px; cursor: pointer; margin-bottom: 5px; font-weight: bold; }
        .t2i-richtext { min-height: 100px; max-height: 250px; overflow-y: auto; background: white; cursor: text; line-height: 1.6; outline: none; border: 1px solid #ddd; border-radius: 6px; padding: 12px; font-size: 14px; }
        .t2i-richtext sup { color: #4A90E2; font-weight: bold; }

        .t2i-toolbar { display: flex; gap: 10px; align-items: center; background: #f0f2f5; padding: 6px; border-radius: 6px; margin-top: 6px; }
        .t2i-select { flex: 1; padding: 4px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; outline: none; }
        .t2i-color-btn { display: flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; }
        .t2i-color-btn input { width: 20px; height: 20px; padding: 0; border: none; cursor: pointer; border-radius: 4px; }

        .t2i-theme-tabs { display: flex; background: #eee; border-radius: 8px; padding: 4px; gap: 4px; margin-bottom: 5px; }
        .t2i-theme-tab { flex: 1; padding: 6px; text-align: center; font-size: 12px; cursor: pointer; border-radius: 6px; color: #555; transition: 0.2s; }
        .t2i-theme-tab.active { background: white; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); color: #333; }

        .t2i-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
        .t2i-btn-group { display: flex; gap: 10px; }
        .t2i-btn { flex: 1; padding: 12px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 14px; }
        .btn-cancel { background: #e0e0e0; color: #555; } .btn-dl { background: #4A90E2; color: white; }

        #txt2img-preview-area { flex: 1; background: #eaebed; overflow-y: auto; padding: 40px 20px; background-image: radial-gradient(#d5d5d5 1px, transparent 0); background-size: 20px 20px; display: flex; justify-content: center; align-items: flex-start; }
    `);

    // --- 3. 構建 UI 骨架 ---
    const btn = document.createElement('button'); btn.id = 'txt2img-btn'; btn.innerText = '🎨 製作知識卡片'; document.body.appendChild(btn);
    const fontOpts = `<option value='system-ui, "PingFang TC", "Microsoft JhengHei", sans-serif'>現代無襯線</option><option value='"Noto Serif TC", "PMingLiU", serif'>傳統明體</option><option value='"LXGW WenKai TC", "DFKai-SB", cursive'>手寫楷體</option><option value='monospace'>等寬代碼體</option>`;
    const emojiOpts = `<option value="💡">💡 想法</option><option value="📌">📌 重點</option><option value="⭐">⭐ 收藏</option><option value="🔥">🔥 熱門</option><option value="📝">📝 筆記</option><option value="⚠️">⚠️ 注意</option><option value="💬">💬 評論</option><option value="🌐">🌐 翻譯</option>`;

    const overlay = document.createElement('div'); overlay.id = 'txt2img-editor-overlay';
    overlay.innerHTML = `
        <div id="txt2img-editor-container">
            <div id="txt2img-sidebar">
                <div class="t2i-sidebar-header">🎛️ 卡片編輯面板</div>
                <div class="t2i-theme-tabs"><div class="t2i-theme-tab active" data-theme="auto">💻 自動</div><div class="t2i-theme-tab" data-theme="light">☀️ 淺色</div><div class="t2i-theme-tab" data-theme="dark">🌙 深色</div></div>
                <div class="t2i-panel-section">
                    <div class="t2i-input-row"><input type="text" id="i-title" class="t2i-input" placeholder="主標題 (自動抓取)"></div>
                    <div class="t2i-input-row"><input type="text" id="i-sub" class="t2i-input" placeholder="副標題 (選填)"></div>
                    <div class="t2i-toolbar"><select id="f-title" class="t2i-select">${fontOpts}</select><label class="t2i-color-btn"><input type="color" id="c-title"> 標題色</label></div>
                </div>
                <div class="t2i-panel-section">
                    <label class="t2i-checkbox-label" title="關閉時，將藍字轉換為加粗底線的純文字樣式"><input type="checkbox" id="i-link-style" checked> 🔗 保留藍色超連結</label>
                    <div id="i-content" class="t2i-richtext" contenteditable="true"></div>
                    <div class="t2i-toolbar"><select id="f-content" class="t2i-select">${fontOpts}</select><label class="t2i-color-btn"><input type="color" id="c-content"> 內文色</label></div>
                </div>
                <div class="t2i-panel-section">
                    <div class="t2i-input-row"><select id="i-emoji" class="t2i-input" style="width: 80px; flex: none;">${emojiOpts}</select><input type="text" id="i-idea-label" class="t2i-input" value="我的筆記" placeholder="標籤名稱"></div>
                    <textarea id="i-idea" class="t2i-input" placeholder="輸入見解、翻譯或補充說明..." style="height: 60px;"></textarea>
                    <div class="t2i-toolbar"><select id="f-idea" class="t2i-select">${fontOpts}</select><label class="t2i-color-btn"><input type="color" id="c-idea"> 筆記色</label></div>
                </div>
                <div class="t2i-panel-section">
                    <div class="t2i-input-row"><input type="text" id="i-author" class="t2i-input" placeholder="✍️ 署名 (選填)"></div>
                    <div class="t2i-input-row"><input type="text" id="i-url" class="t2i-input" placeholder="來源網址 (自動生成 QR Code)"></div>
                    <div class="t2i-toolbar" style="justify-content: space-between;"><label class="t2i-color-btn"><input type="color" id="c-bg"> 背景</label><label class="t2i-color-btn"><input type="color" id="c-card"> 卡片</label><label class="t2i-color-btn"><input type="color" id="c-accent"> 裝飾</label></div>
                </div>
                <div class="t2i-actions">
                    <input type="text" id="i-filename" class="t2i-input" placeholder="導出檔名 (預設：日期_標題)">
                    <div class="t2i-btn-group"><button class="t2i-btn btn-cancel" id="btn-close">關閉預覽</button><button class="t2i-btn btn-dl" id="btn-download">⬇️ 下載圖片</button></div>
                </div>
            </div>

            <div id="txt2img-preview-area">
                <div id="txt2img-card-wrapper">
                    <div class="t2i-card-inner">
                        <div class="t2i-header" id="p-header"><h1 class="t2i-title-main" id="p-title"></h1><p class="t2i-title-sub" id="p-sub"></p></div>
                        <div class="t2i-content-box" id="p-content-box"><div class="t2i-content" id="p-content"></div></div>
                        <div class="t2i-idea-box" id="p-idea-box"><div class="t2i-idea-label"><span id="p-emoji"></span><span id="p-idea-label"></span></div><div class="t2i-idea" id="p-idea"></div></div>
                        <div class="t2i-footer">
                            <div class="t2i-meta"><span id="p-url"></span><span id="p-time"></span></div>
                            <div class="t2i-author-qr-group">
                                <div class="t2i-author" id="p-author"></div>
                                <div id="p-qrcode"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const els = {
        iTitle: document.getElementById('i-title'), iSub: document.getElementById('i-sub'), iContent: document.getElementById('i-content'), iIdea: document.getElementById('i-idea'),
        iEmoji: document.getElementById('i-emoji'), iIdeaLabel: document.getElementById('i-idea-label'), iAuthor: document.getElementById('i-author'), iUrl: document.getElementById('i-url'),
        iFilename: document.getElementById('i-filename'), iLinkStyle: document.getElementById('i-link-style'),
        cBg: document.getElementById('c-bg'), cCard: document.getElementById('c-card'), cAccent: document.getElementById('c-accent'), cTitle: document.getElementById('c-title'), cContent: document.getElementById('c-content'), cIdea: document.getElementById('c-idea'),
        fTitle: document.getElementById('f-title'), fContent: document.getElementById('f-content'), fIdea: document.getElementById('f-idea'),
        pTitle: document.getElementById('p-title'), pSub: document.getElementById('p-sub'), pHeader: document.getElementById('p-header'), pContent: document.getElementById('p-content'), pContentBox: document.getElementById('p-content-box'),
        pIdea: document.getElementById('p-idea'), pIdeaBox: document.getElementById('p-idea-box'), pEmoji: document.getElementById('p-emoji'), pIdeaLabel: document.getElementById('p-idea-label'),
        pAuthor: document.getElementById('p-author'), pUrl: document.getElementById('p-url'), pTime: document.getElementById('p-time'), pQr: document.getElementById('p-qrcode'), wrapper: document.getElementById('txt2img-card-wrapper')
    };
    const rootStyle = document.documentElement.style;

    // --- 4. 網址降噪與註解爬蟲引擎 ---
    function truncateUrl(url, maxLength = 45) {
        if (!url) return '';
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }

    function extractRichText() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return '';
        const div = document.createElement('div');
        div.appendChild(sel.getRangeAt(0).cloneContents());

        let refsHtml = ''; let refMap = {};
        const refLinks = div.querySelectorAll('sup a, a.reference, a[href*="#ref"], a[href*="#cite"], a[href*="#note"], a[class*="ref"]');

        refLinks.forEach(a => {
            const targetId = a.hash;
            if (targetId && targetId.length > 1) {
                try {
                    const targetEl = document.querySelector(targetId.replace(/([\.])/g, '\\$1'));
                    if (targetEl && !refMap[targetId]) {
                        const targetClone = targetEl.cloneNode(true);
                        targetClone.querySelectorAll('.mw-cite-backlink, a[href^="#cite_ref"], sup').forEach(e => e.remove());

                        targetClone.querySelectorAll('a').forEach(aTag => {
                            let absoluteUrl = aTag.href; let text = aTag.textContent;
                            let span = document.createElement('span');

                            if (absoluteUrl && !absoluteUrl.startsWith('javascript:') && !absoluteUrl.includes(window.location.pathname + '#')) {
                                let displayUrl = absoluteUrl;
                                try { displayUrl = decodeURI(absoluteUrl); } catch(e) {}
                                displayUrl = truncateUrl(displayUrl);
                                span.innerHTML = `<span class="t2i-ext-link">${text}</span> <span class="t2i-ref-url">[${displayUrl}]</span>`;
                            } else {
                                span.innerHTML = `<span class="t2i-ext-link">${text}</span>`;
                            }
                            aTag.replaceWith(span);
                        });

                        let refHtml = targetClone.innerHTML.replace(/^[↑\^]\s*/, '').trim();
                        if (refHtml) {
                            refMap[targetId] = refHtml;
                            let refNum = a.textContent.trim().replace(/\[|\]/g, '') || '*';
                            refsHtml += `<div class="t2i-ref-item"><span class="t2i-ref-num">${refNum}. ^ </span><div class="t2i-ref-text">${refHtml}</div></div>`;
                        }
                    }
                } catch(e) {}
            }
        });

        div.querySelectorAll('img, svg, canvas, video, audio, script, style, iframe, nav, form, button, object, embed').forEach(e => e.remove());
        div.querySelectorAll('*').forEach(el => {
            el.removeAttribute('style'); el.removeAttribute('class'); el.removeAttribute('id');
            if(el.tagName === 'A') {
                const span = document.createElement('span');
                span.className = 't2i-ext-link';
                span.innerHTML = el.innerHTML;
                el.replaceWith(span);
            }
        });

        let finalHtml = div.innerHTML.trim();
        if (refsHtml) {
            finalHtml += `<div class="t2i-references" contenteditable="false"><div class="t2i-ref-title">📚 參考文獻 / 註解</div>${refsHtml}</div>`;
        }
        return finalHtml;
    }

    // --- 5. 非同步 QR Code 生成引擎 ---
    let qrTimeout = null;
    let lastQrUrl = '';

    function fetchAndRenderQR() {
        const url = els.iUrl.value.trim();
        if (!url) { els.pQr.style.display = 'none'; lastQrUrl = ''; return; }
        if (url === lastQrUrl) return;
        lastQrUrl = url;

        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=1&data=${encodeURIComponent(url)}`,
            responseType: 'blob',
            onload: function(res) {
                if (res.status === 200) {
                    const reader = new FileReader();
                    reader.onloadend = function() {
                        els.pQr.innerHTML = `<img src="${reader.result}">`;
                        els.pQr.style.display = 'block';
                    }
                    reader.readAsDataURL(res.response);
                }
            }
        });
    }

    // --- 6. 觸發與同步更新 ---
    document.addEventListener('mouseup', (e) => {
        if (e.target.closest('#txt2img-editor-overlay') || e.target.closest('#txt2img-btn')) return;
        setTimeout(() => {
            if (window.getSelection().toString().trim()) {
                btn.style.left = `${e.pageX + 10}px`; btn.style.top = `${e.pageY + 15}px`; btn.style.display = 'block';
            } else { btn.style.display = 'none'; }
        }, 10);
    });

    btn.addEventListener('mousedown', (e) => {
        e.preventDefault(); btn.style.display = 'none';
        els.iContent.innerHTML = extractRichText();
        let pageTitle = document.title.split(/ - | _ | \| /)[0].trim();
        els.iTitle.value = pageTitle || '';
        els.iSub.value = ''; els.iIdea.value = ''; els.iAuthor.value = ''; els.iFilename.value = '';
        try { els.iUrl.value = decodeURIComponent(window.location.href); } catch(err) { els.iUrl.value = window.location.href; }

        applyTheme('auto');
        syncPreview();
        fetchAndRenderQR();
        overlay.style.display = 'flex'; // 恢復彈出為居中的 Flex 容器
    });

    document.getElementById('btn-close').addEventListener('click', () => overlay.style.display = 'none');

    function syncPreview() {
        els.pTitle.innerText = els.iTitle.value; els.pSub.innerText = els.iSub.value;
        els.pHeader.style.display = (els.iTitle.value || els.iSub.value) ? 'flex' : 'none';
        els.pSub.style.display = els.iSub.value ? 'block' : 'none';
        els.pContent.innerHTML = els.iContent.innerHTML;
        els.pContentBox.style.display = els.iContent.innerHTML ? 'block' : 'none';
        els.pEmoji.innerText = els.iEmoji.value; els.pIdeaLabel.innerText = els.iIdeaLabel.value;
        els.pIdea.innerHTML = els.iIdea.value.replace(/\n/g, '<br>');
        els.pIdeaBox.style.display = els.iIdea.value ? 'flex' : 'none';
        els.pAuthor.innerText = els.iAuthor.value ? `— ${els.iAuthor.value}` : '';
        els.pUrl.innerText = els.iUrl.value ? `🔗 ${truncateUrl(els.iUrl.value, 60)}` : '';
        const now = new Date();
        els.pTime.innerText = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

        if (els.iLinkStyle.checked) els.wrapper.classList.remove('t2i-no-blue');
        else els.wrapper.classList.add('t2i-no-blue');

        rootStyle.setProperty('--c-bg', els.cBg.value); rootStyle.setProperty('--c-card', els.cCard.value); rootStyle.setProperty('--c-accent', els.cAccent.value);
        rootStyle.setProperty('--c-title', els.cTitle.value); rootStyle.setProperty('--c-content', els.cContent.value); rootStyle.setProperty('--c-idea', els.cIdea.value);
        rootStyle.setProperty('--f-title', els.fTitle.value); rootStyle.setProperty('--f-content', els.fContent.value); rootStyle.setProperty('--f-idea', els.fIdea.value);
    }

    ['input', 'change'].forEach(evt => {
        Object.values(els).forEach(el => {
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) {
                el.addEventListener(evt, syncPreview);
                if (el === els.iUrl) {
                    el.addEventListener(evt, () => {
                        clearTimeout(qrTimeout);
                        qrTimeout = setTimeout(fetchAndRenderQR, 500);
                    });
                }
            }
        });
    });

    const themes = {
        light: { bg: '#F4F5F7', card: '#FFFFFF', title: '#1A202C', content: '#2C3E50', idea: '#475569', accent: '#4A90E2' },
        dark:  { bg: '#121212', card: '#1E1E1E', title: '#F8FAFC', content: '#CBD5E1', idea: '#94A3B8', accent: '#38BDF8' }
    };
    function applyTheme(mode) {
        let active = mode === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
        const t = themes[active];
        els.cBg.value = t.bg; els.cCard.value = t.card; els.cAccent.value = t.accent; els.cTitle.value = t.title; els.cContent.value = t.content; els.cIdea.value = t.idea; syncPreview();
    }
    document.querySelectorAll('.t2i-theme-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.t2i-theme-tab').forEach(t => t.classList.remove('active')); e.target.classList.add('active'); applyTheme(e.target.dataset.theme);
        });
    });

    // --- 7. SVG 硬體裁切導出 ---
    document.getElementById('btn-download').addEventListener('click', () => {
        const cardNode = document.getElementById('txt2img-card-wrapper');
        const width = cardNode.offsetWidth; const height = cardNode.offsetHeight;

        const inlineStyles = `:root { --c-bg:${els.cBg.value}; --c-card:${els.cCard.value}; --c-accent:${els.cAccent.value}; --c-title:${els.cTitle.value}; --c-content:${els.cContent.value}; --c-idea:${els.cIdea.value}; --f-title:${els.fTitle.value}; --f-content:${els.fContent.value}; --f-idea:${els.fIdea.value}; }`;
        const clone = cardNode.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        const htmlStr = new XMLSerializer().serializeToString(clone);

        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><style>${cardStyles} ${inlineStyles}</style>${htmlStr}</foreignObject></svg>`;

        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');

            ctx.clearRect(0, 0, width, height);
            ctx.beginPath();
            ctx.roundRect(0, 0, width, height, 24);
            ctx.clip();
            ctx.drawImage(img, 0, 0);

            const d = new Date();
            const timeStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
            let cleanTitle = (els.iTitle.value.trim() || '知識卡片').replace(/[\\/:*?"<>|]/g, '');
            let filename = els.iFilename.value.trim() || `${timeStr}_${cleanTitle}`;
            if (!filename.toLowerCase().endsWith('.png')) filename += '.png';

            const a = document.createElement('a');
            a.download = filename;
            a.href = canvas.toDataURL('image/png', 1.0);
            a.click();
        };
    });
})();
