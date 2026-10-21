// 화면(UI). 엔진 상태를 그리고 버튼 입력을 엔진에 전달합니다.
(function () {
  const D = window.GameData;
  const E = window.Engine;
  const GAME_TITLE = "발롱 드림"; // 게임 이름은 여기서 바꾸면 됩니다
  const SAVE_KEY = "balloon-dream.career";
  const HOF_KEY = "balloon-dream.hof";
  const app = document.getElementById("app");

  let career = load();
  const ui = {
    screen: career ? "career" : "home",
    tab: "match",
    training: "balanced",
    tactic: "balanced",
    create: null,
    expandedMatch: 0,
  };

  // ---------- 저장 ----------
  function load() {
    try {
      const t = localStorage.getItem(SAVE_KEY);
      return t ? E.deserialize(t) : null;
    } catch (e) { return null; }
  }
  function save() {
    try { if (career) localStorage.setItem(SAVE_KEY, E.serialize(career)); else localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }
  function loadHof() {
    try { return JSON.parse(localStorage.getItem(HOF_KEY) || "[]"); } catch (e) { return []; }
  }
  function saveHof(list) { try { localStorage.setItem(HOF_KEY, JSON.stringify(list)); } catch (e) {} }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const posLabel = (id) => D.POSITIONS.find((p) => p.id === id).label;
  const nation = (id) => D.nationMap[id];
  function ratingClass(r) { return r >= 8 ? "top" : r >= 7 ? "hi" : r > 0 && r < 6 ? "lo" : ""; }
  function meterClass(v) { return v < 35 ? "bad" : v < 60 ? "warn" : ""; }

  // ---------- 홈 ----------
  function renderHome() {
    const hof = loadHof();
    return `
      <div class="hero">
        <div class="ball">⚽</div>
        <h1>${GAME_TITLE}</h1>
        <p class="muted">벤치에서 시작해 발롱도르까지.<br/>17살 유스 선수를 세계 최고의 선수로 키워 보세요.</p>
      </div>
      <div class="stack">
        ${career ? `<button class="btn-primary btn-block" data-a="continue">이어하기 · ${esc(career.player.name)} (${career.player.age}세)</button>` : ""}
        <button class="${career ? "" : "btn-primary"} btn-block" data-a="new">새 커리어 시작</button>
        <button class="btn-block" data-a="hof">명예의 전당 ${hof.length ? `(${hof.length})` : ""}</button>
        <button class="btn-block" data-a="guide">게임 가이드</button>
        <button class="btn-block btn-ghost" data-a="import">저장 파일 가져오기</button>
      </div>`;
  }

  // ---------- 선수 생성 ----------
  function newCreate() {
    return {
      name: "", number: 10, foot: "오른발", nationality: "kr", country: "kr",
      clubId: null, position: "ST", seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0,
      candidate: 0, focus: [],
    };
  }
  function renderCreate() {
    const c = ui.create;
    const clubs = D.clubs.filter((x) => x.country === c.country).sort((a, b) => b.strength - a.strength);
    if (!c.clubId || !clubs.some((x) => x.id === c.clubId)) c.clubId = clubs[0].id;
    const cands = E.candidates(c.position, c.seed);
    const cand = cands[c.candidate];
    const vis = D.visibleAttributes(c.position);
    c.focus = c.focus.filter((k) => vis.includes(k));
    return `
      <div class="row between"><button class="btn-sm btn-ghost" data-a="home">← 처음으로</button><span class="muted small">선수 만들기</span></div>
      <div class="stack" style="margin-top:12px">
        <div class="card stack">
          <h3>1. 기본 정보</h3>
          <label class="field"><span>이름 (닉네임 권장)</span><input id="f-name" maxlength="16" value="${esc(c.name)}" placeholder="예: 킥몬스터" /></label>
          <div class="grid2">
            <label class="field"><span>등번호</span><input id="f-number" type="number" min="1" max="99" value="${c.number}" /></label>
            <label class="field"><span>주발</span><select id="f-foot">${["오른발", "왼발", "양발"].map((f) => `<option ${f === c.foot ? "selected" : ""}>${f}</option>`).join("")}</select></label>
          </div>
          <label class="field"><span>국적</span><select id="f-nat">${D.NATIONS.map((n) => `<option value="${n.id}" ${n.id === c.nationality ? "selected" : ""}>${n.flag} ${n.name}</option>`).join("")}</select></label>
        </div>
        <div class="card stack">
          <h3>2. 시작 클럽 (U18)</h3>
          <label class="field"><span>시작 국가</span><select id="f-country">${D.START_COUNTRIES.map((id) => `<option value="${id}" ${id === c.country ? "selected" : ""}>${nation(id).flag} ${nation(id).name}</option>`).join("")}</select></label>
          <label class="field"><span>유스 클럽</span><select id="f-club">${clubs.map((x) => `<option value="${x.id}" ${x.id === c.clubId ? "selected" : ""}>${esc(x.name)} · ${D.leagueMap[x.league].name} (전력 ${x.strength})</option>`).join("")}</select></label>
          <p class="tiny muted">강팀 유스는 1군 데뷔가 어렵고, 약팀 유스는 기회가 빨리 와요.</p>
        </div>
        <div class="card stack">
          <h3>3. 포지션</h3>
          <div class="grid5">${D.POSITIONS.map((p) => `<button class="pos-btn ${p.id === c.position ? "on" : ""}" data-a="pos" data-v="${p.id}">${p.id}</button>`).join("")}</div>
          <p class="small muted">${posLabel(c.position)}</p>
        </div>
        <div class="card stack">
          <div class="row between"><h3>4. 선수 후보</h3><button class="btn-sm" data-a="reroll">🎲 다른 후보</button></div>
          <p class="tiny muted">모든 후보는 오버롤 45, 능력치 합계 240이에요. 잠재력은 숨겨져 있어요.</p>
          ${cands.map((k, i) => `
            <div class="card cand ${i === c.candidate ? "on" : ""}" data-a="cand" data-v="${i}">
              <div class="row between"><b>${esc(k.styleName)}</b><span class="badge">OVR ${E.overall({ position: c.position, attributes: k.attributes })}</span></div>
              ${vis.map((a) => attrRow(a, k.attributes[a])).join("")}
            </div>`).join("")}
        </div>
        <div class="card stack">
          <h3>5. 집중 육성 (1~2개)</h3>
          <div class="chips">${vis.map((a) => `<button class="chip ${c.focus.includes(a) ? "on" : ""}" data-a="focus" data-v="${a}">${D.ATTR_LABELS[a]}</button>`).join("")}</div>
          <p class="tiny muted">시즌이 끝날 때 이 능력치가 더 많이 성장해요.</p>
        </div>
        <button class="btn-primary btn-block" data-a="start" ${cand && c.focus.length ? "" : "disabled"}>커리어 시작</button>
      </div>`;
  }
  function attrRow(a, v, delta) {
    const val = Math.floor(v);
    return `<div class="attr"><span class="small">${D.ATTR_LABELS[a]}</span><div class="meter ${val < 40 ? "warn" : ""}"><i style="width:${val}%"></i></div><span class="v">${val}${delta ? `<span class="delta ${delta < 0 ? "neg" : ""}">${delta > 0 ? "+" : ""}${delta}</span>` : ""}</span></div>`;
  }
  function readCreateInputs() {
    const c = ui.create;
    const g = (id) => document.getElementById(id);
    if (!g("f-name")) return;
    c.name = g("f-name").value;
    c.number = Number(g("f-number").value) || 10;
    c.foot = g("f-foot").value;
    c.nationality = g("f-nat").value;
    const newCountry = g("f-country").value;
    if (newCountry !== c.country) { c.country = newCountry; c.clubId = null; } else c.clubId = g("f-club").value;
  }

  // ---------- 커리어 ----------
  function renderCareer() {
    const s = career;
    const p = s.player;
    const ovr = E.overall(p);
    const club = D.clubMap[s.clubId];
    const fame = E.fame(s);
    const parts = [];
    parts.push(`
      <div class="row between"><button class="btn-sm btn-ghost" data-a="home">☰ 메뉴</button><span class="muted small">${s.year}/${String((s.year + 1) % 100).padStart(2, "0")} 시즌</span></div>
      <div class="card" style="margin-top:10px">
        <div class="pcard">
          <div class="ovr"><b>${ovr}</b><span>OVR</span></div>
          <div class="grow">
            <div class="row between"><h2 style="margin:0">${esc(p.name)} <span class="muted small">#${p.number}</span></h2>${p.captain ? '<span class="badge">ⓒ 주장</span>' : ""}</div>
            <div class="small muted">${nation(p.nationality).flag} ${p.age}세 · ${posLabel(p.position)} · ${p.foot}</div>
            <div class="small">${esc(club.name)}${s.youth ? " U18" : ""} <span class="muted">· ${E.leagueName(s)}</span></div>
          </div>
        </div>
        <div class="grid2" style="margin-top:10px">
          <div><div class="tiny muted row between"><span>사기</span><span>${Math.round(p.morale)}</span></div><div class="meter ${meterClass(p.morale)}"><i style="width:${p.morale}%"></i></div></div>
          <div><div class="tiny muted row between"><span>체력</span><span>${Math.round(p.energy)}</span></div><div class="meter ${meterClass(p.energy)}"><i style="width:${p.energy}%"></i></div></div>
        </div>
        <div class="row wrap tiny muted" style="margin-top:8px; gap:10px">
          <span>⭐ ${E.fameLabel(fame)}</span>
          <span>🔭 ${E.potentialHint(p)}</span>
          ${s.youth ? "" : `<span>📝 계약 ${s.contractYears}년 · 연봉 ${E.money(p.wage)}</span>`}
          ${p.injury > 0 ? `<span class="red">🩹 부상 ${p.injury}경기</span>` : ""}
          ${p.suspension > 0 ? `<span class="red">🟥 출장 정지 ${p.suspension}경기</span>` : ""}
        </div>
      </div>`);

    if (s.phase === "season") parts.push(renderControls());
    if (s.phase === "summary") parts.push(renderSummary());
    if (s.phase === "retired") parts.push(renderRetired());

    const tabs = [["match", "경기"], ["table", "순위"], ["attrs", "능력치"], ["career", "커리어"], ["news", "뉴스"]];
    parts.push(`<div class="tabs" style="margin-top:14px">${tabs.map(([id, l]) => `<button class="tab ${ui.tab === id ? "on" : ""}" data-a="tab" data-v="${id}">${l}</button>`).join("")}</div>`);
    parts.push(`<div style="margin-top:12px">${{ match: renderMatches, table: renderTable, attrs: renderAttrs, career: renderCareerTab, news: renderNews }[ui.tab]()}</div>`);
    if (s.pendingEvent) parts.push(renderEvent());
    return parts.join("");
  }

  function renderControls() {
    const s = career;
    const season = s.season;
    const done = season.day;
    const total = season.days.length;
    const p = s.player;
    const trainKeys = Object.keys(E.TRAININGS).filter((k) => (p.position === "GK" ? !["attack", "defense"].includes(k) : k !== "goalkeeping"));
    const next = season.days[season.day];
    let nextText = "";
    if (next) {
      if (next.type === "league") {
        const fx = season.schedule[next.round].find((f) => f.home === E.myTeamId(s) || f.away === E.myTeamId(s));
        if (fx) {
          const home = fx.home === E.myTeamId(s);
          const opp = home ? fx.away : fx.home;
          nextText = `${E.leagueName(s)} ${next.round + 1}R · ${home ? "홈" : "원정"} vs ${esc(E.teamName(s, opp))} (전력 ${E.teamStrength(s, opp)})`;
        }
      } else {
        const cup = season.cups[next.cup];
        nextText = cup.alive && !cup.winner ? `${cup.name} · 다음 라운드` : `${cup.name} (탈락 · 휴식 주간)`;
      }
    }
    return `
      <div class="card controls" style="margin-top:12px">
        <div class="row between small"><span>진행 ${done}/${total}</span><span class="muted">팀 전력 ${E.teamStrength(s, E.myTeamId(s))}</span></div>
        <div class="meter" style="margin-top:6px"><i style="width:${(done / total) * 100}%"></i></div>
        <p class="small" style="margin-top:8px">다음: ${nextText}</p>
        <div class="label">훈련</div>
        <div class="chips">${trainKeys.map((k) => `<button class="chip ${ui.training === k ? "on" : ""}" data-a="train" data-v="${k}">${E.TRAININGS[k].label}</button>`).join("")}</div>
        <div class="label">경기 성향</div>
        <div class="chips">${Object.entries(E.TACTICS).map(([k, l]) => `<button class="chip ${ui.tactic === k ? "on" : ""}" data-a="tactic" data-v="${k}">${l}</button>`).join("")}</div>
        <div class="grid3" style="margin-top:12px">
          <button class="btn-primary" data-a="adv" data-v="1">다음 경기</button>
          <button data-a="adv" data-v="5">5경기</button>
          <button data-a="adv" data-v="999">시즌 끝</button>
        </div>
      </div>`;
  }

  function renderEvent() {
    const e = career.pendingEvent;
    return `<div class="modal-bg"><div class="modal stack">
      <span class="badge">이벤트</span>
      <h2>${esc(e.title)}</h2>
      <p>${esc(e.text)}</p>
      ${e.options.map((o, i) => `<button class="btn-block ${i === 0 ? "btn-primary" : ""}" data-a="event" data-v="${i}">${esc(o)}</button>`).join("")}
    </div></div>`;
  }

  function renderSummary() {
    const s = career;
    const sm = s.summary;
    const st = sm.stats;
    const avg = st.apps ? (st.ratingSum / st.apps).toFixed(2) : "-";
    const isGK = s.player.position === "GK";
    const ballon = sm.ballon;
    const growthKeys = Object.keys(sm.growth);
    return `
      <div class="stack" style="margin-top:12px">
        ${ballon && ballon.rank === 1 ? `<div class="card ballon-win"><div class="big">🏅</div><h2 class="gold">발롱도르 수상!</h2><p>${esc(s.player.name)}, 세계 최고의 선수.</p></div>` : ""}
        <div class="card stack">
          <h2>${sm.year} 시즌 결산</h2>
          <p class="small">${esc(sm.text)}</p>
          <div class="stat-grid">
            <div><b>${st.apps}</b><span>경기</span></div>
            <div><b>${isGK ? st.cleanSheets : st.goals}</b><span>${isGK ? "클린시트" : "골"}</span></div>
            <div><b>${st.assists}</b><span>도움</span></div>
            <div><b>${avg}</b><span>평점</span></div>
          </div>
          ${sm.trophies.length ? `<div>${sm.trophies.map((t) => `<span class="trophy">🏆 ${esc(t)}</span>`).join("")}</div>` : ""}
          ${sm.awards.filter((a) => a.name !== "발롱도르").length ? `<div>${sm.awards.filter((a) => a.name !== "발롱도르").map((a) => `<span class="trophy">🎖️ ${esc(a.name)}</span>`).join("")}</div>` : ""}
          ${ballon && ballon.rank > 1 ? `<p class="gold small">발롱도르 순위 ${ballon.rank}위</p>` : ""}
          ${sm.national && sm.national.called ? `<p class="small">${nation(s.player.nationality).flag} 국가대표 A매치 ${sm.national.caps}경기 ${sm.national.goals}골${sm.national.tournament ? ` · ${esc(sm.national.tournament.name)} ${esc(sm.national.tournament.result)}` : ""}</p>` : ""}
          <div class="card" style="background:var(--bg2)">
            <div class="row between"><b>성장 리뷰</b><span>OVR ${sm.ovrBefore} → <b class="${sm.ovrAfter >= sm.ovrBefore ? "green" : "red"}">${sm.ovrAfter}</b></span></div>
            ${growthKeys.length ? `<div class="chips" style="margin-top:8px">${growthKeys.map((k) => `<span class="chip">${D.ATTR_LABELS[k]} <span class="${sm.growth[k] > 0 ? "green" : "red"}">${sm.growth[k] > 0 ? "+" : ""}${sm.growth[k]}</span></span>`).join("")}</div>` : `<p class="small muted" style="margin-top:6px">눈에 띄는 변화가 없었어요.</p>`}
          </div>
        </div>
        ${sm.forcedRetire ? `<div class="card"><p>40세. 마지막 휘슬이 울렸습니다.</p><button class="btn-gold btn-block" data-a="retire">은퇴하기</button></div>` : renderOffers()}
      </div>`;
  }

  function renderOffers() {
    const s = career;
    const ovr = E.overall(s.player);
    return `
      <div class="card stack">
        <h2>${s.youth ? "첫 프로 계약" : "다음 시즌 선택"}</h2>
        <p class="small muted">${s.youth ? "유스 시즌이 끝났어요. 성인 무대에서 출전 기회를 얻는 것이 성장의 핵심이에요." : "출전 시간이 성장을 좌우해요. 무리한 빅클럽 이적은 벤치를 부를 수 있어요."}</p>
        ${s.offers.map((o, i) => {
          const club = D.clubMap[o.clubId];
          const tag = o.kind === "stay" ? "잔류 (계약 중)" : o.kind === "renew" ? "재계약" : o.kind === "first" ? "프로 계약" : "이적 제안";
          return `<button class="offer card" data-a="offer" data-v="${i}">
            <div class="row between"><b>${esc(club.name)}</b><span class="badge">${tag}</span></div>
            <div class="small muted">${esc(o.league)} · 팀 전력 ${club.strength} (나 ${ovr})</div>
            <div class="small" style="margin-top:4px">${o.roleLabel} · ${o.years}년 · 연봉 ${E.money(o.wage)}</div>
          </button>`;
        }).join("")}
        ${s.player.age >= 30 ? `<button class="btn-danger btn-block" data-a="retire">은퇴하기</button>` : ""}
      </div>`;
  }

  function renderRetired() {
    const s = career;
    const rec = E.careerRecord(s);
    const hof = loadHof();
    const rank = hof.findIndex((r) => r.id === s.id) + 1;
    return `
      <div class="card stack" style="margin-top:12px">
        <h2>은퇴</h2>
        <p>${esc(s.player.name)}, ${s.player.age}세에 그라운드를 떠났습니다.</p>
        <div class="stat-grid">
          <div><b>${rec.ballon}</b><span>발롱도르</span></div>
          <div><b>${rec.bestOverall}</b><span>최고 OVR</span></div>
          <div><b>${rec.awards}</b><span>개인상</span></div>
          <div><b>${rec.goals + rec.assists}</b><span>공격P</span></div>
        </div>
        ${rank ? `<p class="gold">명예의 전당 ${rank}위</p>` : ""}
        <button class="btn-primary btn-block" data-a="new">새 커리어 시작</button>
        <button class="btn-block" data-a="hof">명예의 전당 보기</button>
      </div>`;
  }

  function renderMatches() {
    const ms = career.season.matches;
    if (!ms.length) return `<p class="muted small">아직 치른 경기가 없어요.</p>`;
    const me = E.myTeamId(career);
    const line = (m, i) => {
      const home = m.home === me;
      const gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg;
      const res = gf > ga ? "W" : gf < ga ? "L" : "D";
      const opp = E.teamName(career, home ? m.away : m.home);
      return `<div class="mline" data-a="expand" data-v="${i}">
        <div><span class="badge">${esc(m.competition)}</span><br/>${home ? "vs" : "@"} ${esc(opp)}</div>
        <div class="res-${res}">${res} ${gf}-${ga}</div>
        <div style="text-align:right">${m.minutes ? `<span class="rating ${ratingClass(m.rating)}">${m.rating.toFixed(1)}</span><div class="tiny muted">${m.minutes}' ${m.goals ? `⚽${m.goals}` : ""}${m.assists ? ` 🅰️${m.assists}` : ""}</div>` : `<span class="tiny muted">${esc(m.note || "미출전")}</span>`}</div>
      </div>${ui.expandedMatch === i ? `<ul class="events">${m.events.map((e) => `<li><span class="min">${e.m ? e.m + "'" : ""}</span>${e.k === "goal" ? "⚽ " : e.k === "assist" ? "🅰️ " : e.k === "card" ? "🟨 " : ""}${esc(e.t)}</li>`).join("")}</ul>` : ""}`;
    };
    const last = ms[0];
    const lh = last.home === me;
    return `
      <div class="card">
        <div class="tiny muted" style="text-align:center">${esc(last.competition)}</div>
        <div class="match" style="margin-top:6px">
          <div class="small ${lh ? "green" : ""}">${esc(E.teamName(career, last.home))}</div>
          <div class="score">${last.hg} - ${last.ag}</div>
          <div class="small ${!lh ? "green" : ""}">${esc(E.teamName(career, last.away))}</div>
        </div>
        <div style="text-align:center;margin-top:6px">${last.minutes ? `<span class="rating ${ratingClass(last.rating)}">평점 ${last.rating.toFixed(1)}</span> <span class="small muted">${last.minutes}분</span>` : `<span class="small muted">${esc(last.note || "미출전")}</span>`}</div>
      </div>
      <div class="card" style="margin-top:10px">${ms.slice(0, 30).map(line).join("")}</div>`;
  }

  function renderTable() {
    const s = career;
    const rows = E.sortTable(s.season.table);
    const me = E.myTeamId(s);
    const cups = s.season.cups;
    return `
      <div class="card scroll-x">
        <h3>${E.leagueName(s)}</h3>
        <table>
          <tr><th>#</th><th class="l">팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>
          ${rows.map((r, i) => `<tr class="${r.id === me ? "me" : ""}"><td>${i + 1}</td><td class="l">${esc(E.teamName(s, r.id))}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join("")}
        </table>
      </div>
      ${cups.length ? `<div class="card" style="margin-top:10px">${cups.map((c) => `<div class="row between small" style="padding:4px 0"><span>${esc(c.name)}</span><span class="${c.winner === s.clubId ? "gold" : c.alive ? "green" : "muted"}">${c.winner ? (c.winner === s.clubId ? "🏆 우승" : `우승: ${esc(E.teamName(s, c.winner))}`) : c.alive ? `진행 중 · ${c.teams.length}팀 남음` : `${c.exitStage} 탈락`}</span></div>`).join("")}</div>` : ""}`;
  }

  function renderAttrs() {
    const s = career;
    const p = s.player;
    const vis = D.visibleAttributes(p.position);
    const start = s.season.startAttributes;
    return `
      <div class="card">
        <div class="row between"><h3>능력치</h3><span class="badge">${esc(D.STYLES[p.styleId].name)}</span></div>
        ${vis.map((a) => attrRow(a, p.attributes[a], Math.floor(p.attributes[a]) - Math.floor(start[a]))).join("")}
        <p class="tiny muted" style="margin-top:8px">집중 육성: ${p.focus.map((k) => D.ATTR_LABELS[k]).join(", ")} · 숫자 옆 초록색은 이번 시즌 성장치예요.</p>
      </div>
      <div class="card small" style="margin-top:10px">
        <p>🔭 스카우트 평가: <b>${E.potentialHint(p)}</b></p>
        <p>📈 성장 특성: <b>${p.age >= 24 ? D.GROWTH_CURVES[p.curve].name : "아직 알 수 없음 (24세에 공개)"}</b></p>
        <p class="muted tiny">성장에는 나이, 출전 시간, 경기 활약, 부상 여부가 영향을 줘요. 잠재력에 가까워질수록 성장이 느려져요.</p>
      </div>`;
  }

  function renderCareerTab() {
    const s = career;
    const t = E.careerTotals(s);
    const ballon = s.awards.filter((a) => a.name === "발롱도르").length;
    const hist = [...s.history].reverse();
    return `
      <div class="card">
        <h3>통산 기록 (성인)</h3>
        <div class="stat-grid">
          <div><b>${t.apps}</b><span>경기</span></div>
          <div><b>${t.goals}</b><span>골</span></div>
          <div><b>${t.assists}</b><span>도움</span></div>
          <div><b>${ballon}</b><span>발롱도르</span></div>
        </div>
        <p class="small" style="margin-top:8px">${nation(s.player.nationality).flag} A매치 ${s.international.caps}경기 ${s.international.goals}골 · 최고 OVR ${s.bestOverall}</p>
      </div>
      <div class="card" style="margin-top:10px">
        <h3>트로피 (${s.trophies.length})</h3>
        ${s.trophies.length ? s.trophies.map((x) => `<div class="small">🏆 ${x.year} ${esc(x.name)}</div>`).join("") : `<p class="small muted">아직 없어요.</p>`}
        <h3 style="margin-top:10px">개인상 (${s.awards.length})</h3>
        ${s.awards.length ? s.awards.map((x) => `<div class="small">${x.name === "발롱도르" ? "🏅" : "🎖️"} ${x.year} ${esc(x.name)}</div>`).join("") : `<p class="small muted">아직 없어요.</p>`}
      </div>
      <div class="card scroll-x" style="margin-top:10px">
        <h3>시즌별 기록</h3>
        <table>
          <tr><th>시즌</th><th class="l">팀</th><th>OVR</th><th>경기</th><th>골</th><th>도움</th><th>평점</th></tr>
          ${hist.map((h) => `<tr><td>${h.year}</td><td class="l">${esc(D.clubMap[h.club].name)}${h.youth ? " U18" : ""}<div class="tiny muted">${esc(h.league)}${h.rank ? ` ${h.rank}위` : ""}</div></td><td>${h.overall}</td><td>${h.stats.apps}</td><td>${h.stats.goals}</td><td>${h.stats.assists}</td><td>${h.stats.apps ? (h.stats.ratingSum / h.stats.apps).toFixed(2) : "-"}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">첫 시즌 진행 중</td></tr>`}
        </table>
      </div>`;
  }

  function renderNews() {
    return `<div class="card"><ul class="news">${career.news.slice(0, 60).map((n) => `<li class="small"><span class="muted tiny">${n.year}</span> ${esc(n.text)}</li>`).join("")}</ul></div>`;
  }

  // ---------- 명예의 전당 ----------
  function renderHof() {
    const list = loadHof().sort(E.compareRecords);
    return `
      <div class="row between"><button class="btn-sm btn-ghost" data-a="home">← 처음으로</button><span class="muted small">명예의 전당</span></div>
      <div class="card" style="margin-top:12px">
        <p class="tiny muted">은퇴한 선수 기록이에요. 순위는 발롱도르 → 최고 오버롤 → 개인상 → 공격포인트 순으로 비교해요. 이 기기에만 저장돼요.</p>
        ${list.length ? `<div class="scroll-x"><table>
          <tr><th>#</th><th class="l">선수</th><th>🏅</th><th>OVR</th><th>상</th><th>공P</th></tr>
          ${list.map((r, i) => `<tr><td>${i + 1}</td><td class="l">${nation(r.nationality).flag} ${esc(r.name)}<div class="tiny muted">${r.position} · ${esc(r.lastClub)} · ${r.date}</div></td><td>${r.ballon}</td><td>${r.bestOverall}</td><td>${r.awards}</td><td>${r.goals + r.assists}</td></tr>`).join("")}
        </table></div>` : `<p class="muted">아직 은퇴한 선수가 없어요.</p>`}
      </div>`;
  }

  function renderGuide() {
    return `
      <div class="row between"><button class="btn-sm btn-ghost" data-a="home">← 처음으로</button><span class="muted small">게임 가이드</span></div>
      <div class="card stack" style="margin-top:12px">
        <div><h3>1. 선수 만들기</h3><p class="small">이름, 국적, 시작 국가와 유스 클럽, 포지션을 고른 뒤 후보 3명 중 한 명을 선택해요. 모든 후보는 오버롤 45, 능력치 합계 240에서 시작해요.</p></div>
        <div><h3>2. 시즌 진행</h3><p class="small">매 경기 전에 훈련과 경기 성향을 고르고 경기를 치러요. 17세 시즌은 U18 유스 리그에서 뛰고, 시즌이 끝나면 첫 프로 계약을 선택해요.</p></div>
        <div><h3>3. 오버롤</h3><p class="small">오버롤은 포지션별 능력치 가중평균이에요. 팀 전력보다 오버롤이 높을수록 선발 출전 확률이 올라가요.</p></div>
        <div><h3>4. 성장</h3><p class="small">나이, 출전 시간, 활약(평점), 부상, 숨겨진 성장 특성이 성장에 영향을 줘요. 잠재력이 성장의 상한선이고, 성인이 된 뒤 출전을 못 하면 잠재력이 깎일 수 있어요.</p></div>
        <div><h3>5. 시즌 종료</h3><p class="small">리그·컵·대륙 대회 우승, 개인상, 국가대표, 발롱도르가 결정돼요. 이후 잔류, 재계약, 이적 중에서 다음 시즌을 골라요.</p></div>
        <div><h3>6. 은퇴와 랭킹</h3><p class="small">30세부터 은퇴할 수 있고 40세에는 반드시 은퇴해요. 은퇴하면 명예의 전당에 등록되고, 발롱도르 → 최고 오버롤 → 개인상 → 공격포인트 순으로 순위를 매겨요.</p></div>
        <div><h3>7. 저장</h3><p class="small">진행 상황은 이 브라우저에 자동 저장돼요. 메뉴의 "저장 파일 내보내기"로 백업할 수 있어요.</p></div>
      </div>`;
  }

  function renderMenu() {
    return `
      <div class="row between"><button class="btn-sm btn-ghost" data-a="continue">← 돌아가기</button><span class="muted small">메뉴</span></div>
      <div class="stack" style="margin-top:12px">
        <button class="btn-block" data-a="continue">게임으로 돌아가기</button>
        <button class="btn-block" data-a="export">저장 파일 내보내기</button>
        <button class="btn-block" data-a="import">저장 파일 가져오기</button>
        <button class="btn-block" data-a="hof">명예의 전당</button>
        <button class="btn-block" data-a="guide">게임 가이드</button>
        ${career && career.phase !== "retired" && career.player.age >= 30 && career.phase === "season" ? `<button class="btn-danger btn-block" data-a="retire">지금 은퇴하기</button>` : ""}
        <button class="btn-danger btn-block" data-a="new">새 커리어 시작 (현재 커리어 삭제)</button>
      </div>`;
  }

  // ---------- 렌더 ----------
  function render() {
    const scr = ui.screen;
    let html;
    if (scr === "create") html = renderCreate();
    else if (scr === "career" && career) html = renderCareer();
    else if (scr === "hof") html = renderHof();
    else if (scr === "guide") html = renderGuide();
    else if (scr === "menu") html = renderMenu();
    else html = renderHome();
    app.innerHTML = html;
  }

  function finishRetire() {
    E.retire(career);
    const hof = loadHof().filter((r) => r.id !== career.id);
    hof.push(E.careerRecord(career));
    saveHof(hof);
  }

  // ---------- 입력 ----------
  app.addEventListener("change", (ev) => {
    if (ui.screen !== "create") return;
    readCreateInputs();
    // 국가를 바꾸면 클럽 목록이 바뀌므로 다시 그림. 다른 입력은 다시 그리지 않음 (탭이 씹히는 문제 방지)
    if (ev.target.id === "f-country") render();
  });
  app.addEventListener("input", (ev) => {
    if (ui.screen === "create" && ev.target.id === "f-name") ui.create.name = ev.target.value;
  });

  app.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-a]");
    if (!el || el.disabled) return;
    const a = el.dataset.a;
    const v = el.dataset.v;
    if (ui.screen === "create") readCreateInputs();
    switch (a) {
      case "home":
        ui.screen = career && ui.screen === "career" ? "menu" : "home";
        if (!career) ui.screen = "home";
        break;
      case "continue": ui.screen = career ? "career" : "home"; break;
      case "new":
        if (career && career.phase !== "retired" && !confirm("현재 커리어가 삭제돼요. 새로 시작할까요?")) return;
        ui.create = newCreate();
        ui.screen = "create";
        break;
      case "hof": ui.screen = "hof"; break;
      case "guide": ui.screen = "guide"; break;
      case "pos": ui.create.position = v; ui.create.candidate = 0; ui.create.focus = []; break;
      case "reroll": ui.create.seed = (ui.create.seed * 1103515245 + 12345) >>> 0; ui.create.candidate = 0; break;
      case "cand": ui.create.candidate = Number(v); break;
      case "focus": {
        const f = ui.create.focus;
        if (f.includes(v)) ui.create.focus = f.filter((x) => x !== v);
        else ui.create.focus = [...f, v].slice(-2);
        break;
      }
      case "start": {
        const c = ui.create;
        try {
          const cand = E.candidates(c.position, c.seed)[c.candidate];
          career = E.createCareer({ ...c, candidate: cand, seed: c.seed ^ 0x5bd1e995 });
          ui.screen = "career"; ui.tab = "match"; ui.training = "balanced"; ui.tactic = "balanced";
          save();
        } catch (e) { toast(e.message); return; }
        break;
      }
      case "tab": ui.tab = v; break;
      case "train": ui.training = v; break;
      case "tactic": ui.tactic = v; break;
      case "adv": {
        const n = Number(v);
        for (let i = 0; i < n; i++) {
          if (career.phase !== "season" || career.pendingEvent) break;
          E.advance(career, ui.training, ui.tactic);
        }
        ui.expandedMatch = 0;
        if (career.phase === "summary") window.scrollTo({ top: 0, behavior: "smooth" });
        save();
        break;
      }
      case "event": {
        const msg = E.resolveEvent(career, Number(v));
        save();
        if (msg) toast(msg);
        break;
      }
      case "expand": ui.expandedMatch = ui.expandedMatch === Number(v) ? -1 : Number(v); break;
      case "offer": {
        const o = career.offers[Number(v)];
        const name = D.clubMap[o.clubId].name;
        if (!confirm(`${name}${o.kind === "stay" ? " 잔류" : " 계약"}을 선택할까요?`)) return;
        E.acceptOffer(career, Number(v));
        ui.tab = "match";
        save();
        window.scrollTo({ top: 0 });
        break;
      }
      case "retire":
        if (!confirm("정말 은퇴할까요? 되돌릴 수 없어요.")) return;
        finishRetire();
        ui.screen = "career";
        save();
        break;
      case "export": {
        if (!career) return;
        const blob = new Blob([E.serialize(career)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${career.player.name}-${career.year}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
      case "import": document.getElementById("importFile").click(); return;
    }
    render();
  });

  document.getElementById("importFile").addEventListener("change", async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      career = E.deserialize(await f.text());
      save();
      ui.screen = "career";
      render();
      toast("저장 파일을 불러왔어요.");
    } catch (e) { toast(e.message); }
    ev.target.value = "";
  });

  render();
})();
