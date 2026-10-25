/* 슬라이드 엔진 + 차트 + 애니메이션 */
(function () {
  const D = window.DECK;
  const C = { blue: '#2a78d6', blueD: '#1c5cab', blueL: '#8fb9ec', orange: '#eb6834', orangeL: '#f2b295',
              red: '#e34948', gray: '#c9c3b6', pale: '#e4ddcf', ink: '#1d2433', ink2: '#5b6170', muted: '#8d909a', line: '#e2dccf' };
  const NS = 'http://www.w3.org/2000/svg';
  const pct = (v, d = 0) => (v * 100).toFixed(d) + '%';
  const fmt = (v, d = 0) => d ? v.toFixed(d) : Math.round(v).toLocaleString('ko-KR');

  // 작은 SVG 헬퍼: svg(el, '<rect .../>') 식으로 문자열을 넣는다
  function svgRoot(w, h) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', `0 0 ${w} ${h}`);
    return s;
  }
  const T = (x, y, txt, o = {}) =>
    `<text x="${x}" y="${y}" font-size="${o.size || 18}" fill="${o.fill || C.ink2}" text-anchor="${o.anchor || 'start'}" font-weight="${o.weight || 400}" dominant-baseline="${o.base || 'middle'}" class="${o.cls || ''}">${txt}</text>`;
  // 4px 둥근 데이터 끝 (기준선 쪽은 각지게)
  function barH(x, y, w, h, fill, cls = 'grow-x', rtl = false) {
    const r = Math.min(4, w / 2, h / 2);
    if (w <= 0) return '';
    const d = rtl
      ? `M${x + w},${y} H${x + r} Q${x},${y} ${x},${y + r} V${y + h - r} Q${x},${y + h} ${x + r},${y + h} H${x + w} Z`
      : `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;
    return `<path d="${d}" fill="${fill}" class="${cls}${rtl ? ' rtl' : ''}"/>`;
  }
  function barV(x, y, w, h, fill, cls = 'grow-y') {
    const r = Math.min(4, w / 2, h / 2);
    if (h <= 0) return '';
    const d = `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
    return `<path d="${d}" fill="${fill}" class="${cls}"/>`;
  }
  function mount(id, w, h, html) {
    const host = document.getElementById(id);
    if (!host) return;
    let s = host.tagName.toLowerCase() === 'svg' ? host : null;
    if (!s) { s = svgRoot(w, h); host.appendChild(s); }
    s.innerHTML = html;
  }

  /* ---------------- 표지 서가 ---------------- */
  function buildShelf() {
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    let x = 30, html = '';
    const base = 312;
    while (x < 1570) {
      const w = 14 + Math.round(rnd() * 16);
      const h = 120 + Math.round(rnd() * 150);
      const borrowed = rnd() < 0.32;
      const fill = borrowed ? (rnd() < 0.4 ? C.blueD : C.blue) : C.pale;
      const tilt = !borrowed && rnd() < 0.04;
      html += `<rect class="book grow-y ${borrowed ? 'lent' : ''}" data-y="${base - h}" x="${x}" y="${base - h}" width="${w}" height="${h}" rx="2" fill="${fill}" ${tilt ? `transform="rotate(-6 ${x} ${base})"` : ''}/>`;
      if (borrowed && h > 170) html += `<rect class="book-band fade-late" x="${x + 3}" y="${base - h + 18}" width="${w - 6}" height="3" fill="#fff" fill-opacity=".7"/>`;
      x += w + 3 + (rnd() < 0.06 ? 14 : 0);
    }
    html += `<rect x="0" y="${base}" width="1600" height="18" fill="#d8cfbd"/><rect x="0" y="${base + 18}" width="1600" height="6" fill="#c8bea9"/>`;
    document.getElementById('shelf').innerHTML = html;
  }

  /* ---------------- 3. 와플 ---------------- */
  function buildWaffle() {
    const el = document.getElementById('waffle');
    let h = '';
    for (let i = 0; i < 100; i++) h += `<div class="cell ${i < 68 ? 'zero' : ''}"></div>`;
    el.innerHTML = h;
  }

  /* ---------------- 8. 결측률 ---------------- */
  function buildMissing() {
    const rows = D.missing.filter(m => ['부가기호', '주제분류번호', '출판사', '발행년도'].includes(m.col));
    const W = 420, rowH = 58, L = 120, maxW = 220;
    let h = '';
    rows.forEach((m, i) => {
      const y = 20 + i * rowH;
      h += T(0, y + 14, m.col === '주제분류번호' ? '분류번호' : m.col, { size: 18, fill: C.ink });
      h += `<rect x="${L}" y="${y}" width="${maxW}" height="28" rx="4" fill="#f3eee4"/>`;
      h += barH(L, y, Math.max(2, m.rate / 0.4 * maxW), 28, i < 2 ? C.orange : C.gray);
      h += T(L + maxW + 12, y + 14, pct(m.rate, m.rate < 0.01 ? 1 : 0), { size: 18, fill: C.ink, weight: 700, cls: 'fade-late' });
    });
    h += T(0, 20 + rows.length * rowH + 10, '※ 세트 ISBN·권은 해당 도서에만 있는 값이라 제외', { size: 14, fill: C.muted });
    mount('missingChart', W, 20 + rows.length * rowH + 30, h);
  }

  /* ---------------- 10. 대출 구간 ---------------- */
  function buildBands() {
    const W = 900, rowH = 70, L = 120, maxW = 640, max = 0.7;
    let h = '';
    D.bands.forEach((b, i) => {
      const y = 10 + i * rowH;
      h += T(L - 16, y + 24, b.band, { size: 20, fill: C.ink, anchor: 'end', weight: 600 });
      const ws = b.stock / max * maxW, wl = b.loans / max * maxW;
      h += barH(L, y + 2, ws, 22, C.gray);
      h += barH(L, y + 26, Math.max(wl, 0), 22, C.blue);
      h += T(L + ws + 10, y + 13, pct(b.stock, b.stock < .1 ? 1 : 0), { size: 16, fill: C.ink2, cls: 'fade-late' });
      h += T(L + Math.max(wl, 0) + 10, y + 37, pct(b.loans, b.loans < .1 ? 1 : 0), { size: 16, fill: C.blueD, weight: 700, cls: 'fade-late' });
    });
    h += `<line x1="${L}" y1="0" x2="${L}" y2="${10 + D.bands.length * rowH - 10}" stroke="${C.ink2}" stroke-width="1.5"/>`;
    mount('bandChart', W, 10 + D.bands.length * rowH, h);
  }

  /* ---------------- 11. 발산 막대 ---------------- */
  function buildDiverge() {
    const W = 900, rowH = 48, L = 130, R = 860, lo = 0.3, hi = 1.6;
    const sx = v => L + (v - lo) / (hi - lo) * (R - L);
    const rows = [...D.subjects].sort((a, b) => b.index - a.index);
    let h = '';
    // 눈금
    [0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6].forEach(t => {
      h += `<line x1="${sx(t)}" y1="0" x2="${sx(t)}" y2="${rows.length * rowH}" stroke="${t === 1 ? C.ink : C.line}" stroke-width="${t === 1 ? 2 : 1}"/>`;
      h += T(sx(t), rows.length * rowH + 22, t.toFixed(1), { size: 15, fill: C.muted, anchor: 'middle' });
    });
    rows.forEach((r, i) => {
      const y = i * rowH + 8;
      const unk = r.name === '미분류';
      const col = unk ? C.gray : (r.index >= 1 ? C.blue : C.red);
      h += T(L - 16, y + 16, r.name, { size: 19, fill: unk ? C.muted : C.ink, anchor: 'end', weight: 600 });
      if (r.index >= 1) {
        h += barH(sx(1), y, sx(r.index) - sx(1), 32, col);
        h += T(sx(r.index) + 10, y + 16, r.index.toFixed(2), { size: 16, fill: C.ink, weight: 700, cls: 'fade-late' });
      } else {
        h += barH(sx(r.index), y, sx(1) - sx(r.index), 32, col, 'grow-x', true);
        h += T(sx(r.index) - 10, y + 16, r.index.toFixed(2), { size: 16, fill: C.ink, weight: 700, anchor: 'end', cls: 'fade-late' });
      }
    });
    h += T(sx(1.3), rows.length * rowH + 50, '공급 부족 →', { size: 16, fill: C.blue, anchor: 'middle', weight: 700 });
    h += T(sx(0.7), rows.length * rowH + 50, '← 공급 과잉', { size: 16, fill: C.red, anchor: 'middle', weight: 700 });
    mount('divergeChart', W, rows.length * rowH + 64, h);
  }

  /* ---------------- 14. 신간성 ---------------- */
  function buildFresh() {
    const W = 900, H = 520, B = 400, top = 40, L = 70, max = 0.2;
    const n = D.fresh.length, slot = (W - L) / n, bw = slot * 0.56;
    let h = '';
    [0, 0.05, 0.1, 0.15, 0.2].forEach(t => {
      const y = B - t / max * (B - top);
      h += `<line x1="${L}" y1="${y}" x2="${W}" y2="${y}" stroke="${t ? C.line : C.ink2}" stroke-width="${t ? 1 : 1.5}"/>`;
      h += T(L - 12, y, t.toFixed(2), { size: 15, fill: C.muted, anchor: 'end' });
    });
    D.fresh.forEach((f, i) => {
      const x = L + i * slot + (slot - bw) / 2, hh = f.ml / max * (B - top);
      h += barV(x, B - hh, bw, hh, i === 0 ? C.blue : (i === n - 1 ? C.gray : C.blueL));
      h += T(x + bw / 2, B - hh - 16, f.ml.toFixed(3), { size: 18, fill: C.ink, anchor: 'middle', weight: 700, cls: 'fade-late' });
      h += T(x + bw / 2, B + 26, f.g, { size: 19, fill: C.ink, anchor: 'middle', weight: 600 });
      h += T(x + bw / 2, B + 56, `대출 0회 ${pct(f.zero)}`, { size: 15, fill: f.zero > .7 ? C.red : C.muted, anchor: 'middle' });
    });
    h += T(L, 12, '권당 월평균 대출', { size: 15, fill: C.muted });
    h += T((W + L) / 2, B + 92, '출간 → 도서관 등록까지 걸린 기간', { size: 16, fill: C.ink2, anchor: 'middle' });
    mount('freshChart', W, H, h);
  }

  /* ---------------- 16. 복본 ---------------- */
  function buildCopies() {
    const W = 900, H = 500, B = 380, top = 40, L = 70, max = 4;
    const n = D.copies.length, slot = (W - L) / n, bw = slot * 0.56;
    let h = '';
    [0, 1, 2, 3, 4].forEach(t => {
      const y = B - t / max * (B - top);
      h += `<line x1="${L}" y1="${y}" x2="${W}" y2="${y}" stroke="${t ? C.line : C.ink2}" stroke-width="${t ? 1 : 1.5}"/>`;
      h += T(L - 12, y, t, { size: 15, fill: C.muted, anchor: 'end' });
    });
    D.copies.forEach((c, i) => {
      const x = L + i * slot + (slot - bw) / 2, hh = c.per / max * (B - top);
      h += barV(x, B - hh, bw, hh, i >= 3 ? C.red : C.blue);
      h += T(x + bw / 2, B - hh - 16, c.per.toFixed(1) + '회', { size: 18, fill: C.ink, anchor: 'middle', weight: 700, cls: 'fade-late' });
      h += T(x + bw / 2, B + 26, c.c, { size: 19, fill: C.ink, anchor: 'middle', weight: 600 });
      h += T(x + bw / 2, B + 54, `미대출 ${pct(c.zero)}`, { size: 15, fill: c.zero > .7 ? C.red : C.muted, anchor: 'middle' });
      h += T(x + bw / 2, B + 78, `${fmt(c.titles)}종`, { size: 14, fill: C.muted, anchor: 'middle' });
    });
    h += T(L, 12, '권당 평균 누적 대출', { size: 15, fill: C.muted });
    mount('copyChart', W, H, h);
  }

  /* ---------------- 22. 키워드 ---------------- */
  function buildKeywords() {
    const W = 900, rowH = 46, L = 130, R = 800, max = 17;
    const sx = v => L + v / max * (R - L);
    const rows = [...D.keywords].sort((a, b) => b.ratio - a.ratio);
    let h = '';
    rows.forEach((r, i) => {
      const y = i * rowH + 6;
      h += T(L - 14, y + 15, r.kw, { size: 19, fill: C.ink, anchor: 'end', weight: 600 });
      h += barH(L, y, sx(r.ratio) - L, 30, r.ratio >= 1 ? C.blue : C.red);
      h += T(sx(r.ratio) + 10, y + 15, r.ratio.toFixed(1) + '배', { size: 16, fill: C.ink, weight: 700, cls: 'fade-late' });
      h += T(sx(r.ratio) + 70, y + 15, `(${fmt(r.n)}권)`, { size: 14, fill: C.muted, cls: 'fade-late' });
    });
    h += `<line x1="${sx(1)}" y1="0" x2="${sx(1)}" y2="${rows.length * rowH}" stroke="${C.ink}" stroke-dasharray="4 4"/>`;
    h += T(sx(1) + 6, rows.length * rowH + 16, '평균 = 1배', { size: 14, fill: C.ink2 });
    mount('kwChart', W, rows.length * rowH + 30, h);
  }

  /* ---------------- 23. 간트 ---------------- */
  function buildGantt() {
    const W = 1400, L = 330, top = 60, rowH = 64;
    const start = new Date('2026-10-19'), end = new Date('2026-12-21');
    const days = (end - start) / 864e5, sx = d => L + (new Date(d) - start) / 864e5 / days * (W - L - 10);
    const tasks = [
      ['주제 선정 · 예비 분석', '2026-10-19', '2026-10-31', 'done'],
      ['전처리 · 지표 정의', '2026-11-02', '2026-11-14'],
      ['RQ1 · RQ2 분석 (집중도 · 수요–공급)', '2026-11-09', '2026-11-22'],
      ['RQ3 · RQ4 분석 (시간 효과 · 운영 효율)', '2026-11-16', '2026-11-29'],
      ['요인 모델링 (회귀 · 트리)', '2026-11-23', '2026-12-06'],
      ['운영 제안 도출 · 검증', '2026-11-30', '2026-12-11'],
      ['최종 보고서 · 발표', '2026-12-07', '2026-12-18', 'final'],
    ];
    let h = '';
    // 주 눈금
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      const x = sx(d);
      h += `<line x1="${x}" y1="${top - 14}" x2="${x}" y2="${top + tasks.length * rowH}" stroke="${C.line}"/>`;
      h += T(x + 6, top - 30, `${d.getMonth() + 1}/${d.getDate()}`, { size: 15, fill: C.muted });
    }
    tasks.forEach((t, i) => {
      const y = top + i * rowH + 14;
      const col = t[3] === 'done' ? C.gray : (t[3] === 'final' ? C.orange : C.blue);
      h += T(L - 20, y + 18, t[0], { size: 19, fill: t[3] === 'done' ? C.muted : C.ink, anchor: 'end', weight: 600 });
      const x1 = sx(t[1]), x2 = sx(t[2]);
      h += `<rect class="grow-x" x="${x1}" y="${y}" width="${x2 - x1}" height="36" rx="8" fill="${col}"/>`;
      if (t[3] === 'done') h += T(x1 + 12, y + 18, '완료', { size: 15, fill: '#fff', weight: 700, cls: 'fade-late' });
    });
    const now = sx('2026-10-25');
    h += `<line class="draw" x1="${now}" y1="${top - 14}" x2="${now}" y2="${top + tasks.length * rowH + 10}" stroke="${C.red}" stroke-width="2.5"/>`;
    h += T(now, top + tasks.length * rowH + 34, '오늘 · 중간 제출', { size: 16, fill: C.red, anchor: 'middle', weight: 700, cls: 'fade-late' });
    mount('ganttChart', W, top + tasks.length * rowH + 50, h);
  }

  /* ---------------- 17. 사분면 ---------------- */
  function buildQuad() {
    const W = 720, H = 560, L = 70, B = 500, R = 700, top = 20, mx = (L + R) / 2, my = (top + B) / 2;
    let h = '';
    const q = [
      [L, top, '확충', '수요↑ 공급↓', C.blue, '#e3eefb'],
      [mx, top, '유지', '수요↑ 공급↑', C.blueL, '#eef4fc'],
      [L, my, '재노출', '수요↓ 공급↓', C.orangeL, '#fdf3ee'],
      [mx, my, '정리', '수요↓ 공급↑', C.orange, '#fdebe2'],
    ];
    q.forEach(([x, y, t, s, c, bg]) => {
      h += `<g class="pop"><rect x="${x + 4}" y="${y + 4}" width="${mx - L - 8}" height="${my - top - 8}" rx="14" fill="${bg}"/>`;
      h += `<rect x="${x + 22}" y="${y + 24}" width="14" height="14" rx="3" fill="${c}"/>`;
      h += T(x + 46, y + 32, t, { size: 26, fill: C.ink, weight: 800 });
      h += T(x + 22, y + 66, s, { size: 16, fill: C.ink2 });
      h += '</g>';
    });
    // 예시 세그먼트 (예비 분석 근거)
    const chips = [
      [L + 30, top + 130, '아동·자연과학'], [L + 30, top + 175, '교양·일본문학'], [L + 30, top + 220, '수학'],
      [mx + 26, top + 130, '한국문학'], [mx + 26, top + 175, '아동 학습만화'],
      [L + 30, my + 130, '공연예술'], [L + 30, my + 175, '건축술'],
      [mx + 26, my + 130, '전문서'], [mx + 26, my + 175, '행정·정치학'], [mx + 26, my + 220, '기독교'],
    ];
    chips.forEach(([x, y, t]) => {
      const w = t.length * 17 + 26;
      h += `<g class="chip pop"><rect x="${x}" y="${y - 17}" width="${w}" height="34" rx="17" fill="#fff" stroke="${C.line}"/>${T(x + w / 2, y + 1, t, { size: 16, fill: C.ink, anchor: 'middle' })}</g>`;
    });
    h += `<line class="draw" x1="${L}" y1="${B}" x2="${R}" y2="${B}" stroke="${C.ink}" stroke-width="2"/>`;
    h += `<line class="draw" x1="${L}" y1="${B}" x2="${L}" y2="${top}" stroke="${C.ink}" stroke-width="2"/>`;
    h += T(R, B + 30, '공급 (장서 비중) →', { size: 17, fill: C.ink2, anchor: 'end', weight: 600 });
    h += `<text x="${L - 30}" y="${top}" font-size="17" fill="${C.ink2}" font-weight="600" text-anchor="end" transform="rotate(-90 ${L - 30} ${top})">수요 (수요지수) →</text>`;
    h += T(L + 8, B + 30, '※ 칩은 예비 분석 기반 예시 배치', { size: 14, fill: C.muted });
    mount('quadSvg', W, H, h);
  }

  /* ---------------- 19. 파이프라인 ---------------- */
  function buildPipe() {
    const steps = [
      ['수집 · 정제', ['빈 컬럼 제거', '타입 변환', '결측 분리']],
      ['식별 · 보정', ['도서키(전집)', '보유 개월', '월평균 대출']],
      ['지표 산출', ['수요지수', '미대출률', '대기 압력']],
      ['세그먼트 분석', ['중분류 × 대상', 'RQ1 ~ RQ4', '요인 모델']],
      ['제안 도출', ['4-Action 매트릭스', '우선순위', '후보 목록']],
      ['검증', ['기준값 민감도', '사례 점검', '한계 명시']],
    ];
    const W = 1440, y = 130, x0 = 110, gap = (W - 2 * x0) / (steps.length - 1);
    let h = `<path class="draw" d="M${x0},${y} H${W - x0}" stroke="${C.line}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    h += `<path class="draw flow" d="M${x0},${y} H${W - x0}" stroke="${C.blue}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    steps.forEach(([t, items], i) => {
      const x = x0 + i * gap;
      const col = i === 4 ? C.orange : C.blue;
      h += `<g class="pop node"><circle cx="${x}" cy="${y}" r="46" fill="#fff" stroke="${col}" stroke-width="5"/>${T(x, y + 2, '0' + (i + 1), { size: 28, fill: col, anchor: 'middle', weight: 800 })}</g>`;
      h += T(x, y + 92, t, { size: 25, fill: C.ink, anchor: 'middle', weight: 800, cls: 'fade-late' });
      items.forEach((it, j) => {
        h += `<g class="fade-late"><rect x="${x - 98}" y="${y + 126 + j * 52}" width="196" height="40" rx="10" fill="${i === 4 ? '#fdebe2' : '#f3eee4'}"/>${T(x, y + 147 + j * 52, it, { size: 17, fill: C.ink2, anchor: 'middle' })}</g>`;
      });
    });
    h += T(W / 2, 30, 'Python · pandas · matplotlib · statsmodels · scikit-learn · Jupyter', { size: 18, fill: C.muted, anchor: 'middle' });
    mount('pipeSvg', W, 470, h);
  }

  /* ---------------- 9 / 12. manim 대체용 SVG ---------------- */
  function buildLorenzFallback() {
    const L = 70, B = 470, S = 420, lz = D.lorenz;
    const pts = lz.x.map((x, i) => `${L + x * S * 1.3},${B - lz.y[i] * S}`).join(' L');
    let h = `<line x1="${L}" y1="${B}" x2="${L + S * 1.3}" y2="${B - S}" stroke="${C.gray}" stroke-dasharray="6 6" stroke-width="2"/>`;
    h += `<path class="fade-late" d="M${pts} L${L},${B} Z" fill="${C.blue}" fill-opacity=".1"/>`;
    h += `<path class="draw" d="M${pts}" fill="none" stroke="${C.blue}" stroke-width="4"/>`;
    h += `<line x1="${L}" y1="${B}" x2="${L + S * 1.3}" y2="${B}" stroke="${C.ink2}"/><line x1="${L}" y1="${B}" x2="${L}" y2="${B - S}" stroke="${C.ink2}"/>`;
    h += T(L + S * 0.65, B + 34, '장서 누적 비율 (대출 적은 순)', { size: 16, anchor: 'middle' });
    mount('lorenzSvg', 640, 520, h);
  }
  function buildScatterFallback() {
    const L = 80, B = 450, W = 520, H = 400, lo = Math.log(0.01), hi = Math.log(0.45);
    const sx = v => L + (Math.log(v) - lo) / (hi - lo) * W, sy = v => B - (Math.log(v) - lo) / (hi - lo) * H;
    let h = `<line x1="${sx(0.01)}" y1="${sy(0.01)}" x2="${sx(0.45)}" y2="${sy(0.45)}" stroke="${C.gray}" stroke-dasharray="6 6" stroke-width="2"/>`;
    [0.01, 0.02, 0.05, 0.1, 0.2, 0.4].forEach(t => {
      h += T(sx(t), B + 24, pct(t), { size: 14, fill: C.muted, anchor: 'middle' });
      h += T(L - 10, sy(t), pct(t), { size: 14, fill: C.muted, anchor: 'end' });
    });
    h += `<line x1="${L}" y1="${B}" x2="${L + W}" y2="${B}" stroke="${C.ink2}"/><line x1="${L}" y1="${B}" x2="${L}" y2="${B - H}" stroke="${C.ink2}"/>`;
    const off = { '철학': [-12, 14, 'end'], '역사': [12, 14, 'start'], '기술과학': [12, -4, 'start'], '자연과학': [-12, -8, 'end'], '언어': [12, 0, 'start'], '예술': [-12, 6, 'end'], '종교': [12, 6, 'start'] };
    D.scatter.forEach(p => {
      const x = sx(p.stock), y = sy(p.loan);
      const col = p.name === '미분류' ? C.gray : (p.index >= 1 ? C.blue : C.red);
      const [dx, dy, an] = off[p.name] || [12, 0, 'start'];
      h += `<g class="pop"><circle cx="${x}" cy="${y}" r="8" fill="${col}"/>${T(x + dx, y + dy, p.name, { size: 15, fill: C.ink, anchor: an })}</g>`;
    });
    h += T(L + W / 2, B + 52, '장서 비중 (로그 축)', { size: 15, anchor: 'middle' });
    mount('scatterSvg', 640, 520, h);
  }

  /* ---------------- 25. 다시 짠 서가 ---------------- */
  function buildShelf2() {
    let seed = 11;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const books = [];
    for (let i = 0; i < 46; i++) books.push({ w: 12 + Math.round(rnd() * 12), h: 110 + Math.round(rnd() * 120), lent: rnd() < 0.5 });
    const orig = books.map((b, i) => i);
    const sorted = [...orig].sort((a, b) => (books[b].lent - books[a].lent) || (books[b].h - books[a].h));
    const pos = arr => { let x = 10; const m = {}; arr.forEach(i => { m[i] = x; x += books[i].w + 3; }); return m; };
    const p0 = pos(orig), p1 = pos(sorted), base = 260;
    let h = '';
    orig.forEach(i => {
      const b = books[i];
      h += `<rect class="book2" data-dx="${p0[i] - p1[i]}" x="${p1[i]}" y="${base - b.h}" width="${b.w}" height="${b.h}" rx="2" fill="${b.lent ? (i % 3 ? C.blue : C.blueD) : C.pale}"/>`;
    });
    h += `<rect x="0" y="${base}" width="900" height="14" fill="#d8cfbd"/>`;
    const el = document.getElementById('shelf2');
    if (el) el.innerHTML = h;
  }

  /* ---------------- 애니메이션 ---------------- */
  function countUp(el, delay) {
    const to = parseFloat(el.dataset.to), dec = parseInt(el.dataset.dec || '0', 10), suf = el.dataset.suffix || '';
    const o = { v: 0 };
    el.textContent = fmt(0, dec) + suf;
    anime({ targets: o, v: to, duration: 1600, delay, easing: 'easeOutExpo',
            update: () => { el.textContent = fmt(o.v, dec) + suf; } });
  }

  const special = {
    cover(s) {
      const lent = s.querySelectorAll('.book.lent');
      lent.forEach(b => b.setAttribute('y', b.dataset.y));
      anime({ targets: lent, y: b => +b.dataset.y - 16, direction: 'alternate', loop: 2,
              delay: anime.stagger(25, { start: 1700 }), duration: 450, easing: 'easeInOutSine' });
    },
    cover2(s) {
      const books = s.querySelectorAll('.book2');
      anime({ targets: books, translateX: b => [+b.dataset.dx, 0], delay: anime.stagger(12, { start: 600 }), duration: 1400, easing: 'easeInOutCubic' });
    },
    waffle(s) {
      const cells = s.querySelectorAll('.cell');
      anime.set(cells, { scale: 0, backgroundColor: C.blue });
      anime({ targets: cells, scale: [0, 1], delay: anime.stagger(18, { grid: [10, 10], from: 'first' }), duration: 500, easing: 'easeOutBack' });
      anime({ targets: s.querySelectorAll('.cell.zero'), backgroundColor: [C.blue, C.orange], delay: anime.stagger(22, { start: 1500 }), duration: 400, easing: 'easeOutQuad' });
    },
    pipeline(s) {
      anime({ targets: s.querySelectorAll('.node'), scale: [1, 1.12, 1], delay: anime.stagger(260, { start: 2200 }), duration: 600, easing: 'easeInOutSine' });
    },
  };

  function play(slide) {
    const all = slide.querySelectorAll('*');
    anime.remove(all);
    const rise = slide.querySelectorAll('.rise');
    anime.set(rise, { opacity: 0, translateY: 26 });
    anime({ targets: rise, opacity: 1, translateY: 0, delay: anime.stagger(85, { start: 80 }), duration: 750, easing: 'easeOutCubic' });

    const gx = slide.querySelectorAll('.grow-x'), gy = slide.querySelectorAll('.grow-y'), pop = slide.querySelectorAll('.pop');
    const pil = slide.querySelectorAll('.grow-y-el'), draw = slide.querySelectorAll('.draw'), late = slide.querySelectorAll('.fade-late');
    anime.set(gx, { scaleX: 0 }); anime.set(gy, { scaleY: 0 }); anime.set(pil, { scaleY: 0, opacity: 0 });
    anime.set(pop, { scale: 0, opacity: 0 }); anime.set(late, { opacity: 0 });
    const n = Math.max(gx.length, gy.length, 1);
    const step = Math.min(70, 1100 / n);
    anime({ targets: gx, scaleX: 1, delay: anime.stagger(step, { start: 450 }), duration: 900, easing: 'easeOutQuart' });
    anime({ targets: gy, scaleY: 1, delay: anime.stagger(slide.dataset.anim === 'cover' ? 12 : step, { start: 450 }), duration: 900, easing: 'easeOutQuart' });
    anime({ targets: pil, scaleY: 1, opacity: 1, delay: anime.stagger(140, { start: 400 }), duration: 800, easing: 'easeOutQuart' });
    anime({ targets: pop, scale: 1, opacity: 1, delay: anime.stagger(90, { start: 500 }), duration: 650, easing: 'easeOutBack' });
    draw.forEach((p, i) => {
      const len = p.getTotalLength ? p.getTotalLength() : 0;
      p.style.strokeDasharray = len;
      anime({ targets: p, strokeDashoffset: [len, 0], duration: p.classList.contains('flow') ? 2200 : 1200, delay: 300 + i * 120, easing: 'easeInOutQuart' });
    });
    anime({ targets: late, opacity: 1, delay: anime.stagger(25, { start: 1300 }), duration: 500, easing: 'linear' });
    slide.querySelectorAll('.count').forEach((el, i) => countUp(el, 350 + i * 120));
    slide.querySelectorAll('video.manim').forEach(v => {
      if (v.closest('.media').classList.contains('no-video')) return;
      try { v.currentTime = 0; } catch (e) { /* 아직 로드 전 */ }
      v.play().catch(() => {});
    });
    if (special[slide.dataset.anim]) special[slide.dataset.anim](slide);
  }

  /* ---------------- 내비게이션 ---------------- */
  const slides = [...document.querySelectorAll('.slide')];
  const stage = document.getElementById('stage');
  let cur = -1;
  slides.forEach((s, i) => { if (i) s.dataset.no = String(i + 1).padStart(2, '0'); });

  function fit() {
    const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  function go(i) {
    i = Math.max(0, Math.min(slides.length - 1, i));
    if (i === cur) return;
    if (cur >= 0) {
      slides[cur].classList.remove('active');
      slides[cur].querySelectorAll('video').forEach(v => v.pause());
    }
    cur = i;
    slides[i].classList.add('active');
    document.getElementById('counter').textContent = `${i + 1} / ${slides.length}`;
    document.getElementById('progress').style.width = `${(i + 1) / slides.length * 100}%`;
    history.replaceState(null, '', `#${i + 1}`);
    play(slides[i]);
  }

  document.addEventListener('keydown', e => {
    if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) { e.preventDefault(); go(cur + 1); }
    if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) { e.preventDefault(); go(cur - 1); }
    if (e.key === 'Home') go(0);
    if (e.key === 'End') go(slides.length - 1);
    if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  });
  document.getElementById('next').onclick = () => go(cur + 1);
  document.getElementById('prev').onclick = () => go(cur - 1);
  let tx = null;
  document.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
    tx = null;
  });
  window.addEventListener('resize', fit);

  // 영상이 없거나 재생 불가하면 SVG 애니메이션으로 대체
  document.querySelectorAll('video.manim').forEach(v => {
    const fail = () => v.closest('.media').classList.add('no-video');
    if (v.error) fail();
    v.addEventListener('error', fail);
  });

  buildShelf(); buildWaffle(); buildMissing(); buildBands(); buildDiverge(); buildFresh(); buildCopies();
  buildKeywords(); buildGantt(); buildQuad(); buildPipe(); buildLorenzFallback(); buildScatterFallback(); buildShelf2();
  fit();
  const start = parseInt((location.hash || '#1').slice(1), 10) - 1;
  go(isNaN(start) ? 0 : start);
  window.deck = { go, get index() { return cur; }, count: slides.length };
})();
