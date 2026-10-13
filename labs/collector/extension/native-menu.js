/* Keep X's real menu, event handlers and follow-up dialogs intact. */
(() => {
  'use strict';
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const atDetail = s => location.origin === new URL(s.originalURL).origin && location.pathname.match(/^\/(?:[A-Za-z0-9_]{1,15}|i\/web)\/status\/(\d+)\/?$/)?.[1] === s.g.id;
  const shown = el => el.isConnected && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const popups = () => [...document.querySelectorAll('[data-testid="Dropdown"], [role="menu"], [role="dialog"]')]
    .filter(shown).filter((el, _, all) => !all.some(parent => parent !== el && parent.contains(el)));
  globalThis.XIFNativeMenu = class {
    constructor(hooks) { this.hooks = hooks; this.session = null; }
    get active() { return !!this.session; }
    get hasDialog() { return !!this.session && popups().some(el => el.getAttribute('role') === 'dialog' && !this.session.before.has(el)); }
    async open(g, anchor) {
      if (this.session) { const same = this.session.anchor === anchor; this.close(); if (same) return; }
      if (popups().length) throw Error('请先关闭 X 当前的菜单或弹窗');
      const s = this.session = {g, anchor, anchorRect: anchor.getBoundingClientRect(), originalURL: location.href, originalState: history.state, scroll: [scrollX, scrollY], styles: new Map(), listeners: new Map(), before: new Set(popups()), awaiting: true};
      this.hooks.busy(true); anchor.setAttribute('aria-expanded', 'true');
      try {
        let article = this.hooks.article(g.id);
        if (!article) {
          this.hooks.loading?.();
          // Same-tab routing lets X fetch the original tweet with its own login and API.
          s.detailURL = `${location.origin}/i/web/status/${g.id}`;
          history.replaceState(history.state, '', s.detailURL);
          window.dispatchEvent(new PopStateEvent('popstate', {state: history.state}));
          for (let i = 0; i < 100 && this.session === s; i++) { await pause(100); article = this.hooks.article(g.id); if (article) break; }
        }
        if (this.session !== s) return;
        // Match the original tweet, never use the enclosing quote/retweet's caret.
        s.caret = [...(article?.querySelectorAll('[data-testid="caret"]') || [])].find(el => el.closest('article[data-testid="tweet"]') === article);
        if (!s.caret) throw Error('X 原帖菜单暂未载入，请稍后再试');
        s.caret.click();
        for (let i = 0; i < 40 && this.session === s; i++) {
          await pause(75); const menus = popups().filter(el => !s.before.has(el));
          if (menus.length) { this.refresh(s); break; }
        }
        if (this.session !== s) return;
        if (!s.styles.size) throw Error('X 菜单暂不可用，请稍后重试');
        s.awaiting = false;
        s.timer = setInterval(() => { try { this.refresh(s); } catch { this.close(); } }, 120);
      } catch (error) { if (this.session === s) this.close(); throw error; }
    }
    refresh(s) {
      if (this.session !== s) return;
      // Navigation selected from X's own menu belongs to X; do not overwrite it.
      if (s.detailURL ? !atDetail(s) : location.href !== s.originalURL) { this.close(false); this.hooks.navigate?.(); return; }
      const list = popups().filter(el => !s.before.has(el));
      if (!list.length) {
        if (!s.awaiting && !s.closeTimer) s.closeTimer = setTimeout(() => { s.closeTimer = null; if (!popups().some(el => !s.before.has(el))) this.close(); }, 900);
        return;
      }
      clearTimeout(s.closeTimer); s.closeTimer = null;
      for (const el of list) {
        if (!s.styles.has(el)) {
          if (typeof el.showPopover !== 'function') throw Error('当前 Chrome 不支持原生菜单浮层，请更新浏览器');
          const original = {style: el.getAttribute('style'), popover: el.getAttribute('popover')}; s.styles.set(el, original);
          el.setAttribute('popover', 'manual');
          const dialog = el.getAttribute('role') === 'dialog';
          el.style.cssText += ';position:fixed!important;inset:auto!important;margin:0!important;max-height:calc(100vh - 32px)!important;overflow:auto!important;box-sizing:border-box!important;';
          el.showPopover();
          if (dialog) { el.style.left = '50%'; el.style.top = '50%'; el.style.transform = 'translate(-50%,-50%)'; el.style.maxWidth = 'calc(100vw - 32px)'; }
          else {
            el.style.transform = 'none'; el.style.width = 'max-content'; el.style.minWidth = '240px'; el.style.maxWidth = 'min(340px,calc(100vw - 24px))';
            this.addLocal(s, el);
            const feedback = event => {
              const item = event.target.closest('[role="menuitem"]');
              if (!item || item.dataset.xifLocal) return;
              if (/对此.*不感兴趣|Not interested in this (post|tweet)|^(?:隐藏|Hide this (?:post|tweet)|Mute @\w+)$/i.test(item.textContent.trim())) this.hooks.hide(s.g);
            };
            el.addEventListener('click', feedback); s.listeners.set(el, feedback);
            el.querySelector('[role="menuitem"]')?.focus({preventScroll: true});
          }
        }
        if (el.getAttribute('role') !== 'dialog') {
          if (!el.querySelector('[data-xif-local="footer"]')) this.addLocal(s, el);
          const a = s.anchor.isConnected ? (s.anchorRect = s.anchor.getBoundingClientRect()) : s.anchorRect, box = el.getBoundingClientRect();
          el.style.left = `${Math.max(12, Math.min(innerWidth - box.width - 12, a.right - box.width))}px`;
          el.style.top = `${Math.max(16, Math.min(innerHeight - box.height - 16, a.bottom + 6))}px`;
        }
      }
    }
    addLocal(s, menu) {
      const footer = document.createElement('div'); footer.dataset.xifLocal = 'footer'; footer.style.cssText = 'border-top:1px solid #333639;margin-top:4px;padding-top:4px';
      for (const [label, action] of [['仅在拾图隐藏这条', () => this.hooks.hide(s.g)], ['管理拾图隐藏', () => this.hooks.manage()]]) {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.xifLocal = 'item'; b.setAttribute('role', 'menuitem');
        b.style.cssText = 'display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;padding:12px 16px;cursor:pointer';
        b.onmouseenter = () => b.style.background = '#ffffff12'; b.onmouseleave = () => b.style.background = 'transparent';
        b.onclick = event => { event.stopPropagation(); this.close(); action(); }; footer.append(b);
      }
      menu.append(footer); s.footers ||= []; s.footers.push(footer);
    }
    close(restore = true) {
      const s = this.session; if (!s) return; this.session = null;
      clearInterval(s.timer); clearTimeout(s.closeTimer);
      // Let X close the real menu; keep X's own dialog handlers and confirmations.
      const menu = [...s.styles.keys()].find(el => shown(el) && el.getAttribute('role') !== 'dialog');
      if (menu && s.caret?.isConnected) s.caret.click();
      for (const footer of s.footers || []) footer.remove();
      for (const [el, old] of s.styles) {
        if (s.listeners.has(el)) el.removeEventListener('click', s.listeners.get(el));
        if (el.matches(':popover-open')) el.hidePopover();
        if (old.popover === null) el.removeAttribute('popover'); else el.setAttribute('popover', old.popover);
        if (old.style === null) el.removeAttribute('style'); else el.setAttribute('style', old.style);
      }
      if (restore && s.detailURL && atDetail(s)) {
        history.replaceState(s.originalState, '', s.originalURL);
        window.dispatchEvent(new PopStateEvent('popstate', {state: s.originalState}));
        window.scrollTo(...s.scroll);
      }
      s.anchor.setAttribute('aria-expanded', 'false'); this.hooks.busy(false); if (s.anchor.isConnected) s.anchor.focus({preventScroll: true});
    }
  };
})();
