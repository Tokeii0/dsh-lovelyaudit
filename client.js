window.__ModuleLoader__.load({
  id: 'dsh-lovelyaudit',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const jsx = require('react/jsx-runtime')

    const css = [
      '.aw-page{height:100%;display:flex;flex-direction:column;overflow:hidden;background:transparent;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.45}',
      '.aw-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:12px 14px 10px;border-bottom:1px solid var(--dsw-alias-border-l1);background:transparent}',
      '.aw-brand{display:flex;gap:12px;align-items:flex-start;min-width:0}',
      '.aw-mark{width:36px;height:36px;border-radius:10px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);display:flex;align-items:center;justify-content:center;flex:none}',
      '.aw-title{font-size:16px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.aw-sub{color:var(--dsw-alias-label-secondary);margin-top:2px}',
      '.aw-stats{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;align-items:center}',
      '.aw-pill{padding:5px 9px;border-radius:999px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary)}',
      '.aw-pill b{color:var(--dsw-alias-label-primary)}',
      '.aw-pill.live{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}',
      '.aw-boards{display:flex;gap:2px;padding:0 12px;border-bottom:1px solid var(--dsw-alias-border-l1);background:transparent}',
      '.aw-board{appearance:none;border:0;background:transparent;color:var(--dsw-alias-label-secondary);padding:10px 14px;cursor:pointer;font:inherit;border-bottom:2px solid transparent;display:inline-flex;align-items:center;gap:6px}',
      '.aw-board.on{color:var(--dsw-alias-label-primary);border-bottom-color:var(--dsw-alias-brand-primary);font-weight:650}',
      '.aw-count{margin-left:6px;font-size:11px;opacity:.75}',
      '.aw-phases{display:flex;gap:6px;padding:8px 12px;overflow:auto;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.aw-phase{appearance:none;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:8px;padding:7px 10px;cursor:pointer;min-width:104px;display:flex;flex-direction:column;align-items:flex-start;gap:2px}',
      '.aw-phase.view{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}',
      '.aw-phase.live{box-shadow:inset 0 -2px 0 var(--dsw-alias-brand-primary)}',
      '.aw-phase.done .aw-st{color:var(--dsw-alias-state-success-primary)}',
      '.aw-phase.active .aw-st{color:var(--dsw-alias-state-warn-primary)}',
      '.aw-st{font-size:10px;letter-spacing:.04em;text-transform:uppercase}',
      '.aw-body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(240px,300px) minmax(0,1fr);gap:10px;padding:10px 12px;overflow:auto}',
      '.aw-body.wide{grid-template-columns:1fr}',
      '.aw-col{min-height:0;display:flex;flex-direction:column;gap:12px}',
      '.aw-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px}',
      '.aw-card h3{margin:0;font-size:12px;font-weight:650;letter-spacing:.04em;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;gap:6px}',
      '.aw-empty{color:var(--dsw-alias-label-secondary)}',
      '.aw-row{padding:8px;border-radius:8px;background:var(--dsw-alias-bg-layer-2)}',
      '.aw-row .k{font-weight:600}',
      '.aw-row .v{color:var(--dsw-alias-label-secondary);word-break:break-all}',
      '.aw-form{display:flex;flex-direction:column;gap:6px}',
      '.aw-form input,.aw-form select,.aw-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);border-radius:8px;padding:7px 8px;font:inherit}',
      '.aw-form textarea{min-height:56px;resize:vertical}',
      '.aw-btn{appearance:none;border:0;border-radius:8px;padding:7px 10px;cursor:pointer;background:var(--dsw-alias-brand-primary);color:#fff;font:inherit;font-weight:600}',
      '.aw-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.aw-btn.ghost{background:transparent;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l1)}',
      '.aw-btn.warn{background:transparent;color:var(--dsw-alias-state-error-primary);border:1px solid var(--dsw-alias-state-error-primary)}',
      '.aw-actions{display:flex;gap:6px;flex-wrap:wrap}',
      '.aw-table{width:100%;border-collapse:collapse}',
      '.aw-table th,.aw-table td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);vertical-align:top}',
      '.aw-grade{display:inline-flex;padding:1px 7px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);font-size:11px}',
      '.aw-grade.unauth{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}',
      '.aw-grade.session{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary)}',
      '.aw-idea{padding:8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1)}',
      '.aw-idea.verified{border-color:var(--dsw-alias-state-success-primary)}',
      '.aw-idea.failed{border-color:var(--dsw-alias-state-error-primary)}',
      '.aw-idea.testing{border-color:var(--dsw-alias-state-warn-primary)}',
      '.aw-idea.skipped{opacity:.6}',
      '.aw-matrix{overflow:auto}',
      '.aw-matrix table{border-collapse:collapse;min-width:100%}',
      '.aw-matrix th,.aw-matrix td{border:1px solid var(--dsw-alias-border-l1);padding:4px 6px;text-align:center;font-size:11px}',
      '.aw-cell{width:22px;height:22px;border-radius:4px;border:1px solid var(--dsw-alias-border-l1);background:transparent}',
      '.aw-cell.clean{background:var(--dsw-alias-state-success-primary)}',
      '.aw-cell.hit{background:var(--dsw-alias-state-error-primary)}',
      '.aw-err{color:var(--dsw-alias-state-error-primary)}',
      '.aw-redlines{white-space:pre-wrap;color:var(--dsw-alias-label-secondary)}',
      '.aw-log{max-height:260px;overflow:auto;display:flex;flex-direction:column;gap:6px}',
      '.aw-hint{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.aw-flags{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;width:100%}',
      '.aw-check{display:inline-flex;align-items:center;gap:6px;padding:0;border:0;color:var(--dsw-alias-label-secondary);font-size:12px;cursor:pointer;min-width:max-content}',
      '.aw-check span{white-space:nowrap}',
      '.aw-check input{margin:0}',
      '.aw-flags > input{min-width:120px}',
      '.aw-pair{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
      '.aw-report{white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;max-height:240px;overflow:auto;padding:8px;border-radius:8px;background:var(--dsw-alias-bg-layer-2)}',
      '.aw-layer{position:relative;flex:none;display:flex;align-items:center;width:100%;height:42px;margin:8px 0 0}',
      '.aw-layer.rail{width:36px;height:36px;margin:0}',
      '.aw-trigger{display:inline-flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:0 -2px;padding:0 10px 0 8px;border:none;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary);font-family:inherit;font-size:14px;cursor:pointer;overflow:hidden}',
      '.aw-trigger:hover,.aw-trigger[data-open],.aw-trigger[data-live]{background:var(--dsw-alias-interactive-bg-hover)}',
      '.aw-trigger-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.aw-trigger-meta{flex:none;margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px;font-variant-numeric:tabular-nums}',
      '.aw-layer.rail .aw-trigger{justify-content:center;gap:0;width:36px;height:36px;padding:0;border-radius:50%}',
      '.aw-flyout{position:fixed;z-index:30;display:flex;flex-direction:column;max-width:calc(100vw - 24px);height:min(82vh,860px);overflow:hidden;border:1px solid var(--dsw-alias-border-inverted);border-radius:12px;background:var(--dsw-specific-menu);box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);pointer-events:auto}',
      '.aw-flyout .aw-page{flex:1;min-height:0;height:100%}',
      '.aw-flyout .aw-log{max-height:180px}',
      '.aw-set{padding:8px 0 24px;display:flex;flex-direction:column;gap:18px;max-width:560px}',
      '.aw-set h2{margin:0;font-size:18px;font-weight:650}',
      '.aw-set-lead{margin:0;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.5}',
      '.aw-set-row{display:flex;flex-direction:column;gap:8px}',
      '.aw-set-row label{font-size:14px;font-weight:500}',
      '.aw-set-row .hint{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:1.45}',
      '.aw-set-row select,.aw-set-row input[type=number],.aw-set-row input[type=text]{min-height:36px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit}',
      '.aw-set-path{display:flex;gap:8px;align-items:center}',
      '.aw-set-path input{flex:1;min-width:0}',
      '.aw-kit{display:flex;flex-direction:column;gap:4px;max-height:180px;overflow:auto;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2);font-size:12px}',
      '.aw-browse{display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2);max-height:220px;overflow:auto}',
      '.aw-browse-path{font-size:12px;color:var(--dsw-alias-label-secondary);word-break:break-all}',
      '.aw-browse-row{appearance:none;border:0;background:transparent;color:inherit;text-align:left;padding:6px 4px;cursor:pointer;font:inherit;border-radius:6px}',
      '.aw-browse-row:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '@keyframes aw-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
      '.aw-flower{display:inline-flex;transform-origin:50% 50%}',
      '.aw-flower.spin{animation:aw-spin 4.8s linear infinite}',
      '.aw-flower.spin-fast{animation:aw-spin 1.2s linear infinite}',
      '.aw-set-meta{font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.aw-now{padding:12px;border-radius:12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);display:flex;flex-direction:column;gap:8px}',
      '.aw-now .lbl{font-size:11px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}',
      '.aw-now .big{font-size:16px;font-weight:650}',
      '.aw-track{display:flex;flex-direction:column;gap:4px;margin-top:4px;padding-left:4px;border-left:2px solid var(--dsw-alias-border-l1)}',
      '.aw-sg{display:grid;grid-template-columns:18px 1fr auto;gap:8px;align-items:start;padding:6px 8px;border-radius:8px;background:transparent}',
      '.aw-sg.active{background:var(--dsw-alias-bg-layer-1);outline:1px solid var(--dsw-alias-brand-primary)}',
      '.aw-sg.done .k,.aw-sg.done .code{text-decoration:line-through;opacity:.7}',
      '.aw-sg .code{font-variant-numeric:tabular-nums;font-weight:650;margin-right:6px}',
      '.aw-dot{width:10px;height:10px;margin-top:4px;border-radius:50%;background:var(--dsw-alias-border-l1)}',
      '.aw-sg.active .aw-dot{background:var(--dsw-alias-brand-primary)}',
      '.aw-sg.done .aw-dot{background:var(--dsw-alias-state-success-primary)}',
      '.aw-bar{height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden}',
      '.aw-bar > span{display:block;height:100%;background:var(--dsw-alias-brand-primary)}',
      '.aw-finding{display:flex;flex-direction:column;gap:8px}',
      '.aw-finding.on{outline:1px solid var(--dsw-alias-brand-primary)}',
      '.aw-viewer{position:fixed;inset:0;z-index:2147483000;background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}',
      '.aw-viewer-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:var(--dsw-alias-bg-layer-1);border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.aw-viewer-bar .ttl{font-size:16px;font-weight:650;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.aw-viewer-bar .meta{color:var(--dsw-alias-label-secondary);font-size:12px}',
      '.aw-viewer-body{flex:1;min-height:0;overflow:auto;padding:28px 8%;background:var(--dsw-alias-bg-base)}',
      '.aw-md{max-width:860px;margin:0 auto;color:var(--dsw-alias-label-primary);font-size:15px;line-height:1.7}',
      '.aw-md h1,.aw-md h2,.aw-md h3,.aw-md h4{margin:1.4em 0 .5em;line-height:1.3}',
      '.aw-md h1{font-size:26px}',
      '.aw-md h2{font-size:20px;border-bottom:1px solid var(--dsw-alias-border-l1);padding-bottom:6px}',
      '.aw-md h3{font-size:16px}',
      '.aw-md p{margin:.7em 0}',
      '.aw-md blockquote{margin:.8em 0;padding:8px 14px;border-left:3px solid var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}',
      '.aw-md ul,.aw-md ol{margin:.6em 0 .6em 1.3em}',
      '.aw-md li{margin:.25em 0}',
      '.aw-md hr{border:0;border-top:1px solid var(--dsw-alias-border-l1);margin:1.4em 0}',
      '.aw-md a{color:var(--dsw-alias-brand-primary)}',
      '.aw-md code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;background:var(--dsw-alias-bg-layer-2);border-radius:4px;padding:1px 5px}',
      '.aw-md-pre{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:12px 14px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.5}',
      '.aw-md-pre code{background:transparent;padding:0}',
      '.aw-md-table{width:100%;border-collapse:collapse;margin:1em 0;font-size:14px}',
      '.aw-md-table th,.aw-md-table td{border:1px solid var(--dsw-alias-border-l1);padding:6px 10px;text-align:left;vertical-align:top}',
      '.aw-md-table th{background:var(--dsw-alias-bg-layer-1)}',
      '.aw-md *{max-width:100%}',
    ].join('')

    const tagId = 'dsh-lovelyaudit/audit.css.v12'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-lovelyaudit'
      tag.dataset.pluginCss = tagId
      tag.textContent = css
      document.head.appendChild(tag)
    }

    function icon(path, size) {
      const s = size || 16
      return jsx.jsx('svg', {
        width: s, height: s, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
        'aria-hidden': true, children: jsx.jsx('path', { d: path }),
      })
    }

    function flowerIcon(size, spinning) {
      const s = size || 16
      return jsx.jsx('span', {
        className: spinning ? 'aw-flower spin-fast' : 'aw-flower spin',
        'aria-hidden': true,
        children: jsx.jsxs('svg', {
          width: s, height: s, viewBox: '0 0 24 24', fill: 'none',
          children: [
            jsx.jsx('circle', { cx: '12', cy: '12', r: '2.1', fill: 'currentColor' }),
            jsx.jsx('ellipse', { cx: '12', cy: '5.4', rx: '2.4', ry: '3.6', fill: 'currentColor', opacity: '0.92' }),
            jsx.jsx('ellipse', { cx: '12', cy: '18.6', rx: '2.4', ry: '3.6', fill: 'currentColor', opacity: '0.92' }),
            jsx.jsx('ellipse', { cx: '5.4', cy: '12', rx: '3.6', ry: '2.4', fill: 'currentColor', opacity: '0.92' }),
            jsx.jsx('ellipse', { cx: '18.6', cy: '12', rx: '3.6', ry: '2.4', fill: 'currentColor', opacity: '0.92' }),
            jsx.jsx('ellipse', { cx: '7.2', cy: '7.2', rx: '2.2', ry: '3.2', fill: 'currentColor', opacity: '0.78', transform: 'rotate(-45 7.2 7.2)' }),
            jsx.jsx('ellipse', { cx: '16.8', cy: '7.2', rx: '2.2', ry: '3.2', fill: 'currentColor', opacity: '0.78', transform: 'rotate(45 16.8 7.2)' }),
            jsx.jsx('ellipse', { cx: '7.2', cy: '16.8', rx: '2.2', ry: '3.2', fill: 'currentColor', opacity: '0.78', transform: 'rotate(45 7.2 16.8)' }),
            jsx.jsx('ellipse', { cx: '16.8', cy: '16.8', rx: '2.2', ry: '3.2', fill: 'currentColor', opacity: '0.78', transform: 'rotate(-45 16.8 16.8)' }),
          ],
        }),
      })
    }

    const ICONS = {
      config: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
      target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
      idea: 'M9 18h6 M10 21h4 M12 3a6 6 0 0 1 4 10c0 2-1 3-2 4H10c-1-1-2-2-2-4a6 6 0 0 1 4-10z',
      scan: 'M4 8V5h3 M17 5h3v3 M20 16v3h-3 M7 19H4v-3 M8 12h8',
      bug: 'M8 9h8v7a4 4 0 0 1-8 0V9z M12 5v4 M5 12h3 M16 12h3 M9 4l-2-2 M15 4l2-2 M8 20l-2 2 M16 20l2 2',
      grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
      folder: 'M3 7h6l2 2h10v10H3z',
      proxy: 'M5 12h14 M12 5l7 7-7 7',
    }

    const GRADE_LABEL = {
      unauth: '未授权成立',
      session: '需会话',
      key: '密钥门',
      blocked: '本实例被挡',
      code: '代码缺陷',
    }

    function escapeHtml(text) {
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }

    function inlineMd(text) {
      let html = escapeHtml(text)
      html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>')
      html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      html = html.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      return html
    }

    function parseTableRow(line) {
      const raw = String(line || '').trim()
      if (!raw.startsWith('|')) return null
      return raw.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
    }

    function isTableSep(line) {
      const cells = parseTableRow(line)
      return Boolean(cells && cells.length && cells.every((cell) => /^:?-{3,}:?$/.test(cell)))
    }

    function isFence(line) {
      return /^\s*```/.test(String(line || ''))
    }

    function isListItem(line) {
      return /^\s*[-*]\s+/.test(String(line || ''))
    }

    function isOrderedItem(line) {
      return /^\s*\d+\.\s+/.test(String(line || ''))
    }

    function isQuote(line) {
      return /^\s*>/.test(String(line || ''))
    }

    function isHeading(line) {
      return /^(#{1,6})\s+/.test(String(line || ''))
    }

    function renderMarkdown(source) {
      const text = String(source || '').replace(/\r\n/g, '\n')
      if (text.length > 120000) {
        return [jsx.jsx('pre', { className: 'aw-md-pre', children: text.slice(0, 120000) }, 'md-trim')]
      }
      const lines = text.split('\n')
      const nodes = []
      let i = 0
      let key = 0
      const nextKey = () => {
        key += 1
        return 'md-' + key
      }
      const pushHtml = (tag, html) => {
        nodes.push(jsx.jsx(tag, { dangerouslySetInnerHTML: { __html: html } }, nextKey()))
      }
      while (i < lines.length) {
        const start = i
        const line = lines[i]
        if (isFence(line)) {
          const body = []
          i += 1
          while (i < lines.length && !isFence(lines[i])) {
            body.push(lines[i])
            i += 1
          }
          if (i < lines.length) i += 1
          nodes.push(jsx.jsx('pre', { className: 'aw-md-pre', children: jsx.jsx('code', { children: body.join('\n') }) }, nextKey()))
        } else if (/^\s*\|/.test(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
          const headers = parseTableRow(line) || []
          i += 2
          const rows = []
          while (i < lines.length && /^\s*\|/.test(lines[i]) && !isTableSep(lines[i])) {
            rows.push(parseTableRow(lines[i]) || [])
            i += 1
          }
          nodes.push(jsx.jsxs('table', { className: 'aw-md-table', children: [
            jsx.jsx('thead', { children: jsx.jsx('tr', { children: headers.map((cell, idx) => jsx.jsx('th', { dangerouslySetInnerHTML: { __html: inlineMd(cell) } }, idx)) }) }),
            jsx.jsx('tbody', { children: rows.map((row, ridx) => jsx.jsx('tr', { children: headers.map((_, cidx) => jsx.jsx('td', { dangerouslySetInnerHTML: { __html: inlineMd(row[cidx] || '') } }, cidx)) }, ridx)) }),
          ] }, nextKey()))
        } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
          nodes.push(jsx.jsx('hr', {}, nextKey()))
          i += 1
        } else if (isHeading(line)) {
          const heading = line.match(/^(#{1,6})\s+(.*)$/)
          const level = Math.min(4, heading[1].length)
          const Tag = 'h' + level
          nodes.push(jsx.jsx(Tag, { dangerouslySetInnerHTML: { __html: inlineMd(heading[2]) } }, nextKey()))
          i += 1
        } else if (isQuote(line)) {
          const quote = []
          while (i < lines.length && isQuote(lines[i])) {
            quote.push(lines[i].replace(/^\s*>\s?/, ''))
            i += 1
          }
          pushHtml('blockquote', inlineMd(quote.join(' ')))
        } else if (isListItem(line)) {
          const items = []
          while (i < lines.length && isListItem(lines[i])) {
            items.push(lines[i].replace(/^\s*[-*]\s+/, ''))
            i += 1
          }
          nodes.push(jsx.jsx('ul', { children: items.map((item, idx) => jsx.jsx('li', { dangerouslySetInnerHTML: { __html: inlineMd(item) } }, idx)) }, nextKey()))
        } else if (isOrderedItem(line)) {
          const items = []
          while (i < lines.length && isOrderedItem(lines[i])) {
            items.push(lines[i].replace(/^\s*\d+\.\s+/, ''))
            i += 1
          }
          nodes.push(jsx.jsx('ol', { children: items.map((item, idx) => jsx.jsx('li', { dangerouslySetInnerHTML: { __html: inlineMd(item) } }, idx)) }, nextKey()))
        } else if (line.trim() === '') {
          i += 1
        } else {
          const para = []
          while (i < lines.length) {
            const cur = lines[i]
            if (cur.trim() === '' || isFence(cur) || isHeading(cur) || isQuote(cur) || isListItem(cur) || isOrderedItem(cur)) break
            if (/^\s*\|/.test(cur) && i + 1 < lines.length && isTableSep(lines[i + 1])) break
            if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(cur)) break
            para.push(cur)
            i += 1
          }
          if (para.length) pushHtml('p', inlineMd(para.join(' ')))
        }
        if (i <= start) i = start + 1
      }
      return nodes
    }

    function ReportViewer(props) {
      const finding = props.finding
      const markdown = props.markdown || ''
      const onClose = props.onClose
      const nodes = React.useMemo(() => {
        try {
          return renderMarkdown(markdown)
        } catch {
          return [jsx.jsx('pre', { className: 'aw-md-pre', children: markdown }, 'md-fallback')]
        }
      }, [markdown])
      React.useEffect(() => {
        const onKey = (event) => {
          if (event.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => { window.removeEventListener('keydown', onKey) }
      }, [onClose])
      const title = ((finding && finding.code) ? finding.code + '　' : '') + ((finding && finding.title) || '漏洞报告')
      return jsx.jsxs('div', {
        className: 'aw-viewer',
        role: 'dialog',
        'aria-modal': 'true',
        children: [
          jsx.jsxs('div', { className: 'aw-viewer-bar', children: [
            jsx.jsxs('div', { style: { minWidth: 0 }, children: [
              jsx.jsx('div', { className: 'ttl', children: title }),
              finding && finding.reportPath ? jsx.jsx('div', { className: 'meta', children: finding.reportPath }) : null,
            ] }),
            jsx.jsxs('div', { className: 'aw-actions', children: [
              jsx.jsx('button', {
                className: 'aw-btn ghost',
                onClick: () => {
                  if (markdown && navigator.clipboard) void navigator.clipboard.writeText(markdown)
                },
                children: '复制 Markdown',
              }),
              jsx.jsx('button', { className: 'aw-btn', onClick: onClose, children: '关闭' }),
            ] }),
          ] }),
          jsx.jsx('div', { className: 'aw-viewer-body', children: jsx.jsx('article', { className: 'aw-md', children: nodes }) }),
        ],
      })
    }

    function Field(props) {
      return jsx.jsx('input', {
        id: props.id,
        name: props.name || props.id,
        placeholder: props.placeholder,
        value: props.value,
        type: props.type || 'text',
        autoComplete: props.autoComplete || 'off',
        autoCorrect: 'off',
        autoCapitalize: 'off',
        spellCheck: false,
        'data-lpignore': 'true',
        'data-1p-ignore': 'true',
        'data-bwignore': 'true',
        'data-form-type': 'other',
        style: props.style,
        onChange: (e) => props.onChange(e.target.value),
      })
    }

    function Area(props) {
      return jsx.jsx('textarea', {
        placeholder: props.placeholder,
        value: props.value,
        onChange: (e) => props.onChange(e.target.value),
      })
    }

    async function apiGet(sessionId) {
      const res = await fetch('/local-audit-workspace?session=' + encodeURIComponent(sessionId), { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || ('HTTP ' + String(res.status)))
      return json
    }

    async function apiPost(sessionId, body) {
      const res = await fetch('/local-audit-workspace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({ session: sessionId }, body)),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || ('HTTP ' + String(res.status)))
      return json
    }

    function readyToStart(form) {
      return Boolean((form.url && form.url.trim()) || (form.objective && form.objective.trim()))
    }

    function emptyForm() {
      return {
        title: '',
        objective: '',
        notes: '',
        redlines: '',
        url: '',
        port: '',
        role: '主站',
        production: false,
        ctfMode: false,
        username: '',
        password: '',
        headers: '',
        cookies: '',
        useGoal: false,
        maxGoalRounds: '0',
      }
    }

    function formFrom(data) {
      return {
        title: data.title || '',
        objective: data.objective || '',
        notes: data.notes || '',
        redlines: data.redlines || '',
        url: data.url || '',
        port: data.port || '',
        role: data.role || '主站',
        production: data.production === true,
        ctfMode: data.ctfMode === true,
        username: data.username || '',
        password: data.password || '',
        headers: data.headers || '',
        cookies: data.cookies || '',
        useGoal: data.useGoal === true,
        maxGoalRounds: String(data.maxGoalRounds == null ? 0 : data.maxGoalRounds),
      }
    }

    function payloadFrom(form) {
      const rounds = Number(form.maxGoalRounds)
      return {
        title: form.title.trim() || '未命名审计',
        objective: form.objective.trim(),
        notes: form.notes.trim(),
        redlines: form.redlines.trim(),
        url: form.url.trim(),
        port: form.port.trim(),
        role: form.role.trim() || '主站',
        production: form.production === true,
        ctfMode: form.ctfMode === true,
        username: form.username.trim(),
        password: form.password,
        headers: form.headers.trim(),
        cookies: form.cookies.trim(),
        useGoal: form.useGoal === true,
        maxGoalRounds: Number.isSafeInteger(rounds) && rounds > 0 ? rounds : 0,
      }
    }

    function outlineParts(code) {
      const hit = String(code || '').trim().match(/^P(\d+(?:\.\d+)*)/i)
      if (!hit) return []
      return hit[1].split('.').map((part) => Number(part))
    }

    function parentCodeOf(code) {
      const hit = String(code || '').trim().match(/^(P\d+(?:\.\d+)*)/i)
      if (!hit) return ''
      const parts = hit[1].split('.')
      if (parts.length <= 1) return ''
      return parts.slice(0, -1).join('.')
    }

    function compareOutline(a, b) {
      const left = outlineParts(a)
      const right = outlineParts(b)
      const n = Math.max(left.length, right.length)
      for (let i = 0; i < n; i += 1) {
        const x = Number.isFinite(left[i]) ? left[i] : -1
        const y = Number.isFinite(right[i]) ? right[i] : -1
        if (x !== y) return x - y
      }
      return String(a || '').localeCompare(String(b || ''), 'zh')
    }

    function walkSubgoals(items) {
      const list = Array.isArray(items) ? items.slice() : []
      const byCode = new Map()
      for (const item of list) {
        if (item.code) byCode.set(item.code, item)
      }
      const byParent = new Map()
      const roots = []
      for (const item of list) {
        const parentFromId = item.parentId ? list.find((row) => row.id === item.parentId) : null
        const parentFromCode = byCode.get(parentCodeOf(item.code))
        const parent = parentFromId || parentFromCode || null
        const key = parent ? parent.id : ''
        if (!byParent.has(key)) byParent.set(key, [])
        byParent.get(key).push(item)
        if (!parent) roots.push(item)
      }
      for (const kids of byParent.values()) kids.sort((a, b) => compareOutline(a.code, b.code) || String(a.title).localeCompare(String(b.title), 'zh'))
      roots.sort((a, b) => compareOutline(a.code, b.code) || String(a.title).localeCompare(String(b.title), 'zh'))
      const ordered = []
      const seen = new Set()
      const walkItem = (item, depth) => {
        if (seen.has(item.id)) return
        seen.add(item.id)
        ordered.push({ item, depth })
        const kids = byParent.get(item.id) || []
        for (const kid of kids) walkItem(kid, depth + 1)
      }
      for (const root of roots) walkItem(root, 0)
      for (const item of list) {
        if (!seen.has(item.id)) walkItem(item, Math.min(item.indent || 0, 6))
      }
      return ordered
    }

    function AuditView(props) {
      const sessionId = props.sessionId
      const openSession = props.openSession
      const compact = props.compact === true
      const [data, setData] = React.useState(null)
      const [error, setError] = React.useState('')
      const [form, setForm] = React.useState(emptyForm())
      const [idea, setIdea] = React.useState('')
      const [openFinding, setOpenFinding] = React.useState('')
      const [viewFinding, setViewFinding] = React.useState('')
      const [viewSnap, setViewSnap] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const synced = React.useRef(0)
      const viewingRef = React.useRef(false)
      const onLiveChange = props.onLiveChange
      const closeViewer = React.useCallback(() => {
        viewingRef.current = false
        setViewFinding('')
        setViewSnap(null)
      }, [])
      const openViewer = React.useCallback((finding) => {
        if (!finding || !finding.reportMarkdown) return
        viewingRef.current = true
        setViewFinding(finding.id)
        setViewSnap({
          id: finding.id,
          code: finding.code,
          title: finding.title,
          reportPath: finding.reportPath,
          reportMarkdown: finding.reportMarkdown,
        })
      }, [])

      const refresh = React.useCallback(async () => {
        if (!sessionId || viewingRef.current) return
        try {
          const next = await apiGet(sessionId)
          if (viewingRef.current) return
          setData(next)
          setError('')
          if (next.updatedAt !== synced.current) {
            synced.current = next.updatedAt
            setForm(formFrom(next))
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }, [sessionId])

      React.useEffect(() => {
        void refresh()
        if (!sessionId) return undefined
        const timer = setInterval(() => { void refresh() }, 2000)
        return () => { clearInterval(timer) }
      }, [refresh, sessionId])

      const live = Boolean(data && data.run && data.run.status === 'running')
      React.useEffect(() => {
        if (typeof onLiveChange === 'function') onLiveChange(live)
      }, [live, onLiveChange])

      async function run(body) {
        if (!sessionId) return
        try {
          setBusy(true)
          const next = await apiPost(sessionId, body)
          if (body.action === 'start_run' && next.sessionId && next.sessionId !== sessionId) {
            if (typeof openSession === 'function') openSession(next.sessionId)
            setError('')
            return
          }
          synced.current = next.updatedAt
          setData(next)
          setForm(formFrom(next))
          setError('')
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }

      function patch(key, value) {
        setForm((prev) => Object.assign({}, prev, { [key]: value }))
      }

      if (!sessionId) {
        return jsx.jsx('div', { className: 'aw-page', children: jsx.jsx('div', { className: 'aw-empty', style: { padding: 20 }, children: '打开一个会话后使用黑盒/代审工作区。' }) })
      }
      if (!data) {
        return jsx.jsx('div', { className: 'aw-page', children: jsx.jsx('div', { className: 'aw-empty', style: { padding: 20 }, children: error || '正在加载工作区…' }) })
      }

      const types = data.meta.coverTypes
      const entries = []
      const seen = {}
      for (const c of data.coverage) {
        if (!seen[c.entry]) { seen[c.entry] = true; entries.push(c.entry) }
      }
      for (const s of data.surfaces) {
        if (!seen[s.path]) { seen[s.path] = true; entries.push(s.path) }
      }
      const board = data.board || 'config'
      const progress = data.progress || {}
      const campaign = data.campaign || { goal: '', current: '', subgoals: [] }
      const canStart = readyToStart(form)
      const cfg = payloadFrom(form)
      const selectedFinding = data.findings.find((item) => item.id === openFinding) || null

      function jobLabel(job) {
        const row = job || { status: 'idle' }
        return {
          idle: '等待三点闭合后自动撰写本条报告',
          queued: '已排队撰写本条专项报告',
          writing: '撰写子代理正在写本条报告',
          ready: '本条专项报告已产出',
          failed: '撰写失败：' + (row.error || '未知错误'),
        }[row.status] || row.status
      }

      function coverStatus(entry, type) {
        const hit = data.coverage.find((c) => c.entry === entry && c.type === type)
        return hit ? hit.status : 'unseen'
      }

      const p0Form = jsx.jsxs('div', { className: 'aw-card', children: [
        jsx.jsxs('h3', { children: [icon(ICONS.config, 14), ' P0 交战配置（只需填这些）'] }),
        jsx.jsx('div', { className: 'aw-hint', children: form.ctfMode
          ? 'CTF 模式：Agent 以拿到 flag 为完成条件，漏洞只是路径。你只要给题目 URL。'
          : '指纹、可达面、缺陷、覆盖矩阵由 Agent 自动探测并回写。你只要给目标、注意点、可选账号和 Header。' }),
        jsx.jsxs('div', { className: 'aw-form', children: [
          jsx.jsx(Field, { placeholder: '审计标题', value: form.title, onChange: (v) => patch('title', v) }),
          jsx.jsx(Field, { placeholder: '目标 URL，例如 https://app.example.com', value: form.url, onChange: (v) => patch('url', v) }),
          jsx.jsxs('div', { className: 'aw-pair', children: [
            jsx.jsx(Field, { placeholder: '端口（可空）', value: form.port, onChange: (v) => patch('port', v) }),
            jsx.jsx(Field, { placeholder: '角色：主站 / 移动 / 测试', value: form.role, onChange: (v) => patch('role', v) }),
          ] }),
          jsx.jsx(Area, { placeholder: '想证明什么 / 审计范围', value: form.objective, onChange: (v) => patch('objective', v) }),
          jsx.jsx(Area, { placeholder: '注意事项：禁止打的接口、已知 WAF、业务高峰…', value: form.notes, onChange: (v) => patch('notes', v) }),
          jsx.jsx(Area, { placeholder: '红线（可选）。留空则不套默认只读限制，由你决定允许什么。', value: form.redlines, onChange: (v) => patch('redlines', v) }),
          jsx.jsxs('div', { className: 'aw-pair', style: { position: 'relative' }, children: [
            jsx.jsx('input', { type: 'text', tabIndex: -1, 'aria-hidden': true, autoComplete: 'username', readOnly: true, value: '', style: { position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' } }),
            jsx.jsx('input', { type: 'password', tabIndex: -1, 'aria-hidden': true, autoComplete: 'current-password', readOnly: true, value: '', style: { position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' } }),
            jsx.jsx(Field, {
              id: 'aw-p0-principal',
              name: 'aw-p0-principal',
              placeholder: '账号（可选）',
              value: form.username,
              autoComplete: 'off',
              onChange: (v) => patch('username', v),
            }),
            jsx.jsx(Field, {
              id: 'aw-p0-secret',
              name: 'aw-p0-secret',
              placeholder: '口令（可选，仅用于授权目标）',
              value: form.password,
              type: 'text',
              autoComplete: 'off',
              style: { WebkitTextSecurity: 'disc' },
              onChange: (v) => patch('password', v),
            }),
          ] }),
          jsx.jsx(Area, { placeholder: '额外 Header，每行 Key: Value', value: form.headers, onChange: (v) => patch('headers', v) }),
          jsx.jsx(Area, { placeholder: 'Cookie（可选）', value: form.cookies, onChange: (v) => patch('cookies', v) }),
          jsx.jsxs('div', { className: 'aw-flags', children: [
            jsx.jsxs('label', { className: 'aw-check', children: [
              jsx.jsx('input', { type: 'checkbox', checked: form.production, onChange: (e) => patch('production', e.target.checked) }),
              jsx.jsx('span', { children: '生产环境' }),
            ] }),
            jsx.jsxs('label', { className: 'aw-check', children: [
              jsx.jsx('input', { type: 'checkbox', checked: form.ctfMode, onChange: (e) => patch('ctfMode', e.target.checked) }),
              jsx.jsx('span', { children: 'CTF 模式' }),
            ] }),
            jsx.jsxs('label', { className: 'aw-check', children: [
              jsx.jsx('input', { type: 'checkbox', checked: form.useGoal, onChange: (e) => patch('useGoal', e.target.checked) }),
              jsx.jsx('span', { children: 'Goal 长跑' }),
            ] }),
            form.useGoal
              ? jsx.jsx('input', {
                style: { width: 108 },
                placeholder: '0 = 不限',
                value: form.maxGoalRounds,
                onChange: (e) => patch('maxGoalRounds', e.target.value),
                title: 'Goal 轮数，0 或不填表示不限',
              })
              : null,
          ] }),
          jsx.jsxs('div', { className: 'aw-actions', children: [
            jsx.jsx('button', {
              className: 'aw-btn ghost',
              disabled: busy,
              onClick: () => { void run(Object.assign({ action: 'setup' }, cfg)) },
              children: '保存配置',
            }),
            live
              ? jsx.jsx('button', { className: 'aw-btn warn', disabled: busy, onClick: () => { void run({ action: 'stop_run' }) }, children: '停止' })
              : jsx.jsx('button', {
                className: 'aw-btn',
                disabled: busy || !canStart,
                title: canStart ? '保存并启动 Agent 自动做 P1–P7' : '先填目标 URL 或审计目标',
                onClick: () => { void run(Object.assign({ action: 'start_run' }, cfg)) },
                children: form.useGoal ? '开始 Goal 长跑' : '开始自动审计',
              }),
          ] }),
        ] }),
        form.redlines
          ? jsx.jsx('div', { className: 'aw-redlines', children: form.redlines })
          : jsx.jsx('div', { className: 'aw-hint', children: '未填红线：Agent 不会套默认只读禁令。需要限制时在上面写清楚。' }),
      ] })

      const tree = walkSubgoals(campaign.subgoals)
      const campaignCard = jsx.jsxs('div', { className: 'aw-card', children: [
        jsx.jsxs('h3', { children: [icon(ICONS.target, 14), ' 正在进行'] }),
        jsx.jsxs('div', { className: 'aw-now', children: [
          jsx.jsx('div', { className: 'lbl', children: '主目标' }),
          jsx.jsx('div', { className: 'big', children: progress.goal || data.objective || data.title || '尚未设定审计目标' }),
          jsx.jsx('div', { className: 'aw-bar', children: jsx.jsx('span', { style: { width: (progress.total ? Math.round(100 * (progress.done || 0) / progress.total) : 0) + '%' } }) }),
          jsx.jsx('div', { className: 'v', children: (progress.phase || data.phase) + ' ' + (progress.phaseName || '') + ' · 子目标 ' + String(progress.done || 0) + '/' + String(progress.total || 0) + (progress.idea ? ' · 点子 ' + progress.idea.content : '') }),
          progress.current ? jsx.jsx('div', { className: 'v', children: '当前：' + progress.current }) : null,
          progress.detail ? jsx.jsx('div', { className: 'v', children: progress.detail }) : null,
          jsx.jsx('div', { className: 'lbl', children: '子目标' }),
          tree.length === 0
            ? jsx.jsx('div', { className: 'aw-empty', children: '还没有子目标。启动审计后会按 P1–P7 挂在主目标下面。' })
            : jsx.jsx('div', { className: 'aw-track', children: tree.map(({ item, depth }) => jsx.jsxs('div', {
              className: 'aw-sg ' + item.status,
              style: { marginLeft: Math.min(depth, 6) * 14 },
              children: [
                jsx.jsx('div', { className: 'aw-dot' }),
                jsx.jsxs('div', { children: [
                  jsx.jsxs('div', { className: 'k', children: [
                    item.code ? jsx.jsx('span', { className: 'code', children: item.code }) : null,
                    item.title && item.code && String(item.title).startsWith(item.code) ? String(item.title).slice(item.code.length).trim() : item.title,
                  ] }),
                  item.detail ? jsx.jsx('div', { className: 'v', children: item.detail }) : null,
                ] }),
                jsx.jsx('button', {
                  className: 'aw-btn ghost',
                  disabled: busy,
                  onClick: () => { void run({ action: 'update_subgoal', id: item.id, status: item.status === 'done' ? 'pending' : 'done' }) },
                  children: item.status === 'done' ? '已销' : item.status === 'active' ? '销号' : '未开始',
                }),
              ],
            }, item.id)) }),
        ] }),
      ] })

      const fingerprintCard = jsx.jsxs('div', { className: 'aw-card', children: [
        jsx.jsxs('h3', { children: [icon(ICONS.scan, 14), ' 产品指纹'] }),
        data.fingerprints.length === 0
          ? jsx.jsx('div', { className: 'aw-empty', children: 'P1 由 Agent 识别产品/版本并拉取 CVE，不用你填。' })
          : data.fingerprints.map((f) => jsx.jsxs('div', { className: 'aw-row', children: [
            jsx.jsx('div', { className: 'k', children: f.product + (f.version ? ' ' + f.version : '') }),
            jsx.jsx('div', { className: 'v', children: [f.evidence, f.cves].filter(Boolean).join(' · ') }),
          ] }, f.id)),
      ] })

      const surfaceCard = jsx.jsxs('div', { className: 'aw-card', children: [
        jsx.jsxs('h3', { children: [icon(ICONS.scan, 14), ' 可达面 / 边界'] }),
        data.surfaces.length === 0
          ? jsx.jsx('div', { className: 'aw-empty', children: 'P2/P3 由 Agent 自己打未授权请求并记录结论。' })
          : jsx.jsxs('table', { className: 'aw-table', children: [
            jsx.jsx('thead', { children: jsx.jsxs('tr', { children: [
              jsx.jsx('th', { children: '路径' }), jsx.jsx('th', { children: '类' }), jsx.jsx('th', { children: '码' }), jsx.jsx('th', { children: '结论' }),
            ] }) }),
            jsx.jsx('tbody', { children: data.surfaces.map((s) => jsx.jsxs('tr', { children: [
              jsx.jsx('td', { children: s.path }), jsx.jsx('td', { children: s.kind }),
              jsx.jsx('td', { children: s.unauthCode || '—' }), jsx.jsx('td', { children: s.conclusion || '—' }),
            ] }, s.id)) }),
          ] }),
      ] })

      const findingCard = jsx.jsxs('div', { className: 'aw-card', children: [
        jsx.jsxs('h3', { children: [icon(ICONS.bug, 14), ' 缺陷（一条一份专项报告）'] }),
        jsx.jsx('div', { className: 'aw-hint', children: '三点闭合上报后立刻为该条派撰写子代理，按护理到家 SRC 报告逻辑单独成篇，不与其它漏洞混写。' }),
        data.findings.length === 0
          ? jsx.jsx('div', { className: 'aw-empty', children: 'P4–P6 由 Agent 代审、互证、验证后登记。每条会问：可达吗？要什么前置？回显成立吗？' })
          : data.findings.map((f) => {
            const open = selectedFinding && selectedFinding.id === f.id
            const job = f.reportJob || { status: 'idle' }
            const markdown = f.reportMarkdown || ''
            return jsx.jsxs('div', { className: 'aw-row aw-finding' + (open ? ' on' : ''), children: [
              jsx.jsx('button', {
                className: 'aw-btn ghost',
                style: { alignSelf: 'flex-start' },
                onClick: () => {
                  setOpenFinding(f.id)
                  if (markdown) openViewer(f)
                },
                children: (f.code ? f.code + '　' : '') + f.title,
              }),
              jsx.jsxs('div', { className: 'v', children: [
                jsx.jsx('span', { className: 'aw-grade ' + f.grade, children: GRADE_LABEL[f.grade] || f.grade }),
                ' · ', f.severity || 'Info',
                ' · ', f.verifyStatus === 'verified' ? '已验证' : (f.verifyStatus === 'blocked' ? '验证受阻' : '未验证'),
                f.location ? ' · ' + f.location : '',
              ] }),
              jsx.jsx('div', { className: job.status === 'failed' ? 'aw-err' : 'aw-hint', children: jobLabel(job) }),
              f.reportPath ? jsx.jsx('div', { className: 'aw-hint', children: '已写出 ' + f.reportPath }) : null,
              f.reportWriteError ? jsx.jsx('div', { className: 'aw-err', children: '写盘失败：' + f.reportWriteError }) : null,
              jsx.jsxs('div', { className: 'aw-actions', children: [
                jsx.jsx('button', {
                  className: 'aw-btn',
                  disabled: !markdown,
                  onClick: () => { openViewer(f) },
                  children: '查看报告',
                }),
                jsx.jsx('button', {
                  className: 'aw-btn ghost',
                  disabled: !markdown,
                  onClick: () => {
                    if (markdown && typeof navigator !== 'undefined' && navigator.clipboard) void navigator.clipboard.writeText(markdown)
                  },
                  children: '复制 Markdown',
                }),
                jsx.jsx('button', {
                  className: 'aw-btn ghost',
                  disabled: busy || job.status === 'writing' || job.status === 'queued',
                  onClick: () => { void run({ action: 'write_report', findingId: f.id }) },
                  children: '重新撰写本条',
                }),
              ] }),
              open && !markdown ? jsx.jsx('div', { className: 'aw-empty', children: '本条还没有专项报告。验证后会自动写。' }) : null,
            ] }, f.id)
          }),
      ] })

      const coverageCard = jsx.jsxs('div', { className: 'aw-card', children: [
        jsx.jsxs('h3', { children: [icon(ICONS.grid, 14), ' 覆盖矩阵'] }),
        entries.length === 0
          ? jsx.jsx('div', { className: 'aw-empty', children: 'P7 由 Agent 按入口×类型填格。空白 = 还没审完。' })
          : jsx.jsx('div', { className: 'aw-matrix', children: jsx.jsxs('table', { children: [
            jsx.jsx('thead', { children: jsx.jsxs('tr', { children: [
              jsx.jsx('th', { children: '入口' }),
              types.map((t) => jsx.jsx('th', { children: t }, t)),
            ] }) }),
            jsx.jsx('tbody', { children: entries.map((entry) => jsx.jsxs('tr', { children: [
              jsx.jsx('td', { children: entry }),
              types.map((t) => jsx.jsx('td', { children: jsx.jsx('div', {
                className: 'aw-cell ' + coverStatus(entry, t),
                title: entry + ' × ' + t + ' = ' + coverStatus(entry, t),
              }) }, t)),
            ] }, entry)) }),
          ] }) }),
      ] })

      const ideaCard = jsx.jsxs('div', { className: 'aw-card', children: [
        jsx.jsxs('h3', { children: [icon(ICONS.idea, 14), ' 点子板'] }),
        jsx.jsx('div', { className: 'aw-hint', children: '历史点子全在这里。Agent 每轮自动生成/判定；你可以否决（skipped）或补一条。' }),
        jsx.jsxs('div', { className: 'aw-form', children: [
          jsx.jsx(Field, { placeholder: '可选：补一条可验证假设', value: idea, onChange: setIdea }),
          jsx.jsx('button', {
            className: 'aw-btn ghost',
            onClick: () => {
              if (!idea.trim()) return
              void run({ action: 'add_idea', content: idea.trim(), phase: data.phase, origin: 'user' }).then(() => setIdea(''))
            },
            children: '添加点子',
          }),
        ] }),
        data.ideas.length === 0
          ? jsx.jsx('div', { className: 'aw-empty', children: '本会话还没有点子。点子只跟当前会话走，不会从其它会话带过来。' })
          : data.ideas.slice().reverse().map((item) => jsx.jsxs('div', { className: 'aw-idea ' + item.status, children: [
            jsx.jsx('div', { className: 'k', children: item.content }),
            jsx.jsx('div', { className: 'v', children: item.status + (item.phase ? ' · ' + item.phase : '') + (item.result ? ' — ' + item.result : '') }),
            jsx.jsx('div', { className: 'aw-actions', children: ['pending', 'testing', 'verified', 'failed', 'skipped'].map((st) => jsx.jsx('button', {
              className: 'aw-btn ghost',
              disabled: item.status === st,
              onClick: () => { void run({ action: 'update_idea', id: item.id, status: st, origin: 'user' }) },
              children: st,
            }, st)) }),
          ] }, item.id)),
      ] })

      const page = jsx.jsxs('div', { className: 'aw-page', children: [
        jsx.jsxs('div', { className: 'aw-top', children: [
          jsx.jsxs('div', { className: 'aw-brand', children: [
            jsx.jsx('div', { className: 'aw-mark', children: flowerIcon(18, live) }),
            jsx.jsxs('div', { children: [
              jsx.jsx('div', { className: 'aw-title', children: data.title || '黑盒 / 代审' }),
              jsx.jsx('div', { className: 'aw-sub', children: (progress.current || data.objective || data.url) || (compact ? '侧栏展开工作区。配置目标后开始。' : '配置页只填交战信息；进度看「目标」页。') }),
            ] }),
          ] }),
          jsx.jsxs('div', { className: 'aw-stats', children: [
            jsx.jsxs('div', { className: 'aw-pill live', children: ['当前 ', jsx.jsx('b', { children: data.phase })] }),
            data.ctfMode ? jsx.jsxs('div', { className: 'aw-pill live', children: [jsx.jsx('b', { children: 'CTF' }), ' 拿 flag'] }) : null,
            data.useGoal ? jsx.jsxs('div', { className: 'aw-pill live', children: ['Goal ', jsx.jsx('b', { children: data.maxGoalRounds ? String(data.maxGoalRounds) : '不限' })] }) : null,
            jsx.jsxs('div', { className: 'aw-pill', children: ['指纹 ', jsx.jsx('b', { children: String(data.stats.fingerprints) })] }),
            jsx.jsxs('div', { className: 'aw-pill', children: ['点子 ', jsx.jsx('b', { children: String(data.stats.ideasPending) })] }),
            jsx.jsxs('div', { className: 'aw-pill', children: ['缺陷 ', jsx.jsx('b', { children: String(data.stats.findings) })] }),
            live
              ? jsx.jsx('button', { className: 'aw-btn warn', disabled: busy, onClick: () => { void run({ action: 'stop_run' }) }, children: '停止' })
              : jsx.jsx('button', {
                className: 'aw-btn',
                disabled: busy || !canStart,
                onClick: () => { void run(Object.assign({ action: 'start_run' }, cfg)) },
                children: form.useGoal ? '开始 Goal 长跑' : '开始自动审计',
              }),
          ] }),
        ] }),
        error ? jsx.jsx('div', { className: 'aw-err', style: { padding: '8px 20px' }, children: error }) : null,
        jsx.jsx('div', { className: 'aw-boards', children: [
          { id: 'config', label: '配置', icon: 'config' },
          { id: 'campaign', label: '目标', icon: 'target' },
          { id: 'ideas', label: '点子', icon: 'idea', count: data.stats.ideas },
          { id: 'map', label: '测绘', icon: 'scan', count: data.stats.fingerprints + data.stats.surfaces },
          { id: 'vulns', label: '漏洞', icon: 'bug', count: data.stats.findings },
        ].map((tab) => jsx.jsxs('button', {
          className: board === tab.id ? 'aw-board on' : 'aw-board',
          onClick: () => { void run({ action: 'view_board', board: tab.id }) },
          children: [
            icon(ICONS[tab.icon], 14),
            tab.label,
            tab.count !== undefined ? jsx.jsx('span', { className: 'aw-count', children: String(tab.count) }) : null,
          ],
        }, tab.id)) }),
        jsx.jsxs('div', { className: 'aw-body wide', children: [
          board === 'config' ? jsx.jsx('div', { className: 'aw-col', children: p0Form }) : null,
          board === 'campaign' ? jsx.jsx('div', { className: 'aw-col', children: campaignCard }) : null,
          board === 'ideas' ? jsx.jsx('div', { className: 'aw-col', children: ideaCard }) : null,
          board === 'map' ? jsx.jsxs('div', { className: 'aw-col', children: [fingerprintCard, surfaceCard, coverageCard] }) : null,
          board === 'vulns' ? jsx.jsx('div', { className: 'aw-col', children: findingCard }) : null,
        ].filter(Boolean) }),
      ] })
      return jsx.jsxs(React.Fragment, { children: [
        page,
        viewSnap && viewSnap.reportMarkdown
          ? jsx.jsx(ReportViewer, {
            finding: viewSnap,
            markdown: viewSnap.reportMarkdown,
            onClose: closeViewer,
          })
          : null,
      ] })
    }

    function AuditSettings(props) {
      const ctx = props && props.ctx
      const [pack, setPack] = React.useState(null)
      const [error, setError] = React.useState('')
      const [saving, setSaving] = React.useState(false)
      const [toolsDraft, setToolsDraft] = React.useState('')
      const [outputDraft, setOutputDraft] = React.useState('')
      const [picking, setPicking] = React.useState('')

      const load = React.useCallback(async () => {
        try {
          const res = await fetch('/local-audit-workspace?kind=settings', { cache: 'no-store' })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || ('HTTP ' + String(res.status)))
          setPack(json)
          setToolsDraft(json && json.settings && json.settings.toolsDir ? json.settings.toolsDir : '')
          setOutputDraft(json && json.settings && json.settings.outputDir ? json.settings.outputDir : '')
          setError('')
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }, [])

      React.useEffect(() => { void load() }, [load])

      async function save(patch) {
        const current = (pack && pack.settings) || {}
        const next = Object.assign({}, current, patch)
        try {
          setSaving(true)
          const res = await fetch('/local-audit-workspace', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'save_settings', settings: next }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || ('HTTP ' + String(res.status)))
          setPack(json)
          setToolsDraft(json && json.settings && json.settings.toolsDir ? json.settings.toolsDir : '')
          setOutputDraft(json && json.settings && json.settings.outputDir ? json.settings.outputDir : '')
          setError('')
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setSaving(false)
        }
      }

      async function pickFolder(kind) {
        if (picking) return
        setPicking(kind)
        try {
          let path = ''
          const res = await fetch('/local-audit-workspace', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ action: 'pick_directory' }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || ('HTTP ' + String(res.status)))
          if (json.cancelled) return
          if (!json.ok || !json.path) throw new Error(json.error || '未选择文件夹')
          path = String(json.path).trim()
          if (!path) throw new Error('选择器没有返回有效路径')
          if (kind === 'tools') {
            setToolsDraft(path)
            await save({ toolsDir: path })
          } else {
            setOutputDraft(path)
            await save({ outputDir: path })
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err))
        } finally {
          setPicking('')
        }
      }

      if (!pack) {
        return jsx.jsx('div', { className: 'aw-set', children: jsx.jsx('div', { className: 'aw-empty', children: error || '正在加载设置…' }) })
      }

      const settings = pack.settings || {}
      const models = Array.isArray(pack.models) ? pack.models : []
      const selected = `${settings.subagentProvider || ''}::${settings.subagentModel || ''}`
      const limits = pack.limits || { min: 1, max: 32 }

      return jsx.jsxs('div', { className: 'aw-set', children: [
        jsx.jsx('h2', { children: '黑盒 / 代审' }),
        jsx.jsx('p', { className: 'aw-set-lead', children: '子代理模型、并发上限、工具文件夹、报告输出地址和探测代理。漏洞三点闭合上报后会把专项报告写到输出地址。' }),
        error ? jsx.jsx('div', { className: 'aw-err', children: error }) : null,
        jsx.jsxs('div', { className: 'aw-set-row', children: [
          jsx.jsx('label', { htmlFor: 'aw-subagent-model', children: '子代理模型' }),
          jsx.jsx('div', { className: 'hint', children: '空选项表示跟随当前会话模型。写入后对新启动的子代理生效。' }),
          jsx.jsxs('select', {
            id: 'aw-subagent-model',
            disabled: saving,
            value: selected,
            onChange: (event) => {
              const value = event.target.value
              const sep = value.indexOf('::')
              const provider = sep >= 0 ? value.slice(0, sep) : ''
              const model = sep >= 0 ? value.slice(sep + 2) : ''
              void save({ subagentProvider: provider, subagentModel: model })
            },
            children: [
              jsx.jsx('option', { value: '::', children: '跟随当前会话模型' }),
              selected !== '::' && !models.some((row) => row.id === selected)
                ? jsx.jsx('option', { value: selected, children: `${settings.subagentProvider || 'provider'} / ${settings.subagentModel}` })
                : null,
              models.map((row) => jsx.jsx('option', { value: row.id, children: row.label }, row.id)),
            ],
          }),
        ] }),
        jsx.jsxs('div', { className: 'aw-set-row', children: [
          jsx.jsx('label', { htmlFor: 'aw-max-subagents', children: '子代理个数上限' }),
          jsx.jsx('div', { className: 'hint', children: `同时存活（含 continuable / 撰写子代理）不得超过此数，范围 ${limits.min}–${limits.max}。` }),
          jsx.jsx('input', {
            id: 'aw-max-subagents',
            type: 'number',
            min: limits.min,
            max: limits.max,
            disabled: saving,
            value: settings.maxSubagents,
            onChange: (event) => {
              const maxSubagents = Number(event.target.value)
              void save({ maxSubagents })
            },
          }),
          jsx.jsx('div', { className: 'aw-set-meta', children: `当前存活 ${pack.liveChildren || 0} / ${settings.maxSubagents}` }),
        ] }),
        jsx.jsxs('div', { className: 'aw-set-row', children: [
          jsx.jsx('label', { htmlFor: 'aw-tools-dir', children: '可调用工具文件夹' }),
          jsx.jsx('div', { className: 'hint', children: 'Agent 用 audit_kit 列出并运行该目录里的脚本（.ps1 / .py / .js / .exe 等）。只允许跑这个文件夹内的文件。' }),
          jsx.jsxs('div', { className: 'aw-set-path', children: [
            jsx.jsx('input', {
              id: 'aw-tools-dir',
              type: 'text',
              disabled: saving,
              placeholder: '例如 D:\\tools\\audit-kit',
              value: toolsDraft,
              onChange: (event) => { setToolsDraft(event.target.value) },
              onBlur: () => {
                if (toolsDraft.trim() === (settings.toolsDir || '')) return
                void save({ toolsDir: toolsDraft })
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              },
            }),
            jsx.jsx('button', {
              className: 'aw-btn ghost',
              type: 'button',
              disabled: saving || picking !== '',
              onClick: () => { void pickFolder('tools') },
              children: picking === 'tools' ? '选择中…' : '浏览',
            }),
          ] }),
          pack.kit && pack.kit.error
            ? jsx.jsx('div', { className: 'aw-err', children: pack.kit.error })
            : jsx.jsx('div', { className: 'aw-set-meta', children: pack.kit && pack.kit.ok ? `${pack.kit.dir} · ${((pack.kit.tools || []).filter((row) => row.runnable).length)} 个可运行` : '未配置' }),
          pack.kit && Array.isArray(pack.kit.tools) && pack.kit.tools.length > 0
            ? jsx.jsx('div', { className: 'aw-kit', children: pack.kit.tools.slice(0, 24).map((row) => jsx.jsx('div', { children: (row.runnable ? '▶ ' : '') + row.name }, row.name)) })
            : null,
        ] }),
        jsx.jsxs('div', { className: 'aw-set-row', children: [
          jsx.jsx('label', { htmlFor: 'aw-output-dir', children: '报告输出地址' }),
          jsx.jsx('div', { className: 'hint', children: '指定后写成该目录下「项目名 / SRC-nn 标题.md」。留空则写入当前会话工作区「审计报告/项目名/」。' }),
          jsx.jsxs('div', { className: 'aw-set-path', children: [
            jsx.jsx('input', {
              id: 'aw-output-dir',
              type: 'text',
              disabled: saving,
              placeholder: '例如 D:\\审计报告',
              value: outputDraft,
              onChange: (event) => { setOutputDraft(event.target.value) },
              onBlur: () => {
                if (outputDraft.trim() === (settings.outputDir || '')) return
                void save({ outputDir: outputDraft })
              },
              onKeyDown: (event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              },
            }),
            jsx.jsx('button', {
              className: 'aw-btn ghost',
              type: 'button',
              disabled: saving || picking !== '',
              onClick: () => { void pickFolder('output') },
              children: picking === 'output' ? '选择中…' : '浏览',
            }),
          ] }),
          jsx.jsx('div', { className: 'aw-set-meta', children: settings.outputDir ? settings.outputDir : '未指定：写入当前会话工作区 /审计报告' }),
        ] }),
        jsx.jsxs('div', { className: 'aw-set-row', children: [
          jsx.jsx('label', { htmlFor: 'aw-proxy-type', children: '探测代理' }),
          jsx.jsx('div', { className: 'hint', children: '黑盒探测走 HTTP 或 SOCKS5。curl / pwsh / audit_kit 都会带上该代理。关闭则直连。' }),
          jsx.jsxs('select', {
            id: 'aw-proxy-type',
            disabled: saving,
            value: settings.proxyType || 'off',
            onChange: (event) => { void save({ proxyType: event.target.value }) },
            children: [
              jsx.jsx('option', { value: 'off', children: '关闭（直连）' }),
              jsx.jsx('option', { value: 'http', children: 'HTTP 代理' }),
              jsx.jsx('option', { value: 'socks5', children: 'SOCKS5 代理' }),
            ],
          }),
          settings.proxyType && settings.proxyType !== 'off'
            ? jsx.jsxs('div', { className: 'aw-pair', children: [
              jsx.jsx('input', {
                type: 'text',
                placeholder: '主机，例如 127.0.0.1',
                disabled: saving,
                value: settings.proxyHost || '',
                onBlur: (event) => { void save({ proxyHost: event.target.value }) },
                onChange: (event) => {
                  setPack((prev) => {
                    if (!prev) return prev
                    return Object.assign({}, prev, { settings: Object.assign({}, prev.settings, { proxyHost: event.target.value }) })
                  })
                },
              }),
              jsx.jsx('input', {
                type: 'text',
                placeholder: settings.proxyType === 'socks5' ? '端口 1080' : '端口 8080',
                disabled: saving,
                value: settings.proxyPort || '',
                onBlur: (event) => { void save({ proxyPort: event.target.value }) },
                onChange: (event) => {
                  setPack((prev) => {
                    if (!prev) return prev
                    return Object.assign({}, prev, { settings: Object.assign({}, prev.settings, { proxyPort: event.target.value }) })
                  })
                },
              }),
            ] })
            : null,
          settings.proxyType && settings.proxyType !== 'off'
            ? jsx.jsxs('div', { className: 'aw-pair', children: [
              jsx.jsx('input', {
                type: 'text',
                placeholder: '用户名（可选）',
                disabled: saving,
                value: settings.proxyUser || '',
                onBlur: (event) => { void save({ proxyUser: event.target.value }) },
                onChange: (event) => {
                  setPack((prev) => {
                    if (!prev) return prev
                    return Object.assign({}, prev, { settings: Object.assign({}, prev.settings, { proxyUser: event.target.value }) })
                  })
                },
              }),
              jsx.jsx('input', {
                type: 'password',
                placeholder: '密码（可选）',
                disabled: saving,
                value: settings.proxyPass || '',
                onBlur: (event) => { void save({ proxyPass: event.target.value }) },
                onChange: (event) => {
                  setPack((prev) => {
                    if (!prev) return prev
                    return Object.assign({}, prev, { settings: Object.assign({}, prev.settings, { proxyPass: event.target.value }) })
                  })
                },
              }),
            ] })
            : null,
        ] }),
      ] })
    }

    function AuditSidebar(props) {
      const wide = props.wide === true
      const host = props.ctx
      const useSessions = props.useSessions
      const current = typeof useSessions === 'function' ? useSessions((state) => state.current) : undefined
      const [open, setOpen] = React.useState(false)
      const [liveHint, setLiveHint] = React.useState(false)
      const rootRef = React.useRef(null)
      const [anchor, setAnchor] = React.useState(null)

      React.useLayoutEffect(() => {
        if (!open) return undefined
        const place = () => {
          const rect = rootRef.current && rootRef.current.getBoundingClientRect()
          if (rect) {
            const width = Math.min(920, Math.max(560, window.innerWidth - 32))
            let left = rect.left
            if (left + width > window.innerWidth - 12) left = Math.max(12, window.innerWidth - width - 12)
            setAnchor({
              left,
              bottom: window.innerHeight - rect.top + 8,
              width,
            })
          }
        }
        place()
        window.addEventListener('resize', place)
        return () => { window.removeEventListener('resize', place) }
      }, [open])

      React.useEffect(() => {
        if (!current) {
          setLiveHint(false)
          return undefined
        }
        let cancelled = false
        const tick = async () => {
          try {
            const next = await apiGet(current)
            if (!cancelled) setLiveHint(Boolean(next.run && next.run.status === 'running'))
          } catch {
            if (!cancelled) setLiveHint(false)
          }
        }
        void tick()
        const timer = setInterval(() => { void tick() }, 4000)
        return () => {
          cancelled = true
          clearInterval(timer)
        }
      }, [current])

      React.useEffect(() => {
        if (!open) return undefined
        const onPointer = (event) => {
          const node = rootRef.current
          if (!node) return
          const target = event.target
          if (target && node.contains(target)) return
          setOpen(false)
        }
        const onKey = (event) => {
          if (event.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onPointer)
        document.addEventListener('keydown', onKey)
        return () => {
          document.removeEventListener('mousedown', onPointer)
          document.removeEventListener('keydown', onKey)
        }
      }, [open])

      function openSession(id) {
        const sessions = host && typeof host.get === 'function' ? host.get('sessions') : undefined
        if (sessions && typeof sessions.open === 'function') sessions.open(id)
      }

      return jsx.jsxs('div', {
        ref: rootRef,
        className: wide ? 'aw-layer' : 'aw-layer rail',
        children: [
          open && anchor
            ? jsx.jsx('section', {
              className: 'aw-flyout',
              style: { left: anchor.left, bottom: anchor.bottom, width: anchor.width },
              'aria-label': '黑盒/代审',
              children: jsx.jsx(AuditView, {
                sessionId: current,
                compact: true,
                openSession,
                onLiveChange: setLiveHint,
              }),
            })
            : null,
          jsx.jsx('button', {
            type: 'button',
            className: 'aw-trigger',
            'data-open': open || undefined,
            'data-live': liveHint || undefined,
            'aria-label': '黑盒/代审',
            'aria-expanded': open,
            onClick: () => { setOpen((value) => !value) },
            children: [
              flowerIcon(wide ? 16 : 18, liveHint),
              wide ? jsx.jsx('span', { className: 'aw-trigger-label', children: '黑盒/代审' }) : null,
              wide ? jsx.jsx('span', { className: 'aw-trigger-meta', children: liveHint ? '运行中' : '展开' }) : null,
            ].filter(Boolean),
          }),
        ],
      })
    }

    const inject = ['slots']
    function apply(ctx) {
      ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'audit-workspace',
        order: 20,
        label: '黑盒/代审',
      }, function Bound(props) {
        return jsx.jsx(AuditSidebar, Object.assign({}, props, { ctx }))
      }))
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'audit-workspace',
        order: 24,
        label: '黑盒/代审',
      }, function BoundSettings(props) {
        return jsx.jsx(AuditSettings, Object.assign({}, props, { ctx }))
      }))
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})
