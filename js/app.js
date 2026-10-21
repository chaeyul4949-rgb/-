// 화면(UI). 엔진 상태를 그리고 버튼 입력을 엔진에 전달합니다.
(function () {
  const D = window.GameData;
  const E = window.Engine;
  const GAME_TITLE = "발롱드림"; // 게임 이름은 여기서 바꾸면 됩니다
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
    expanded: -1,
    modal: null, // { type: "confirm" | "save" | "import", ... }
  };

  // ---------- 저장 ----------
  function load() {
    try { const t = localStorage.getItem(SAVE_KEY); return t ? E.deserialize(t) : null; } catch (e) { return null; }
  }
  function save() {
    try { if (career) localStorage.setItem(SAVE_KEY, E.serialize(career)); else localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }
  function loadHof() { try { return JSON.parse(localStorage.getItem(HOF_KEY) || "[]"); } catch (e) { return []; } }
  function saveHof(list) { try { localStorage.setItem(HOF_KEY, JSON.stringify(list)); } catch (e) {} }

  function toast(msg) {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const posLabel = (id) => D.POSITIONS.find((p) => p.id === id).label;
  const nation = (id) => D.nationMap[id];
  function rtClass(r) { return r >= 9 ? "r9" : r >= 8 ? "r8" : r >= 7.5 ? "r75" : r >= 7 ? "r7" : "lo"; }
  function barClass(v) { return v < 35 ? "bad" : v < 60 ? "warn" : ""; }
  const brand = () => `${GAME_TITLE}<span class="gg">.gg</span>`;

  // ---------- 상단 바 ----------
  function renderTopbar() {
    const items = [["home", "홈"]];
    if (career) items.push(["career", "내 선수"]);
    items.push(["hof", "명예의 전당"], ["guide", "가이드"], ["menu", "저장"]);
    const cur = ui.screen === "create" ? "home" : ui.screen;
    return `<header class="topbar"><div class="topbar-in">
      <div class="brand-row">
        <button class="brand" data-a="go" data-v="home"><span class="logo">⚽</span><span>${brand()}</span></button>
        ${career ? `<span class="tag blue">${esc(career.player.name)} · OVR ${E.overall(career.player)}</span>` : ""}
      </div>
      <nav class="nav">${items.map(([id, l]) => `<button class="${cur === id ? "on" : ""}" data-a="go" data-v="${id}">${l}</button>`).join("")}</nav>
    </div></header>`;
  }

  // ---------- 홈 ----------
  function renderHome() {
    const hof = loadHof().sort(E.compareRecords).slice(0, 5);
    return `
      <div class="home-hero">
        <div class="biglogo">⚽</div><span class="eyebrow">축구 커리어 시뮬레이션</span>
        <h1>${brand()}</h1>
        <p class="muted">벤치에서 시작해 발롱도르까지.<br />17살 유스 선수를 세계 최고의 선수로 키워 보세요.</p>
      </div>
      <div class="stack">
        ${career ? `<button class="btn btn-primary btn-block" data-a="go" data-v="career">이어하기 · ${esc(career.player.name)} (${career.player.age}세, OVR ${E.overall(career.player)})</button>` : ""}
        <button class="btn ${career ? "" : "btn-primary"} btn-block" data-a="new">새 커리어 시작</button>
      </div>
      <section class="box">
        <div class="box-h"><span>명예의 전당 TOP 5</span><button class="btn btn-sm" data-a="go" data-v="hof">전체 보기</button></div>
        ${hof.length ? hof.map((r, i) => `<div class="list-row"><span><b class="num">${i + 1}</b> ${nation(r.nationality).flag} ${esc(r.name)} <span class="muted tiny">${r.position}</span></span><span class="num">🏅${r.ballon} · OVR ${r.bestOverall}</span></div>`).join("") : `<div class="box-b muted small">은퇴한 선수가 여기에 올라와요.</div>`}
      </section>`;
  }

  // ---------- 선수 생성 ----------
  function newCreate() {
    return { name: "", number: 10, foot: "오른발", nationality: "kr", country: "kr", clubId: null, position: "ST",
      seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, candidate: 0, focus: [] };
  }
  function attrRow(a, v, delta) {
    const val = Math.floor(v);
    return `<div class="attr"><span class="small">${D.ATTR_LABELS[a]}</span><div class="bar ${val < 40 ? "warn" : ""}"><i style="width:${val}%"></i></div><span class="v">${val}${delta ? `<span class="delta ${delta < 0 ? "neg" : ""}">${delta > 0 ? "+" : ""}${delta}</span>` : ""}</span></div>`;
  }
  function renderCreate() {
    const c = ui.create;
    const clubs = D.clubs.filter((x) => x.country === c.country).sort((a, b) => b.strength - a.strength);
    if (!c.clubId || !clubs.some((x) => x.id === c.clubId)) c.clubId = clubs[0].id;
    const cands = E.candidates(c.position, c.seed);
    const vis = D.visibleAttributes(c.position);
    c.focus = c.focus.filter((k) => vis.includes(k));
    return `
      <section class="box"><div class="box-h">기본 정보</div><div class="box-b stack">
        <label class="field"><span>이름 (닉네임 권장)</span><input id="f-name" maxlength="16" value="${esc(c.name)}" placeholder="예: 킥몬스터" /></label>
        <div class="grid2">
          <label class="field"><span>등번호</span><input id="f-number" type="number" min="1" max="99" value="${c.number}" /></label>
          <label class="field"><span>주발</span><select id="f-foot">${["오른발", "왼발", "양발"].map((f) => `<option ${f === c.foot ? "selected" : ""}>${f}</option>`).join("")}</select></label>
        </div>
        <label class="field"><span>국적</span><select id="f-nat">${D.NATIONS.map((n) => `<option value="${n.id}" ${n.id === c.nationality ? "selected" : ""}>${n.flag} ${n.name}</option>`).join("")}</select></label>
      </div></section>
      <section class="box"><div class="box-h">시작 클럽 (U18)</div><div class="box-b stack">
        <label class="field"><span>시작 국가</span><select id="f-country">${D.START_COUNTRIES.map((id) => `<option value="${id}" ${id === c.country ? "selected" : ""}>${nation(id).flag} ${nation(id).name}</option>`).join("")}</select></label>
        <label class="field"><span>유스 클럽</span><select id="f-club">${clubs.map((x) => `<option value="${x.id}" ${x.id === c.clubId ? "selected" : ""}>${esc(x.name)} · ${D.leagueMap[x.league].name} (전력 ${x.strength})</option>`).join("")}</select></label>
        <p class="tiny muted">강팀 유스는 1군 데뷔가 어렵고, 약팀 유스는 기회가 빨리 와요.</p>
      </div></section>
      <section class="box"><div class="box-h"><span>포지션</span><span class="muted small">${posLabel(c.position)}</span></div><div class="box-b">
        <div class="grid5">${D.POSITIONS.map((p) => `<button class="chip pos-btn ${p.id === c.position ? "on" : ""}" data-a="pos" data-v="${p.id}">${p.id}</button>`).join("")}</div>
      </div></section>
      <section class="box"><div class="box-h"><span>선수 후보</span><button class="btn btn-sm" data-a="reroll">다른 후보 보기</button></div><div class="box-b stack">
        <p class="tiny muted">모든 후보는 OVR 45, 능력치 합계 240이에요. 잠재력은 숨겨져 있어요.</p>
        ${cands.map((k, i) => `
          <div class="cand ${i === c.candidate ? "on" : ""}" data-a="cand" data-v="${i}">
            <div class="row between"><b>${esc(k.styleName)}</b><span class="tag ${i === c.candidate ? "blue" : ""}">OVR ${E.overall({ position: c.position, attributes: k.attributes })}</span></div>
            ${vis.map((a) => attrRow(a, k.attributes[a])).join("")}
          </div>`).join("")}
      </div></section>
      <section class="box"><div class="box-h"><span>집중 육성</span><span class="muted small">1~2개 선택</span></div><div class="box-b stack">
        <div class="chips">${vis.map((a) => `<button class="chip ${c.focus.includes(a) ? "on" : ""}" data-a="focus" data-v="${a}">${D.ATTR_LABELS[a]}</button>`).join("")}</div>
        <p class="tiny muted">시즌이 끝날 때 이 능력치가 더 많이 성장해요.</p>
      </div></section>
      <button class="btn btn-primary btn-block" data-a="start" ${c.focus.length ? "" : "disabled"}>${c.focus.length ? "커리어 시작" : "집중 육성 능력치를 골라 주세요"}</button>`;
  }
  function readCreateInputs() {
    const c = ui.create;
    const g = (id) => document.getElementById(id);
    if (!c || !g("f-name")) return;
    c.name = g("f-name").value;
    c.number = Number(g("f-number").value) || 10;
    c.foot = g("f-foot").value;
    c.nationality = g("f-nat").value;
    const newCountry = g("f-country").value;
    if (newCountry !== c.country) { c.country = newCountry; c.clubId = null; } else c.clubId = g("f-club").value;
  }

  // ---------- 커리어 ----------
  function fameTier(v) { return v >= 85 ? 5 : v >= 70 ? 4 : v >= 50 ? 3 : v >= 30 ? 2 : 1; }

  function renderCareer() {
    const s = career;
    const p = s.player;
    const ovr = E.overall(p);
    const club = D.clubMap[s.clubId];
    const fame = E.fame(s);
    const tier = fameTier(fame);
    const ballons = s.awards.filter((a) => a.name === "발롱도르").length;
    const parts = [];
    parts.push(`
      <section class="box">
        <div class="profile">
          <div class="avatar"><small>OVR</small><b>${ovr}</b><span class="lv">${p.age}세</span></div>
          <div class="grow">
            <div class="pname">${esc(p.name)}<span class="no">#${p.number}</span></div>
            <div class="pmeta">${nation(p.nationality).flag} ${posLabel(p.position)} · ${p.foot} · ${esc(D.STYLES[p.styleId].name)}</div>
            <div class="small" style="margin-top:4px"><b>${esc(club.name)}${s.youth ? " U18" : ""}</b> <span class="muted">${esc(E.leagueName(s))}</span></div>
            <div class="row wrapr" style="margin-top:6px; gap:4px">
              ${p.captain ? '<span class="tag blue">주장</span>' : ""}
              ${ballons ? `<span class="tag gold">발롱도르 ${ballons}회</span>` : ""}
              ${s.youth ? '<span class="tag">유스</span>' : `<span class="tag">계약 ${s.contractYears}년</span>`}
              ${p.injury > 0 ? `<span class="tag red">부상 ${p.injury}경기</span>` : ""}
              ${p.suspension > 0 ? `<span class="tag red">출장 정지 ${p.suspension}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="gauges">
          <div><div class="gauge-l"><span>사기</span><span class="num">${Math.round(p.morale)}</span></div><div class="bar ${barClass(p.morale)}"><i style="width:${p.morale}%"></i></div></div>
          <div><div class="gauge-l"><span>체력</span><span class="num">${Math.round(p.energy)}</span></div><div class="bar ${barClass(p.energy)}"><i style="width:${p.energy}%"></i></div></div>
        </div>
      </section>
      <section class="box rankcard">
        <div class="emblem t${tier}"><span class="num">${fame}</span></div>
        <div class="grow">
          <div class="tiny muted">명성</div>
          <div class="rank-tier">${E.fameLabel(fame)}</div>
          <div class="small muted">${E.potentialHint(p)}</div>
        </div>
        <div style="text-align:right">
          <div class="tiny muted">연봉</div>
          <div class="small num"><b>${s.youth ? "-" : E.money(p.wage)}</b></div>
          <div class="tiny muted">${s.year}/${String((s.year + 1) % 100).padStart(2, "0")}</div>
        </div>
      </section>`);

    if (s.phase === "season") parts.push(renderControls());
    if (s.phase === "summary") parts.push(renderSummary());
    if (s.phase === "retired") parts.push(renderRetired());

    const tabs = [["match", "경기 기록"], ["table", "순위"], ["attrs", "능력치"], ["career", "커리어"], ["news", "뉴스"]];
    parts.push(`<div class="tabs">${tabs.map(([id, l]) => `<button class="tab ${ui.tab === id ? "on" : ""}" data-a="tab" data-v="${id}">${l}</button>`).join("")}</div>`);
    parts.push({ match: renderMatches, table: renderTable, attrs: renderAttrs, career: renderCareerTab, news: renderNews }[ui.tab]());
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
        const me = E.myTeamId(s);
        const fx = season.schedule[next.round].find((f) => f.home === me || f.away === me);
        if (fx) {
          const home = fx.home === me;
          const opp = home ? fx.away : fx.home;
          nextText = `<span class="tag">${esc(E.leagueName(s))} ${next.round + 1}R</span> ${home ? "홈" : "원정"} vs <b>${esc(E.teamName(s, opp))}</b> <span class="muted">전력 ${E.teamStrength(s, opp)}</span>`;
        }
      } else {
        const cup = season.cups[next.cup];
        nextText = cup.alive && !cup.winner ? `<span class="tag blue">${esc(cup.name)}</span> 다음 라운드` : `<span class="tag">${esc(cup.name)}</span> <span class="muted">탈락 · 휴식 주간</span>`;
      }
    }
    return `
      <section class="box">
        <div class="box-h"><span>시즌 진행</span><span class="muted small num">${done} / ${total}</span></div>
        <div class="box-b stack">
          <div class="bar"><i style="width:${(done / total) * 100}%"></i></div>
          <div class="next-fx">다음 경기 · ${nextText} <span class="muted tiny">(우리 팀 전력 ${E.teamStrength(s, E.myTeamId(s))})</span></div>
          <div class="ctl-label">훈련</div>
          <div class="chips">${trainKeys.map((k) => `<button class="chip ${ui.training === k ? "on" : ""}" data-a="train" data-v="${k}">${E.TRAININGS[k].label}</button>`).join("")}</div>
          <div class="ctl-label">경기 성향</div>
          <div class="chips">${Object.entries(E.TACTICS).map(([k, l]) => `<button class="chip ${ui.tactic === k ? "on" : ""}" data-a="tactic" data-v="${k}">${l}</button>`).join("")}</div>
          <div class="grid3">
            <button class="btn btn-primary" data-a="adv" data-v="1">다음 경기</button>
            <button class="btn" data-a="adv" data-v="5">5경기</button>
            <button class="btn" data-a="adv" data-v="999">시즌 끝</button>
          </div>
        </div>
      </section>`;
  }

  function renderSummary() {
    const s = career;
    const sm = s.summary;
    const st = sm.stats;
    const avg = st.apps ? (st.ratingSum / st.apps).toFixed(2) : "-";
    const isGK = s.player.position === "GK";
    const ballon = sm.ballon;
    const growthKeys = Object.keys(sm.growth);
    const otherAwards = sm.awards.filter((a) => a.name !== "발롱도르");
    return `
      ${ballon && ballon.rank === 1 ? `<div class="ballon-win"><div class="big">🏅</div><h2>발롱도르 수상</h2><p>${esc(s.player.name)}, 세계 최고의 선수로 인정받았습니다.</p></div>` : ""}
      <section class="box">
        <div class="box-h"><span>${sm.year} 시즌 결산</span>${sm.rank ? `<span class="tag ${sm.rank === 1 ? "gold" : "blue"}">${esc(sm.league)} ${sm.rank}위</span>` : ""}</div>
        <div class="stat-grid">
          <div><b>${st.apps}</b><span>경기</span></div>
          <div><b>${isGK ? st.cleanSheets : st.goals}</b><span>${isGK ? "클린시트" : "골"}</span></div>
          <div><b>${st.assists}</b><span>도움</span></div>
          <div><b class="rt ${rtClass(Number(avg) || 0)}" style="font-size:18px">${avg}</b><span>평점</span></div>
        </div>
        ${sm.trophies.length || otherAwards.length || (ballon && ballon.rank > 1) || (sm.national && sm.national.called) ? `<div class="box-b stack" style="border-top:1px solid var(--line)">
          ${sm.trophies.length ? `<div class="row wrapr" style="gap:4px">${sm.trophies.map((t) => `<span class="tag gold">🏆 ${esc(t)}</span>`).join("")}</div>` : ""}
          ${otherAwards.length ? `<div class="row wrapr" style="gap:4px">${otherAwards.map((a) => `<span class="tag blue">${esc(a.name)}</span>`).join("")}</div>` : ""}
          ${ballon && ballon.rank > 1 ? `<div class="small gold-t">발롱도르 순위 ${ballon.rank}위</div>` : ""}
          ${sm.national && sm.national.called ? `<div class="small">${nation(s.player.nationality).flag} A매치 ${sm.national.caps}경기 ${sm.national.goals}골${sm.national.tournament ? ` · ${esc(sm.national.tournament.name)} <b>${esc(sm.national.tournament.result)}</b>` : ""}</div>` : ""}
        </div>` : ""}
      </section>
      <section class="box">
        <div class="box-h"><span>성장 리뷰</span><span class="num">OVR ${sm.ovrBefore} → <b class="${sm.ovrAfter >= sm.ovrBefore ? "win-t" : "lose-t"}">${sm.ovrAfter}</b></span></div>
        <div class="box-b">${growthKeys.length ? `<div class="chips">${growthKeys.map((k) => `<span class="tag">${D.ATTR_LABELS[k]} <b class="${sm.growth[k] > 0 ? "win-t" : "lose-t"}">${sm.growth[k] > 0 ? "+" : ""}${sm.growth[k]}</b></span>`).join("")}</div>` : `<p class="small muted">눈에 띄는 변화가 없었어요.</p>`}</div>
      </section>
      ${sm.forcedRetire ? `<section class="box"><div class="box-b stack"><p>40세. 마지막 휘슬이 울렸습니다.</p><button class="btn btn-gold btn-block" data-a="retire">은퇴하기</button></div></section>` : renderOffers()}`;
  }

  function renderOffers() {
    const s = career;
    const ovr = E.overall(s.player);
    return `
      <section class="box">
        <div class="box-h"><span>${s.youth ? "첫 프로 계약" : "다음 시즌 선택"}</span><span class="muted small">내 OVR ${ovr}</span></div>
        <div class="box-b stack">
          <p class="small muted">${s.youth ? "성인 무대에서 출전 기회를 얻는 것이 성장의 핵심이에요." : "출전 시간이 성장을 좌우해요. 무리한 빅클럽 이적은 벤치를 부를 수 있어요."}</p>
          ${s.offers.map((o, i) => {
            const club = D.clubMap[o.clubId];
            const tag = o.kind === "stay" ? "잔류" : o.kind === "renew" ? "재계약" : o.kind === "first" ? "프로 계약" : "이적";
            const diff = ovr - club.strength;
            return `<button class="offer" data-a="offer" data-v="${i}">
              <span><span class="club">${esc(club.name)}</span> <span class="tag ${o.kind === "transfer" ? "green" : ""}">${tag}</span></span>
              <span class="str">${club.strength}</span>
              <span class="small muted">${esc(o.league)} · ${o.roleLabel} · ${o.years}년 · ${E.money(o.wage)}</span>
              <span class="tiny ${diff >= -4 ? "win-t" : "lose-t"}" style="text-align:right">${diff >= 0 ? "+" : ""}${diff}</span>
            </button>`;
          }).join("")}
          ${s.player.age >= 30 ? `<button class="btn btn-danger btn-block" data-a="retire">은퇴하기</button>` : ""}
        </div>
      </section>`;
  }

  function renderRetired() {
    const s = career;
    const rec = E.careerRecord(s);
    const hof = loadHof().sort(E.compareRecords);
    const rank = hof.findIndex((r) => r.id === s.id) + 1;
    return `
      <section class="box">
        <div class="box-h"><span>은퇴</span>${rank ? `<span class="tag gold">명예의 전당 ${rank}위</span>` : ""}</div>
        <div class="stat-grid">
          <div><b>${rec.ballon}</b><span>발롱도르</span></div>
          <div><b>${rec.bestOverall}</b><span>최고 OVR</span></div>
          <div><b>${rec.awards}</b><span>개인상</span></div>
          <div><b>${rec.goals + rec.assists}</b><span>공격P</span></div>
        </div>
        <div class="box-b stack" style="border-top:1px solid var(--line)">
          <p class="small">${esc(s.player.name)}, ${s.player.age}세에 그라운드를 떠났습니다.</p>
          <button class="btn btn-primary btn-block" data-a="new">새 커리어 시작</button>
        </div>
      </section>`;
  }

  function matchResult(m) {
    const me = E.myTeamId(career);
    const home = m.home === me;
    const gf = home ? m.hg : m.ag, ga = home ? m.ag : m.hg;
    return { home, gf, ga, res: gf > ga ? "W" : gf < ga ? "L" : "D", opp: home ? m.away : m.home };
  }

  function renderMatches() {
    const ms = career.season.matches;
    if (!ms.length) return `<section class="box"><div class="box-b muted small">아직 치른 경기가 없어요. 위에서 "다음 경기"를 눌러 시작하세요.</div></section>`;
    const recent = ms.slice(0, 20);
    const played = recent.filter((m) => m.minutes);
    const cnt = { W: 0, D: 0, L: 0 };
    for (const m of recent) cnt[matchResult(m).res]++;
    const winPct = Math.round((cnt.W / recent.length) * 100);
    const drawPct = Math.round((cnt.D / recent.length) * 100);
    const avg = played.length ? played.reduce((a, m) => a + m.rating, 0) / played.length : 0;
    const g = played.reduce((a, m) => a + m.goals, 0), a = played.reduce((x, m) => x + m.assists, 0);
    const rows = ms.slice(0, 30).map((m, i) => {
      const r = matchResult(m);
      const cls = !m.minutes ? "bench" : r.res === "W" ? "win" : r.res === "L" ? "lose" : "";
      const label = !m.minutes ? "벤치" : r.res === "W" ? "승리" : r.res === "L" ? "패배" : "무승부";
      const motm = m.minutes && m.rating >= 8.3 && r.res !== "L";
      return `<div class="mrow ${cls}" data-a="expand" data-v="${i}">
          <div class="m-meta"><b>${label}</b><span class="comp">${esc(m.competition)}</span><span>${m.minutes ? m.minutes + "분" : "미출전"}</span></div>
          <div class="m-main"><div class="m-score">${r.gf} : ${r.ga}</div><div class="m-opp">${r.home ? "홈" : "원정"} vs ${esc(E.teamName(career, r.opp))}</div></div>
          <div class="m-kda">${m.minutes ? `<span class="ga">${career.player.position === "GK" ? `${m.saves} 선방` : `${m.goals}골 ${m.assists}도움`}</span><span class="rt ${rtClass(m.rating)}">평점 ${m.rating.toFixed(1)}</span>${motm ? '<span class="motm">MOM</span>' : ""}` : `<span class="tiny muted">${esc(m.note || "벤치")}</span>`}</div>
        </div>${ui.expanded === i ? `<ul class="events">${m.events.map((e) => `<li><span class="min">${e.m ? e.m + "'" : ""}</span>${e.k === "goal" ? "⚽ " : e.k === "assist" ? "👟 " : e.k === "card" ? "🟨 " : ""}${esc(e.t)}</li>`).join("")}</ul>` : ""}`;
    }).join("");
    return `
      <section class="box">
        <div class="box-h"><span>최근 ${recent.length}경기</span><span class="muted small">출전 ${played.length}경기</span></div>
        <div class="recent">
          <div class="donut" style="background: conic-gradient(var(--win) 0 ${winPct}%, var(--draw) ${winPct}% ${winPct + drawPct}%, var(--lose) ${winPct + drawPct}% 100%)"><div>${winPct}%</div></div>
          <div class="grow">
            <div class="small muted num">${recent.length}전 ${cnt.W}승 ${cnt.D}무 ${cnt.L}패</div>
            <div class="recent-k">${g}골 <span class="muted">/</span> ${a}도움</div>
            <div class="small">평균 평점 <b class="rt ${rtClass(avg)}">${played.length ? avg.toFixed(2) : "-"}</b></div>
          </div>
        </div>
      </section>
      <div class="mlist">${rows}</div>`;
  }

  function renderTable() {
    const s = career;
    const rows = E.sortTable(s.season.table);
    const me = E.myTeamId(s);
    const cups = s.season.cups;
    return `
      <section class="box">
        <div class="box-h"><span>${esc(E.leagueName(s))}</span><span class="muted small">${rows[0].p}경기 진행</span></div>
        <div class="scroll-x"><table>
          <tr><th>#</th><th class="l">팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr>
          ${rows.map((r, i) => `<tr class="${r.id === me ? "me" : ""}"><td>${i + 1}</td><td class="l">${esc(E.teamName(s, r.id))}</td><td>${r.p}</td><td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.gf - r.ga > 0 ? "+" : ""}${r.gf - r.ga}</td><td><b>${r.pts}</b></td></tr>`).join("")}
        </table></div>
      </section>
      ${cups.length ? `<section class="box"><div class="box-h">컵 대회</div>${cups.map((c) => `<div class="list-row"><span>${esc(c.name)}</span><span class="${c.winner === s.clubId ? "gold-t" : c.alive ? "win-t" : "muted"}">${c.winner ? (c.winner === s.clubId ? "🏆 우승" : `우승 ${esc(E.teamName(s, c.winner))}`) : c.alive ? `진행 중 · ${c.teams.length}팀` : `${c.exitStage} 탈락`}</span></div>`).join("")}</section>` : ""}`;
  }

  function renderAttrs() {
    const s = career;
    const p = s.player;
    const vis = D.visibleAttributes(p.position);
    const start = s.season.startAttributes;
    return `
      <section class="box">
        <div class="box-h"><span>능력치</span><span class="tag blue">${esc(D.STYLES[p.styleId].name)}</span></div>
        <div class="box-b">
          ${vis.map((a) => attrRow(a, p.attributes[a], Math.floor(p.attributes[a]) - Math.floor(start[a]))).join("")}
          <p class="tiny muted" style="margin-top:8px">집중 육성: ${p.focus.map((k) => D.ATTR_LABELS[k]).join(", ")} · 숫자 옆 파란색은 이번 시즌 성장치예요.</p>
        </div>
      </section>
      <section class="box">
        <div class="list-row"><span class="muted">스카우트 평가</span><b>${E.potentialHint(p)}</b></div>
        <div class="list-row"><span class="muted">성장 특성</span><b>${p.age >= 24 ? D.GROWTH_CURVES[p.curve].name : "24세에 공개"}</b></div>
        <div class="list-row"><span class="muted">시장 가치</span><b class="num">${E.money(E.marketValue(p))}</b></div>
        <div class="box-b tiny muted">성장에는 나이, 출전 시간, 경기 활약, 부상이 영향을 줘요. 잠재력에 가까워질수록 성장이 느려져요.</div>
      </section>`;
  }

  function renderCareerTab() {
    const s = career;
    const t = E.careerTotals(s);
    const ballon = s.awards.filter((a) => a.name === "발롱도르").length;
    const hist = [...s.history].reverse();
    return `
      <section class="box">
        <div class="box-h"><span>통산 기록 (성인)</span><span class="muted small">최고 OVR ${s.bestOverall}</span></div>
        <div class="stat-grid">
          <div><b>${t.apps}</b><span>경기</span></div>
          <div><b>${t.goals}</b><span>골</span></div>
          <div><b>${t.assists}</b><span>도움</span></div>
          <div><b class="gold-t">${ballon}</b><span>발롱도르</span></div>
        </div>
        <div class="list-row" style="border-top:1px solid var(--line)"><span>${nation(s.player.nationality).flag} 국가대표</span><span class="num">A매치 ${s.international.caps}경기 ${s.international.goals}골</span></div>
      </section>
      <section class="box">
        <div class="box-h"><span>트로피</span><span class="muted small">${s.trophies.length}</span></div>
        ${s.trophies.length ? [...s.trophies].reverse().map((x) => `<div class="list-row"><span>🏆 ${esc(x.name)}</span><span class="muted num">${x.year}</span></div>`).join("") : `<div class="box-b small muted">아직 없어요.</div>`}
      </section>
      <section class="box">
        <div class="box-h"><span>개인상</span><span class="muted small">${s.awards.length}</span></div>
        ${s.awards.length ? [...s.awards].reverse().map((x) => `<div class="list-row"><span>${x.name === "발롱도르" ? "🏅 <b class='gold-t'>발롱도르</b>" : esc(x.name)}</span><span class="muted num">${x.year}</span></div>`).join("") : `<div class="box-b small muted">아직 없어요.</div>`}
      </section>
      <section class="box">
        <div class="box-h">시즌별 기록</div>
        <div class="scroll-x"><table>
          <tr><th>시즌</th><th class="l">팀</th><th>OVR</th><th>경기</th><th>골</th><th>도움</th><th>평점</th></tr>
          ${hist.map((h) => `<tr><td>${h.year}</td><td class="l">${esc(D.clubMap[h.club].name)}${h.youth ? " U18" : ""}<div class="tiny muted">${esc(h.league)}${h.rank ? ` ${h.rank}위` : ""}${h.ballonRank === 1 ? " · 🏅" : ""}</div></td><td>${h.overall}</td><td>${h.stats.apps}</td><td>${h.stats.goals}</td><td>${h.stats.assists}</td><td>${h.stats.apps ? (h.stats.ratingSum / h.stats.apps).toFixed(2) : "-"}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">첫 시즌 진행 중</td></tr>`}
        </table></div>
      </section>`;
  }

  function renderNews() {
    return `<section class="box"><div class="box-h">뉴스</div>${career.news.slice(0, 60).map((n) => `<div class="news-row"><span class="muted tiny num">${n.year}</span> ${esc(n.text)}</div>`).join("")}</section>`;
  }

  // ---------- 명예의 전당, 가이드, 저장 ----------
  function renderHof() {
    const list = loadHof().sort(E.compareRecords);
    return `
      <section class="box">
        <div class="box-h"><span>명예의 전당</span><span class="muted small">${list.length}명</span></div>
        <div class="box-b tiny muted">순위는 발롱도르 → 최고 OVR → 개인상 → 공격포인트 순이에요. 이 기기에만 저장돼요.</div>
        ${list.length ? `<div class="scroll-x"><table>
          <tr><th>#</th><th class="l">선수</th><th>발롱</th><th>OVR</th><th>상</th><th>공P</th></tr>
          ${list.map((r, i) => `<tr${career && r.id === career.id ? ' class="me"' : ""}><td>${i + 1}</td><td class="l">${nation(r.nationality).flag} <b>${esc(r.name)}</b><div class="tiny muted">${r.position} · ${esc(r.lastClub)} · ${r.date}</div></td><td>${r.ballon}</td><td>${r.bestOverall}</td><td>${r.awards}</td><td>${r.goals + r.assists}</td></tr>`).join("")}
        </table></div>` : `<div class="box-b muted">아직 은퇴한 선수가 없어요.</div>`}
      </section>`;
  }

  function renderGuide() {
    const items = [
      ["선수 만들기", "이름, 국적, 시작 국가와 유스 클럽, 포지션을 고른 뒤 후보 3명 중 한 명을 선택해요. 모든 후보는 OVR 45, 능력치 합계 240에서 시작해요."],
      ["시즌 진행", "경기 전에 훈련과 경기 성향을 고르고 경기를 치러요. 17세 시즌은 U18 유스 리그에서 뛰고, 시즌이 끝나면 첫 프로 계약을 골라요."],
      ["오버롤", "오버롤은 포지션별 능력치 가중평균이에요. 팀 전력보다 오버롤이 높을수록 선발로 나갈 확률이 올라가요."],
      ["성장", "나이, 출전 시간, 평점, 부상, 숨겨진 성장 특성이 성장에 영향을 줘요. 잠재력이 상한선이고, 성인이 된 뒤 출전을 못 하면 잠재력이 깎일 수 있어요."],
      ["시즌 종료", "리그·컵·대륙 대회 우승, 개인상, 국가대표, 발롱도르가 결정돼요. 그다음 잔류, 재계약, 이적 중에서 골라요. 발롱도르는 빅리그에서 뛰어야 노릴 수 있어요."],
      ["은퇴와 랭킹", "30세부터 은퇴할 수 있고 40세에는 은퇴해요. 은퇴하면 명예의 전당에 올라가요."],
      ["저장", "진행 상황은 이 브라우저에 자동 저장돼요. 저장 메뉴에서 저장 코드를 복사해 두면 다른 기기에서 이어할 수 있어요."],
    ];
    return `<section class="box"><div class="box-h">게임 가이드</div>${items.map(([h, t]) => `<div class="box-b" style="border-bottom:1px solid var(--line)"><h3>${h}</h3><p class="small" style="margin-top:4px">${t}</p></div>`).join("")}</section>`;
  }

  function renderMenu() {
    return `
      <section class="box">
        <div class="box-h">저장 관리</div>
        <div class="box-b stack">
          <p class="small muted">진행 상황은 이 브라우저에 자동 저장돼요. 다른 기기로 옮기려면 저장 코드를 복사해서 붙여 넣으세요.</p>
          <button class="btn btn-block" data-a="save-code" ${career ? "" : "disabled"}>저장 코드 복사</button>
          <button class="btn btn-block" data-a="import">저장 코드 / 파일 불러오기</button>
          ${career && career.phase === "season" && career.player.age >= 30 ? `<button class="btn btn-danger btn-block" data-a="retire">지금 은퇴하기</button>` : ""}
          <button class="btn btn-danger btn-block" data-a="new">새 커리어 시작</button>
        </div>
      </section>`;
  }

  // ---------- 모달 ----------
  function renderModal() {
    const m = ui.modal;
    if (career && career.pendingEvent && ui.screen === "career") {
      const e = career.pendingEvent;
      return `<div class="modal-bg"><div class="modal">
        <span class="tag blue" style="align-self:flex-start">이벤트</span>
        <h2>${esc(e.title)}</h2>
        <p>${esc(e.text)}</p>
        ${e.options.map((o, i) => `<button class="btn btn-block ${i === 0 ? "btn-primary" : ""}" data-a="event" data-v="${i}">${esc(o)}</button>`).join("")}
      </div></div>`;
    }
    if (!m) return "";
    if (m.type === "confirm") {
      return `<div class="modal-bg"><div class="modal">
        <h2>${esc(m.title)}</h2>
        ${m.text ? `<p class="small muted">${esc(m.text)}</p>` : ""}
        <div class="grid2"><button class="btn" data-a="modal-close">취소</button><button class="btn ${m.danger ? "btn-danger" : "btn-primary"}" data-a="confirm-yes">${esc(m.yes || "확인")}</button></div>
      </div></div>`;
    }
    if (m.type === "save") {
      return `<div class="modal-bg"><div class="modal">
        <h2>저장 코드</h2>
        <p class="small muted">아래 코드를 복사해 메모장 등에 보관하세요.</p>
        <textarea id="save-text" readonly>${esc(E.serialize(career))}</textarea>
        <div class="grid2"><button class="btn" data-a="modal-close">닫기</button><button class="btn btn-primary" data-a="copy-save">복사</button></div>
      </div></div>`;
    }
    if (m.type === "import") {
      return `<div class="modal-bg"><div class="modal">
        <h2>저장 불러오기</h2>
        <p class="small muted">저장 코드를 붙여 넣거나 .json 파일을 고르세요. 지금 커리어는 덮어써져요.</p>
        <textarea id="import-text" placeholder="저장 코드 붙여 넣기"></textarea>
        <button class="btn btn-block" data-a="import-file">파일 고르기</button>
        <div class="grid2"><button class="btn" data-a="modal-close">취소</button><button class="btn btn-primary" data-a="import-go">불러오기</button></div>
      </div></div>`;
    }
    return "";
  }

  // ---------- 렌더 ----------
  function render() {
    const scr = ui.screen;
    let body;
    if (scr === "create") body = renderCreate();
    else if (scr === "career" && career) body = renderCareer();
    else if (scr === "hof") body = renderHof();
    else if (scr === "guide") body = renderGuide();
    else if (scr === "menu") body = renderMenu();
    else body = renderHome();
    app.innerHTML = renderTopbar() + `<main class="wrap">${body}</main>` + renderModal();
  }

  function finishRetire() {
    E.retire(career);
    const hof = loadHof().filter((r) => r.id !== career.id);
    hof.push(E.careerRecord(career));
    saveHof(hof);
  }

  function askConfirm(opts) { ui.modal = { type: "confirm", ...opts }; }

  // 확인이 필요한 동작들
  const confirmed = {
    new() { ui.create = newCreate(); ui.screen = "create"; window.scrollTo({ top: 0 }); },
    offer(i) { E.acceptOffer(career, i); ui.tab = "match"; ui.expanded = -1; save(); window.scrollTo({ top: 0 }); },
    retire() { finishRetire(); ui.screen = "career"; save(); window.scrollTo({ top: 0 }); },
  };

  function importText(text) {
    career = E.deserialize(text.trim());
    save();
    ui.modal = null;
    ui.screen = "career";
    toast("저장을 불러왔어요.");
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
      case "go":
        if (v === "career" && !career) return;
        ui.screen = v;
        window.scrollTo({ top: 0 });
        break;
      case "new":
        if (career && career.phase !== "retired") askConfirm({ title: "새 커리어를 시작할까요?", text: "지금 진행 중인 커리어는 삭제돼요.", yes: "새로 시작", danger: true, action: "new" });
        else confirmed.new();
        break;
      case "pos": ui.create.position = v; ui.create.candidate = 0; ui.create.focus = []; break;
      case "reroll": ui.create.seed = (Math.imul(ui.create.seed, 1103515245) + 12345) >>> 0; ui.create.candidate = 0; break;
      case "cand": ui.create.candidate = Number(v); break;
      case "focus": {
        const f = ui.create.focus;
        ui.create.focus = f.includes(v) ? f.filter((x) => x !== v) : [...f, v].slice(-2);
        break;
      }
      case "start": {
        const c = ui.create;
        try {
          const cand = E.candidates(c.position, c.seed)[c.candidate];
          career = E.createCareer({ ...c, candidate: cand, seed: c.seed ^ 0x5bd1e995 });
          ui.screen = "career"; ui.tab = "match"; ui.training = "balanced"; ui.tactic = "balanced"; ui.expanded = -1;
          save();
          window.scrollTo({ top: 0 });
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
        ui.expanded = -1;
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
      case "expand": ui.expanded = ui.expanded === Number(v) ? -1 : Number(v); break;
      case "offer": {
        const o = career.offers[Number(v)];
        const club = D.clubMap[o.clubId];
        askConfirm({
          title: `${club.name}${o.kind === "stay" ? " 잔류" : " 계약"}`,
          text: `${o.roleLabel} · ${o.years}년 · 연봉 ${E.money(o.wage)} · 팀 전력 ${club.strength}`,
          yes: "결정", action: "offer", value: Number(v),
        });
        break;
      }
      case "retire": askConfirm({ title: "은퇴할까요?", text: "되돌릴 수 없어요. 기록은 명예의 전당에 올라가요.", yes: "은퇴", danger: true, action: "retire" }); break;
      case "confirm-yes": {
        const m = ui.modal;
        ui.modal = null;
        if (m && confirmed[m.action]) confirmed[m.action](m.value);
        break;
      }
      case "modal-close": ui.modal = null; break;
      case "save-code": ui.modal = { type: "save" }; break;
      case "copy-save": {
        const ta = document.getElementById("save-text");
        const text = ta.value;
        const fallback = () => { ta.focus(); ta.select(); toast("코드를 선택했어요. 길게 눌러 복사하세요."); };
        try {
          navigator.clipboard.writeText(text).then(() => toast("복사했어요."), fallback);
        } catch (e) { fallback(); }
        return;
      }
      case "import": ui.modal = { type: "import" }; break;
      case "import-file": document.getElementById("importFile").click(); return;
      case "import-go": {
        const text = document.getElementById("import-text").value;
        if (!text.trim()) { toast("저장 코드를 붙여 넣어 주세요."); return; }
        try { importText(text); } catch (e) { toast("저장 코드를 읽지 못했어요. 코드 전체를 붙여 넣었는지 확인해 주세요."); return; }
        break;
      }
    }
    render();
  });

  document.getElementById("importFile").addEventListener("change", async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try { importText(await f.text()); render(); } catch (e) { toast("저장 파일을 읽지 못했어요."); }
    ev.target.value = "";
  });

  render();
})();
