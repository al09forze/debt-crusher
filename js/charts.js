/* Debt Crusher — tiny SVG chart helpers (no external libs).
 * Restrained, serious, mobile-friendly visuals. No 3D, no pie overload.
 */
const Charts = (function () {

  function escape(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // Horizontal bar list (great for category spend)
  function barList(data, opts={}) {
    // data: [{label, value, planned?, color?}]
    if (!data.length) return `<div class="muted center" style="padding:24px">No data yet.</div>`;
    const max = Math.max(...data.map(d => Math.max(d.value, d.planned || 0)), 1);
    return `
    <div class="barlist">
      ${data.map(d => {
        const pct = Math.min(100, (d.value / max) * 100);
        const ppct = d.planned ? Math.min(100, (d.planned / max) * 100) : 0;
        const over = d.planned ? d.value > d.planned : false;
        const valColor = over ? 'var(--danger)' : 'var(--text)';
        return `
        <div class="barlist__row" style="padding:8px 0">
          <div class="barlist__head" style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px;">
            <span style="color:var(--text-soft)">${escape(d.label)}</span>
            <span class="num" style="color:${valColor}">${Calc.money(d.value)}${d.planned ? ' <span class="muted" style="font-size:11px"> / '+Calc.money(d.planned)+'</span>' : ''}</span>
          </div>
          <div class="bar" style="height:6px">
            ${d.planned ? `<div style="position:absolute;left:0;top:-2px;bottom:-2px;width:${ppct}%;border-right:2px dashed var(--text-faint);"></div>` : ''}
            <div class="bar__fill ${over?'danger':''}" style="width:${pct}%;background:${d.color || (over ? 'var(--danger)' : 'var(--accent)')}"></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  // Sparkline / line chart — debt-free trajectory etc.
  function lineChart(series, opts={}) {
    // series: array of {x, y} OR plain numbers
    const W = opts.width || 320;
    const H = opts.height || 180;
    const pad = { l: 36, r: 12, t: 14, b: 22 };
    if (!series.length) return `<svg viewBox="0 0 ${W} ${H}"></svg>`;

    const points = series.map((p,i) => (typeof p === 'number' ? { x: i, y: p } : p));
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const xMin = Math.min(...xs), xMax = Math.max(...xs);
    const yMin = 0, yMax = Math.max(...ys, 1);
    const sx = x => pad.l + ((x - xMin) / Math.max(1, xMax - xMin)) * (W - pad.l - pad.r);
    const sy = y => H - pad.b - ((y - yMin) / Math.max(1, yMax - yMin)) * (H - pad.t - pad.b);

    // axis ticks (4)
    const ticks = [];
    for (let i = 0; i <= 3; i++) {
      const v = yMin + (yMax - yMin) * (i/3);
      ticks.push({ v, y: sy(v) });
    }

    const d = points.map((p,i) => (i===0 ? 'M':'L')+sx(p.x)+','+sy(p.y)).join(' ');
    const area = d + ` L ${sx(points[points.length-1].x)},${H-pad.b} L ${sx(points[0].x)},${H-pad.b} Z`;

    const xLabels = opts.xLabels || [];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="lg-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stop-color="var(--accent)" stop-opacity="0.30"/>
          <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${ticks.map(t => `
        <line x1="${pad.l}" x2="${W-pad.r}" y1="${t.y}" y2="${t.y}" stroke="var(--line-soft)" stroke-width="1"/>
        <text x="${pad.l-6}" y="${t.y+3}" font-size="10" fill="var(--text-mute)" text-anchor="end" font-family="var(--font-mono)">${opts.fmt ? opts.fmt(t.v) : Math.round(t.v)}</text>
      `).join('')}
      <path d="${area}" fill="url(#lg-fill)"/>
      <path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${xLabels.map((lbl,i) => {
        if (i % Math.max(1, Math.floor(xLabels.length/4)) !== 0) return '';
        const xPos = sx(xMin + (xMax-xMin) * (i/(xLabels.length-1)));
        return `<text x="${xPos}" y="${H-6}" font-size="10" fill="var(--text-mute)" text-anchor="middle">${escape(lbl)}</text>`;
      }).join('')}
    </svg>`;
  }

  // Side-by-side strategy comparison bars
  function comparisonBars(items, opts={}) {
    // items: [{label, monthsA, monthsB, interestA, interestB, ...}] OR [{label, value, color}]
    const W = opts.width || 320, H = opts.height || 110;
    const max = Math.max(...items.map(i => i.value), 1);
    const barH = 22, gap = 14;
    return `<svg viewBox="0 0 ${W} ${(barH+gap)*items.length+10}" class="chart" style="height:auto">
      ${items.map((it,i) => {
        const w = (it.value / max) * (W - 130);
        return `
          <text x="0" y="${i*(barH+gap)+15}" fill="var(--text-soft)" font-size="12">${escape(it.label)}</text>
          <rect x="100" y="${i*(barH+gap)+2}" width="${w}" height="${barH}" rx="4" fill="${it.color || 'var(--accent)'}"/>
          <text x="${100+w+6}" y="${i*(barH+gap)+18}" font-size="12" fill="var(--text)" font-family="var(--font-mono)">${escape(it.display || it.value)}</text>
        `;
      }).join('')}
    </svg>`;
  }

  return { barList, lineChart, comparisonBars };
})();
window.Charts = Charts;
