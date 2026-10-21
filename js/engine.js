// 게임 엔진: 화면과 분리된 순수 로직입니다.
// state 하나에 커리어 전체가 들어 있고, 모든 함수는 state 를 직접 수정합니다.
(function () {
  const D = window.GameData;
  const SAVE_VERSION = 1;
  const START_YEAR = 2025;
  const RETIRE_AGE = 40;

  // ---------- 난수 (저장 가능한 시드 기반) ----------
  function rand(s) {
    s.seed = (s.seed + 0x6d2b79f5) >>> 0;
    let t = s.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const randInt = (s, a, b) => a + Math.floor(rand(s) * (b - a + 1));
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
  function shuffle(s, arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand(s) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function poisson(s, lambda) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= rand(s); } while (p > L && k < 12);
    return k - 1;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round1 = (v) => Math.round(v * 10) / 10;

  // ---------- 능력치 ----------
  function overallValue(p) {
    return Object.entries(D.OVR_WEIGHTS[p.position]).reduce((s, [k, w]) => s + p.attributes[k] * w, 0);
  }
  const overall = (p) => Math.round(overallValue(p));

  function potentialHint(p) {
    // 스카우트가 보는 대략적인 잠재력 (정확한 값은 숨김)
    const v = p.potential;
    if (v >= 92) return "세대를 대표할 재능";
    if (v >= 85) return "월드클래스 잠재력";
    if (v >= 78) return "국가대표급 잠재력";
    if (v >= 70) return "1부 리그 주전감";
    return "성실한 프로 선수감";
  }

  function emptyStats() {
    return { apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, saves: 0, cleanSheets: 0, conceded: 0, yellow: 0, red: 0, ratingSum: 0, motm: 0 };
  }
  function addStats(a, b) { for (const k of Object.keys(a)) a[k] += b[k] || 0; }

  // ---------- 선수 후보 ----------
  function candidates(position, seed) {
    const s = { seed: seed >>> 0 };
    const visible = D.visibleAttributes(position);
    const weights = D.OVR_WEIGHTS[position];
    const styles = shuffle(s, D.POSITION_STYLES[position]).slice(0, 3);
    return styles.map((styleId, idx) => {
      const attrs = {};
      for (const k of Object.keys(D.ATTR_LABELS)) attrs[k] = 38 + randInt(s, -3, 3);
      for (const k of Object.keys(weights)) attrs[k] += 10;
      for (const [k, e] of Object.entries(D.STYLES[styleId].emphasis)) attrs[k] += 8 * e;
      // 오버롤을 45로 맞춤 (가중치 합이 1이라 그대로 더하면 됨)
      const delta = 45 - overallValue({ position, attributes: attrs });
      for (const k of Object.keys(weights)) attrs[k] = clamp(Math.round(attrs[k] + delta), 20, 75);
      for (let i = 0; i < 20 && overall({ position, attributes: attrs }) !== 45; i++) {
        const top = Object.keys(weights).sort((a, b) => weights[b] - weights[a])[i % Object.keys(weights).length];
        attrs[top] += overall({ position, attributes: attrs }) < 45 ? 1 : -1;
      }
      // 보이는 능력치 합계를 240으로 맞춤 (오버롤에 안 들어가는 능력치로 조정)
      const free = visible.filter((k) => !(k in weights));
      const fixedSum = visible.filter((k) => k in weights).reduce((a, k) => a + attrs[k], 0);
      let remain = 240 - fixedSum;
      free.forEach((k, i) => {
        const left = free.length - i;
        const base = Math.round(remain / left);
        const v = i === free.length - 1 ? remain : clamp(base + randInt(s, -4, 4), 20, 75);
        attrs[k] = v;
        remain -= v;
      });
      return { id: `c${idx}`, styleId, styleName: D.STYLES[styleId].name, attributes: attrs };
    });
  }

  function rollPotential(s) {
    const total = D.POTENTIAL_GRADES.reduce((a, g) => a + g.weight, 0);
    let r = rand(s) * total;
    for (const g of D.POTENTIAL_GRADES) {
      if ((r -= g.weight) <= 0) return { grade: g.grade, value: randInt(s, g.min, g.max) };
    }
    const g = D.POTENTIAL_GRADES[0];
    return { grade: g.grade, value: g.min };
  }

  // ---------- 커리어 생성 ----------
  function createCareer(opts) {
    const { name, number, nationality, position, foot, clubId, candidate, focus, seed } = opts;
    if (!name || !name.trim()) throw new Error("이름을 입력해 주세요.");
    if (!D.clubMap[clubId]) throw new Error("유스 클럽을 선택해 주세요.");
    if (!focus || focus.length < 1 || focus.length > 2) throw new Error("집중 육성 항목은 1~2개를 골라 주세요.");
    const s = { seed: (seed ?? Date.now()) >>> 0 };
    const pot = rollPotential(s);
    const r = rand(s);
    const curve = r < 0.25 ? "early" : r < 0.75 ? "normal" : "late";
    const state = {
      version: SAVE_VERSION,
      id: `career-${s.seed}`,
      seed: s.seed,
      year: START_YEAR,
      phase: "season",
      youth: true,
      clubId,
      leagueId: D.clubMap[clubId].league,
      contractYears: 0,
      player: {
        name: name.trim().slice(0, 16),
        number: clamp(Number(number) || 10, 1, 99),
        nationality,
        position,
        foot,
        age: 17,
        attributes: { ...candidate.attributes },
        styleId: candidate.styleId,
        focus: [...focus],
        potential: pot.value,
        potentialGrade: pot.grade,
        curve,
        morale: 80,
        energy: 100,
        injury: 0,
        suspension: 0,
        yellowCount: 0,
        reputation: 5,
        wage: 0,
        earnings: 0,
        selectionBoost: 0,
      },
      world: Object.fromEntries(D.leagues.map((l) => [l.id, [...l.clubIds]])),
      lastTables: Object.fromEntries(
        D.leagues.map((l) => [l.id, [...l.clubIds].sort((a, b) => D.clubMap[b].strength - D.clubMap[a].strength)])
      ),
      season: null,
      history: [],
      trophies: [],
      awards: [],
      international: { caps: 0, goals: 0, tournaments: [] },
      news: [],
      offers: [],
      summary: null,
      pendingEvent: null,
      bestOverall: 45,
      clubsPlayed: [],
    };
    startSeason(state);
    addNews(state, `${state.player.name}, ${D.clubMap[clubId].name} U18 입단. 축구 인생의 첫 페이지가 열렸습니다.`);
    return state;
  }

  // ---------- 팀 정보 ----------
  function teamStrength(state, id) {
    if (id.startsWith("youth:")) return state.season.youthStrength[id];
    return D.clubMap[id].strength;
  }
  function teamName(state, id) {
    if (id.startsWith("youth:")) return D.clubMap[id.slice(6)].name + " U18";
    return D.clubMap[id].name;
  }
  const myTeamId = (state) => (state.youth ? "youth:" + state.clubId : state.clubId);
  function leagueOfClub(state, clubId) {
    return Object.keys(state.world).find((lid) => state.world[lid].includes(clubId));
  }
  function leagueName(state) {
    return state.youth ? "U18 유스 리그" : D.leagueMap[state.leagueId].name;
  }
  function countryOf(state) { return D.clubMap[state.clubId].country; }

  // ---------- 일정 ----------
  function roundRobin(teams) {
    const t = [...teams];
    if (t.length % 2) t.push(null);
    const n = t.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const games = [];
      for (let i = 0; i < n / 2; i++) {
        let home = t[i], away = t[n - 1 - i];
        if ((r + i) % 2) [home, away] = [away, home];
        if (home && away) games.push({ home, away });
      }
      rounds.push(games);
      t.splice(1, 0, t.pop());
    }
    const second = rounds.map((g) => g.map((m) => ({ home: m.away, away: m.home })));
    return [...rounds, ...second];
  }
  const emptyRow = (id) => ({ id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] });
  function sortTable(rows) {
    return [...rows].sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || a.id.localeCompare(b.id));
  }
  function applyResult(table, home, away, hg, ag) {
    for (const [id, f, a] of [[home, hg, ag], [away, ag, hg]]) {
      const row = table.find((r) => r.id === id);
      if (!row) continue;
      row.p++; row.gf += f; row.ga += a;
      const res = f > a ? "W" : f === a ? "D" : "L";
      if (res === "W") { row.w++; row.pts += 3; } else if (res === "D") { row.d++; row.pts++; } else row.l++;
      row.form = [...row.form, res].slice(-5);
    }
  }

  function makeCup(state, kind, name, teams, short) {
    return { kind, name, short: short || name, teams: shuffle(state, teams), round: 0, alive: teams.includes(myTeamId(state)), winner: null, exitStage: null };
  }
  const cupRoundsNeeded = (n) => Math.ceil(Math.log2(Math.max(2, n)));
  function stageName(n) {
    if (n <= 2) return "결승";
    if (n <= 4) return "준결승";
    if (n <= 8) return "8강";
    return `${2 ** Math.ceil(Math.log2(n))}강`;
  }

  function continentalFor(state) {
    for (const c of D.CONTINENTAL) {
      const teams = [];
      for (const [lid, n] of Object.entries(c.slots)) teams.push(...(state.lastTables[lid] || []).slice(0, n));
      if (teams.includes(state.clubId)) return makeCup(state, "continental", c.name, teams, c.short);
    }
    return null;
  }

  function startSeason(state) {
    const season = {
      table: [], schedule: [], days: [], day: 0, cups: [], stats: emptyStats(), compStats: {},
      matches: [], youthStrength: {}, trainingCounts: {}, injuriesMissed: 0, startAttributes: { ...state.player.attributes },
      startOverall: overall(state.player),
    };
    state.season = season;
    let teams;
    if (state.youth) {
      const country = countryOf(state);
      const others = shuffle(state, D.clubs.filter((c) => c.country === country && c.id !== state.clubId)).slice(0, 7);
      teams = [state.clubId, ...others.map((c) => c.id)].map((id) => "youth:" + id);
      for (const id of teams) season.youthStrength[id] = Math.round(44 + (D.clubMap[id.slice(6)].strength - 62) * 0.2 + randInt(state, -2, 2));
    } else {
      teams = [...state.world[state.leagueId]];
      const country = countryOf(state);
      const cupTeams = Object.entries(state.world)
        .filter(([lid]) => D.leagueMap[lid].country === country)
        .flatMap(([, ids]) => ids);
      if (D.DOMESTIC_CUPS[country]) season.cups.push(makeCup(state, "domestic", D.DOMESTIC_CUPS[country], cupTeams));
      const cont = continentalFor(state);
      if (cont) season.cups.push(cont);
    }
    season.schedule = roundRobin(teams);
    season.table = teams.map(emptyRow);
    // 리그 라운드 사이에 컵 경기 끼워 넣기
    const R = season.schedule.length;
    const slots = Array.from({ length: R }, (_, i) => [{ type: "league", round: i }]);
    season.cups.forEach((cup, ci) => {
      const n = cupRoundsNeeded(cup.teams.length);
      for (let k = 0; k < n; k++) {
        const at = Math.min(R - 1, Math.floor((R * (k + 1)) / (n + 1)) + ci);
        slots[at].push({ type: "cup", cup: ci });
      }
    });
    season.days = slots.flat();
    state.phase = "season";
  }

  // ---------- 경기 시뮬레이션 ----------
  function simScore(state, homeStr, awayStr, tempo = 1) {
    const hl = clamp(1.4 + (homeStr - awayStr) / 22, 0.2, 4.2) * tempo;
    const al = clamp(1.1 + (awayStr - homeStr) / 22, 0.15, 4) * tempo;
    return [poisson(state, hl), poisson(state, al)];
  }

  const GOAL_SHARE = { ST: 0.4, LW: 0.25, RW: 0.25, CAM: 0.19, CM: 0.09, CDM: 0.05, LB: 0.04, RB: 0.04, CB: 0.05, GK: 0 };
  const ASSIST_SHARE = { ST: 0.12, LW: 0.2, RW: 0.2, CAM: 0.24, CM: 0.15, CDM: 0.08, LB: 0.1, RB: 0.1, CB: 0.03, GK: 0.01 };
  const DEFENSIVE = ["CB", "LB", "RB", "CDM", "GK"];

  function playerMatch(state, fixture, competition, tactic, isCup) {
    const p = state.player;
    const me = myTeamId(state);
    const home = fixture.home === me;
    const opp = home ? fixture.away : fixture.home;
    const ovr = overall(p);
    const myStr = teamStrength(state, me);
    const oppStr = teamStrength(state, opp);
    const diff = ovr - myStr;
    let minutes = 0;
    let note = "";
    if (p.injury > 0) {
      note = `부상 회복 중 · ${p.injury}경기 남음`;
      p.injury--;
      state.season.injuriesMissed++;
    } else if (p.suspension > 0) {
      note = "출장 정지";
      p.suspension--;
    } else {
      let start = state.youth
        ? clamp(0.82 + diff * 0.05, 0.35, 0.97)
        : clamp(0.72 + diff * 0.05 + (p.morale - 70) * 0.002, 0.03, 0.96);
      if (isCup && !state.youth) start = clamp(start + 0.18 * (oppStr < myStr ? 1 : 0.4), 0, 0.97);
      if (p.selectionBoost > 0) { start = clamp(start + 0.2, 0, 0.97); p.selectionBoost--; }
      if (p.energy < 40) start *= 0.6;
      if (rand(state) < start) {
        minutes = p.position === "GK" || rand(state) < 0.5 ? 90 : randInt(state, 62, 89);
      } else if (p.position !== "GK" && rand(state) < clamp(0.45 + diff * 0.03, 0.05, 0.6)) {
        minutes = randInt(state, 10, 32);
      } else {
        note = diff < -12 ? "명단 제외" : "벤치 대기";
      }
    }
    const tempo = tactic === "attacking" ? 1.15 : tactic === "safe" ? 0.85 : 1;
    const boost = minutes ? ((ovr - myStr) * 0.15 + (p.morale - 60) * 0.02) * (minutes / 90) : 0;
    const homeBonus = 1.5;
    const hs = (home ? myStr + boost : oppStr) + homeBonus;
    const as = home ? oppStr : myStr + boost;
    const [hg, ag] = simScore(state, hs, as, tempo);
    const gf = home ? hg : ag;
    const ga = home ? ag : hg;
    const st = emptyStats();
    const events = [];
    let rating = 0;
    if (minutes) {
      st.apps = 1;
      st.starts = minutes >= 60 ? 1 : 0;
      st.minutes = minutes;
      const mult = clamp(1 + diff * 0.04, 0.5, 1.8) * (tactic === "attacking" ? 1.1 : 1) * (minutes / 90);
      const gShare = Math.min(0.75, GOAL_SHARE[p.position] * mult);
      const aShare = Math.min(0.6, ASSIST_SHARE[p.position] * mult);
      for (let i = 0; i < gf; i++) {
        const r = rand(state);
        if (r < gShare) st.goals++;
        else if (r < gShare + aShare) st.assists++;
      }
      if (p.position === "GK") st.saves = poisson(state, clamp(2.2 + (oppStr - myStr) / 10, 0.5, 6));
      if (ga === 0 && minutes >= 60) st.cleanSheets = 1;
      st.conceded = p.position === "GK" ? ga : 0;
      const noise = (rand(state) + rand(state) + rand(state) - 1.5) * 0.6;
      rating = 6.4 + diff * 0.02 + noise + st.goals * 0.9 + st.assists * 0.55 + (gf > ga ? 0.35 : gf < ga ? -0.35 : 0);
      if (DEFENSIVE.includes(p.position)) {
        rating += st.cleanSheets ? (p.position === "GK" ? 0.7 : 0.5) : 0;
        rating -= ga * (p.position === "GK" ? 0.25 : p.position === "CB" ? 0.18 : 0.1);
      }
      rating += st.saves * 0.15;
      if (minutes < 30) rating = 6.3 + (rating - 6.3) * 0.6;
      if (rand(state) < 0.08) {
        st.yellow = 1;
        p.yellowCount++;
        events.push({ m: randInt(state, 5, 90), t: `${p.name} 경고`, k: "card" });
        if (p.yellowCount % 5 === 0) { p.suspension = 1; addNews(state, "경고 5회 누적으로 다음 경기 출장 정지."); }
      }
      if (rand(state) < 0.004) {
        st.red = 1; p.suspension = 2; rating -= 1.2;
        events.push({ m: randInt(state, 20, 88), t: `${p.name} 퇴장 · 2경기 출장 정지`, k: "card" });
      }
      rating = round1(clamp(rating, 3, 10));
      st.ratingSum = rating;
      p.energy = clamp(p.energy - (minutes / 90) * 14 - (tactic === "attacking" ? 4 : 0), 0, 100);
      p.morale = clamp(p.morale + (gf > ga ? 3 : gf < ga ? -3 : 0) + 1, 0, 100);
      const lf = state.youth ? 0.3 : leagueFactor(state.leagueId);
      p.reputation = clamp(p.reputation + (rating - 6.4) * 0.35 * lf, 0, 100);
      if (rand(state) < 0.006 + (100 - p.energy) * 0.0004) {
        p.injury = rand(state) < 0.08 ? randInt(state, 6, 14) : randInt(state, 1, 4);
        addNews(state, `${p.name}, 부상으로 ${p.injury}경기 결장 예상.`);
      }
      if (st.goals >= 3) addNews(state, `해트트릭! ${p.name}, ${teamName(state, opp)} 상대로 ${st.goals}골.`);
    } else {
      p.morale = clamp(p.morale - (diff > -3 && !p.injury ? 3 : 1), 0, 100);
    }
    // 이벤트 타임라인 만들기
    let myGoals = st.goals, myAssists = st.assists;
    for (const [tid, n] of [[fixture.home, hg], [fixture.away, ag]]) {
      for (let i = 0; i < n; i++) {
        const mine = tid === me;
        if (mine && myGoals > 0) { events.push({ m: randInt(state, 1, 90), t: `${p.name} 골!`, k: "goal" }); myGoals--; }
        else if (mine && myAssists > 0) { events.push({ m: randInt(state, 1, 90), t: `${teamName(state, tid)} 득점 · ${p.name} 도움`, k: "assist" }); myAssists--; }
        else events.push({ m: randInt(state, 1, 90), t: `${teamName(state, tid)} 득점`, k: "score" });
      }
    }
    events.sort((a, b) => a.m - b.m);
    if (!minutes) events.unshift({ m: 0, t: note || "벤치 대기", k: "info" });
    // 통계 반영
    addStats(state.season.stats, st);
    state.season.compStats[competition] ??= emptyStats();
    addStats(state.season.compStats[competition], st);
    const match = {
      competition, home: fixture.home, away: fixture.away, hg, ag, minutes, rating,
      goals: st.goals, assists: st.assists, saves: st.saves, events, note,
    };
    state.season.matches.unshift(match);
    state.season.matches = state.season.matches.slice(0, 80);
    return match;
  }

  function leagueFactor(lid) {
    const l = D.leagueMap[lid];
    const avg = l.clubIds.reduce((a, id) => a + D.clubMap[id].strength, 0) / l.clubIds.length;
    return clamp((avg - 58) / 18, 0.2, 1.2);
  }

  // ---------- 훈련 ----------
  const TRAININGS = {
    balanced: { label: "균형 훈련", stats: null },
    attack: { label: "공격 훈련", stats: ["shooting", "positioning"] },
    technique: { label: "기술 훈련", stats: ["passing", "dribbling"] },
    defense: { label: "수비 훈련", stats: ["defending", "positioning"] },
    fitness: { label: "체력 훈련", stats: ["pace", "physical"] },
    goalkeeping: { label: "골키퍼 훈련", stats: ["reflexes", "handling", "kicking"] },
    focus: { label: "집중 육성", stats: "focus" },
    rest: { label: "휴식", stats: [] },
  };
  const TACTICS = { balanced: "균형", attacking: "공격적", safe: "안정적" };

  function ageGrowth(age, curve) {
    const T = {
      normal: [5.5, 5.5, 5, 4.5, 4, 3.5, 3, 2.2, 1.6, 1.1, 0.6, 0.3, 0, -0.6, -1.1, -1.7, -2.4, -3, -3.6],
      early: [7, 7, 6, 5, 3.5, 2.5, 1.8, 1.2, 0.8, 0.4, 0.2, 0, -0.5, -1, -1.5, -2.2, -2.8, -3.4, -4],
      late: [3.5, 3.8, 4, 4, 4, 4, 3.8, 3.2, 2.6, 2, 1.4, 0.8, 0.4, 0, -0.6, -1.2, -1.8, -2.5, -3.2],
    }[curve || "normal"];
    const i = age - 17;
    if (i < 0) return T[0];
    if (i >= T.length) return T[T.length - 1] - 0.6 * (i - T.length + 1);
    return T[i];
  }

  function trainingStats(state, key) {
    const p = state.player;
    const t = TRAININGS[key] || TRAININGS.balanced;
    if (t.stats === "focus") return p.focus;
    if (t.stats === null) return Object.keys(D.OVR_WEIGHTS[p.position]);
    return t.stats;
  }

  function applyTraining(state, key) {
    const p = state.player;
    if (key === "rest") { p.energy = clamp(p.energy + 28, 0, 100); p.morale = clamp(p.morale + 2, 0, 100); return; }
    p.energy = clamp(p.energy + (key === "fitness" ? 8 : 14), 0, 100);
    if (p.injury > 0) return;
    const stats = trainingStats(state, key);
    const per = Math.max(0, ageGrowth(p.age, p.curve)) * 0.3 / Math.max(1, state.season.days.length);
    const mult = key === "balanced" ? 1 : 1.5;
    for (const k of stats) {
      state.season.trainingCounts[k] = (state.season.trainingCounts[k] || 0) + 1;
      if (overallValue(p) >= p.potential) break;
      p.attributes[k] = clamp(p.attributes[k] + (per * mult * (p.energy / 100) * 3) / stats.length, 10, 99);
    }
  }

  // ---------- 진행 ----------
  function advance(state, training = "balanced", tactic = "balanced") {
    if (state.phase !== "season" || state.pendingEvent) return null;
    const season = state.season;
    if (season.day >= season.days.length) { finishSeason(state); return null; }
    applyTraining(state, training);
    const day = season.days[season.day];
    let played = null;
    if (day.type === "league") {
      for (const fx of season.schedule[day.round]) {
        let hg, ag;
        if (fx.home === myTeamId(state) || fx.away === myTeamId(state)) {
          played = playerMatch(state, fx, leagueName(state), tactic, false);
          ({ hg, ag } = played);
        } else {
          [hg, ag] = simScore(state, teamStrength(state, fx.home) + 1.5, teamStrength(state, fx.away));
        }
        applyResult(season.table, fx.home, fx.away, hg, ag);
      }
    } else {
      played = playCupRound(state, season.cups[day.cup], tactic);
    }
    season.day++;
    if (!state.youth && !played) state.player.energy = clamp(state.player.energy + 6, 0, 100);
    maybeEvent(state);
    if (season.day >= season.days.length) finishSeason(state);
    return played;
  }

  function playCupRound(state, cup, tactic) {
    if (cup.winner || cup.teams.length < 2) return null;
    const me = myTeamId(state);
    const stage = stageName(cup.teams.length);
    const next = [];
    let played = null;
    const teams = [...cup.teams];
    if (teams.length % 2) next.push(teams.pop()); // 부전승
    for (let i = 0; i < teams.length; i += 2) {
      const fx = { home: teams[i], away: teams[i + 1] };
      let hg, ag;
      if (fx.home === me || fx.away === me) {
        played = playerMatch(state, fx, `${cup.name} ${stage}`, tactic, cup.kind === "domestic");
        ({ hg, ag } = played);
      } else {
        [hg, ag] = simScore(state, teamStrength(state, fx.home) + 1, teamStrength(state, fx.away));
      }
      let winner = hg > ag ? fx.home : ag > hg ? fx.away : rand(state) < 0.5 ? fx.home : fx.away;
      if (hg === ag && played && (fx.home === me || fx.away === me)) {
        played.events.push({ m: 120, t: `승부차기: ${teamName(state, winner)} 승리`, k: "info" });
      }
      next.push(winner);
      if ((fx.home === me || fx.away === me) && winner !== me) {
        cup.alive = false;
        cup.exitStage = stage;
        addNews(state, `${cup.name} ${stage}에서 탈락했습니다.`);
      }
    }
    cup.teams = shuffle(state, next);
    cup.round++;
    if (cup.teams.length === 1) {
      cup.winner = cup.teams[0];
      if (cup.winner === me) {
        state.trophies.push({ year: state.year, name: cup.name });
        state.player.reputation = clamp(state.player.reputation + (cup.kind === "continental" ? 12 : 5), 0, 100);
        addNews(state, `🏆 ${cup.name} 우승! 트로피를 들어 올렸습니다.`);
      }
    }
    return played;
  }

  function simulateRemainingCups(state) {
    for (const cup of state.season.cups) {
      let guard = 0;
      while (!cup.winner && cup.teams.length > 1 && guard++ < 12) playCupRound(state, cup, "balanced");
    }
  }

  // ---------- 랜덤 이벤트 ----------
  const EVENTS = [
    {
      id: "trainer", when: (s) => !s.youth && s.player.age <= 28,
      title: "개인 트레이너 제안", text: "유명 개인 트레이너가 비시즌 특별 프로그램을 제안했습니다. 비용이 꽤 듭니다.",
      options: [
        { label: "계약한다", apply: (s) => { const p = s.player; const cost = Math.max(2e6, p.wage * 0.08); p.earnings -= cost; p.potential = Math.min(99, p.potential + 1); return "트레이닝이 잘 맞았습니다. 한계가 조금 넓어진 느낌입니다."; } },
        { label: "정중히 거절한다", apply: () => "지금의 루틴을 지키기로 했습니다." },
      ],
    },
    {
      id: "interview", when: () => true,
      title: "언론 인터뷰 요청", text: "경기 후 기자가 이번 시즌 목표를 물어봅니다.",
      options: [
        { label: "겸손하게 답한다", apply: (s) => { s.player.morale = clamp(s.player.morale + 3, 0, 100); return "팀을 먼저 생각하는 모습에 팬들이 호감을 보였습니다."; } },
        { label: "발롱도르가 목표라고 말한다", apply: (s) => { s.player.reputation = clamp(s.player.reputation + 3, 0, 100); s.player.morale = clamp(s.player.morale + (rand(s) < 0.5 ? 5 : -5), 0, 100); return "대담한 발언이 화제가 됐습니다."; } },
      ],
    },
    {
      id: "party", when: (s) => s.player.age >= 18,
      title: "팀 동료의 파티 초대", text: "주말에 팀 동료가 파티에 초대했습니다. 다음 경기까지 시간이 많지 않습니다.",
      options: [
        { label: "참석한다", apply: (s) => { s.player.morale = clamp(s.player.morale + 7, 0, 100); s.player.energy = clamp(s.player.energy - 18, 0, 100); return "동료들과 가까워졌지만 몸이 무겁습니다."; } },
        { label: "집에서 쉰다", apply: (s) => { s.player.energy = clamp(s.player.energy + 8, 0, 100); return "푹 쉬고 다음 경기를 준비합니다."; } },
      ],
    },
    {
      id: "minutes", when: (s) => !s.youth && overall(s.player) - teamStrength(s, myTeamId(s)) > -10,
      title: "감독 면담", text: "출전 시간에 대해 감독과 이야기할 기회가 생겼습니다.",
      options: [
        { label: "더 많은 출전을 요구한다", apply: (s) => {
          const diff = overall(s.player) - teamStrength(s, myTeamId(s));
          if (rand(s) < 0.45 + diff * 0.05) { s.player.selectionBoost = 5; return "감독이 기회를 늘려주겠다고 약속했습니다."; }
          s.player.morale = clamp(s.player.morale - 8, 0, 100); return "감독은 아직 이르다고 답했습니다. 분위기가 어색해졌습니다.";
        } },
        { label: "묵묵히 훈련으로 보여준다", apply: (s) => { s.player.morale = clamp(s.player.morale + 2, 0, 100); return "훈련장에서 증명하기로 했습니다."; } },
      ],
    },
    {
      id: "extra", when: (s) => s.player.injury <= 0,
      title: "추가 개인 훈련", text: "훈련이 끝난 뒤 혼자 남아 더 연습할지 고민됩니다.",
      options: [
        { label: "남아서 연습한다", apply: (s) => {
          const p = s.player; const k = pick(s, p.focus);
          if (overallValue(p) < p.potential) p.attributes[k] = clamp(p.attributes[k] + 1, 10, 99);
          p.energy = clamp(p.energy - 15, 0, 100);
          return `${D.ATTR_LABELS[k]}이(가) 조금 늘었습니다.`;
        } },
        { label: "회복에 집중한다", apply: (s) => { s.player.energy = clamp(s.player.energy + 10, 0, 100); return "컨디션을 끌어올렸습니다."; } },
      ],
    },
    {
      id: "captain", when: (s) => !s.youth && s.player.age >= 26 && s.player.reputation >= 35 && !s.player.captain,
      title: "주장 완장 제안", text: "감독이 다음 경기부터 주장 완장을 맡아달라고 부탁합니다.",
      options: [
        { label: "수락한다", apply: (s) => { s.player.captain = true; s.player.morale = clamp(s.player.morale + 6, 0, 100); s.player.reputation = clamp(s.player.reputation + 4, 0, 100); return "새 주장이 됐습니다."; } },
        { label: "정중히 거절한다", apply: () => "지금은 경기에만 집중하고 싶다고 전했습니다." },
      ],
    },
  ];

  function maybeEvent(state) {
    if (state.phase !== "season" || rand(state) > 0.07) return;
    const pool = EVENTS.filter((e) => e.when(state));
    if (!pool.length) return;
    const e = pick(state, pool);
    state.pendingEvent = { id: e.id, title: e.title, text: e.text, options: e.options.map((o) => o.label) };
  }

  function resolveEvent(state, index) {
    const pe = state.pendingEvent;
    if (!pe) return null;
    const e = EVENTS.find((x) => x.id === pe.id);
    const result = e.options[index].apply(state);
    state.pendingEvent = null;
    addNews(state, `${pe.title}: ${result}`);
    return result;
  }

  // ---------- 시즌 종료 ----------
  function simulateLeague(state, lid) {
    const ids = state.world[lid];
    const table = ids.map(emptyRow);
    for (const round of roundRobin(ids)) for (const fx of round) {
      const [hg, ag] = simScore(state, D.clubMap[fx.home].strength + 1.5, D.clubMap[fx.away].strength);
      applyResult(table, fx.home, fx.away, hg, ag);
    }
    return sortTable(table).map((r) => r.id);
  }

  function finishSeason(state) {
    if (state.phase !== "season") return;
    const season = state.season;
    simulateRemainingCups(state);
    const p = state.player;
    const me = myTeamId(state);
    const table = sortTable(season.table);
    const rank = table.findIndex((r) => r.id === me) + 1;
    const ovrBefore = overall(p);
    const summary = {
      year: state.year, age: p.age, youth: state.youth, club: state.clubId, league: leagueName(state), rank, teams: table.length,
      stats: { ...season.stats }, compStats: JSON.parse(JSON.stringify(season.compStats)), trophies: [], awards: [],
      ballon: null, national: null, ovrBefore, growth: {}, notes: [],
    };
    // 리그 우승
    if (!state.youth && rank === 1) {
      state.trophies.push({ year: state.year, name: `${leagueName(state)} 우승` });
      p.reputation = clamp(p.reputation + 6, 0, 100);
      addNews(state, `🏆 ${leagueName(state)} 우승!`);
    }
    // 다른 리그 결과
    const newTables = {};
    for (const lid of Object.keys(state.world)) {
      newTables[lid] = !state.youth && lid === state.leagueId ? table.map((r) => r.id) : simulateLeague(state, lid);
    }
    // 국가대표
    if (!state.youth) summary.national = nationalTeam(state);
    summary.trophies = state.trophies.filter((t) => t.year === state.year).map((t) => t.name);
    // 개인상, 발롱도르
    if (!state.youth) {
      const res = seasonAwards(state, rank, summary);
      summary.awards = res.awards;
      summary.ballon = res.ballon;
    }
    // 성장
    summary.growth = seasonGrowth(state);
    summary.ovrAfter = overall(p);
    state.bestOverall = Math.max(state.bestOverall, summary.ovrBefore, summary.ovrAfter);
    // 기록 저장
    state.history.push({
      year: state.year, age: p.age, club: state.clubId, youth: state.youth, league: leagueName(state), rank,
      overall: ovrBefore, stats: { ...season.stats }, trophies: summary.trophies, awards: summary.awards.map((a) => a.name),
      ballonRank: summary.ballon ? summary.ballon.rank : null,
    });
    if (!state.clubsPlayed.includes(state.clubId) && !state.youth) state.clubsPlayed.push(state.clubId);
    // 나이, 계약
    p.age++;
    p.yellowCount = 0;
    p.captain = p.captain && rand(state) < 0.8;
    if (!state.youth) state.contractYears = Math.max(0, state.contractYears - 1);
    p.earnings += p.wage;
    // 승강, 다음 시즌 출전권
    state.lastTables = newTables;
    promotions(state, newTables);
    state.leagueId = leagueOfClub(state, state.clubId) || state.leagueId;
    summary.text = state.youth
      ? "유스 시즌을 마쳤습니다. 첫 프로 계약 제안을 비교해 보세요."
      : `${leagueName(state)} ${rank}위 · ${season.stats.apps}경기 ${season.stats.goals}골 ${season.stats.assists}도움`;
    state.offers = makeOffers(state);
    state.summary = summary;
    state.phase = "summary";
    addNews(state, `${state.year} 시즌 종료. ${summary.text}`);
    if (p.age >= RETIRE_AGE) {
      state.offers = [];
      summary.forcedRetire = true;
    }
  }

  function promotions(state, tables) {
    for (const rule of D.PROMOTION) {
      const up = tables[rule.lower].slice(0, rule.count);
      const down = tables[rule.upper].slice(-rule.count);
      state.world[rule.upper] = state.world[rule.upper].filter((id) => !down.includes(id)).concat(up);
      state.world[rule.lower] = state.world[rule.lower].filter((id) => !up.includes(id)).concat(down);
      if (!state.youth) {
        if (up.includes(state.clubId)) addNews(state, `${D.leagueMap[rule.upper].name} 승격! 다음 시즌 더 큰 무대로 나아갑니다.`);
        if (down.includes(state.clubId)) addNews(state, `${D.leagueMap[rule.lower].name} 강등. 다음 시즌 재도전을 준비합니다.`);
      }
    }
  }

  function seasonGrowth(state) {
    const p = state.player;
    const season = state.season;
    const before = { ...p.attributes };
    const ovr0 = overallValue(p);
    const base = ageGrowth(p.age, p.curve);
    const teamGames = Math.max(1, season.days.filter((d) => d.type === "league").length);
    const share = clamp(season.stats.minutes / (teamGames * 90), 0, 1.3);
    const avg = season.stats.apps ? season.stats.ratingSum / season.stats.apps : 6.0;
    let G;
    if (base > 0) {
      const play = state.youth ? 1 : 0.45 + 0.75 * Math.min(1, share);
      const perf = season.stats.apps >= 5 ? clamp((avg - 6.6) * 0.8, -0.6, 1.0) : 0;
      const health = season.injuriesMissed > 8 ? 0.85 : 1;
      G = (base * play + perf) * health;
      const room = p.potential - ovr0;
      G = Math.min(G, Math.max(0, room)) * clamp(room / 4, 0.4, 1);
      // 성인 무대에서 출전이 부족하면 잠재력이 깎임
      if (!state.youth && p.age >= 19 && p.age <= 23 && share < 0.2 && p.potential > ovr0 + 3) {
        const loss = randInt(state, 1, 2);
        p.potential -= loss;
        addNews(state, "출전 기회가 부족해 성장 속도가 더뎌지고 있습니다.");
      }
    } else {
      const fit = (season.trainingCounts.pace || 0) + (season.trainingCounts.physical || 0);
      G = base * (fit > season.days.length * 0.5 ? 0.85 : 1) + (share > 0.6 ? 0.2 : 0);
    }
    G = Math.max(G, -6);
    const weights = D.OVR_WEIGHTS[p.position];
    const keys = Object.keys(D.ATTR_LABELS);
    const totalTrain = Object.values(season.trainingCounts).reduce((a, b) => a + b, 0) || 1;
    const w = {};
    for (const k of keys) {
      if (G >= 0) {
        w[k] = (weights[k] || 0) + (D.visibleAttributes(p.position).includes(k) ? 0.08 : 0.03)
          + (p.focus.includes(k) ? 0.2 : 0) + ((season.trainingCounts[k] || 0) / totalTrain) * 0.3;
      } else {
        const phys = ["pace", "physical", "reflexes"].includes(k) ? 0.35 : 0;
        w[k] = (weights[k] || 0) + phys + 0.03;
      }
    }
    const denom = keys.reduce((a, k) => a + (weights[k] || 0) * w[k], 0);
    const scale = denom > 0 ? G / denom : 0;
    for (const k of keys) p.attributes[k] = clamp(p.attributes[k] + w[k] * scale, 10, 99);
    // 잠재력 상한
    if (overallValue(p) > p.potential && G > 0) {
      const over = overallValue(p) - p.potential;
      for (const k of Object.keys(weights)) p.attributes[k] -= over;
    }
    const diff = {};
    for (const k of D.visibleAttributes(p.position)) {
      const d = Math.floor(p.attributes[k]) - Math.floor(season.startAttributes[k] ?? before[k]);
      if (d) diff[k] = d;
    }
    return diff;
  }

  function nationalTeam(state) {
    const p = state.player;
    const nat = D.nationMap[p.nationality];
    const ovr = overall(p);
    const s = state.season.stats;
    const res = { called: false, caps: 0, goals: 0, tournament: null };
    if (ovr >= nat.strength - 4 + rand(state) * 4 && s.apps >= 10) {
      res.called = true;
      res.caps = randInt(state, 4, 9);
      res.goals = p.position === "GK" ? 0 : poisson(state, res.caps * GOAL_SHARE[p.position] * clamp(1 + (ovr - nat.strength) * 0.05, 0.4, 2));
      state.international.caps += res.caps;
      state.international.goals += res.goals;
      addNews(state, `${nat.flag} ${nat.name} 국가대표 발탁 · A매치 ${res.caps}경기 ${res.goals}골`);
    }
    const next = state.year + 1;
    let tname = null, base = 80;
    if (next % 4 === 2) tname = "FIFA 월드컵";
    else if (next % 4 === 0) { tname = D.CONTINENTAL_TOURNAMENT[nat.confed]; base = { UEFA: 80, CONMEBOL: 80, AFC: 68, CONCACAF: 70 }[nat.confed]; }
    if (tname && res.called) {
      const str = nat.strength + Math.max(0, ovr - nat.strength) * 0.3;
      const stages = ["조별리그 탈락", "16강", "8강", "4강", "준우승", "우승"];
      let reached = 0;
      if (rand(state) < clamp(0.55 + (str - base + 4) * 0.035, 0.2, 0.93)) {
        reached = 1;
        while (reached < 5 && rand(state) < clamp(0.5 + (str - base - 2) * 0.04, 0.15, 0.78)) reached++;
      }
      const games = [3, 4, 5, 6, 7, 7][reached];
      const goals = p.position === "GK" ? 0 : poisson(state, games * GOAL_SHARE[p.position] * clamp(1 + (ovr - nat.strength) * 0.05, 0.4, 2));
      res.tournament = { name: `${next} ${tname}`, short: tname, result: stages[reached], games, goals, won: reached === 5 };
      state.international.caps += games;
      state.international.goals += goals;
      state.international.tournaments.push(res.tournament);
      if (reached === 5) {
        state.trophies.push({ year: state.year, name: `${next} ${tname}` });
        p.reputation = clamp(p.reputation + 15, 0, 100);
        addNews(state, `🏆 ${nat.name}, ${next} ${tname} 우승! ${p.name} ${goals}골.`);
      } else {
        addNews(state, `${nat.name}, ${next} ${tname} ${stages[reached]}. ${p.name} ${games}경기 ${goals}골.`);
      }
    }
    return res;
  }

  function seasonAwards(state, rank, summary) {
    const p = state.player;
    const s = state.season.stats;
    const ls = state.season.compStats[leagueName(state)] || emptyStats();
    const R = state.season.schedule.length;
    const lf = leagueFactor(state.leagueId);
    const ovr = overall(p);
    const avg = s.apps ? s.ratingSum / s.apps : 0;
    const lavg = ls.apps ? ls.ratingSum / ls.apps : 0;
    const awards = [];
    const lname = leagueName(state);
    const give = (name) => { awards.push({ year: state.year, name }); state.awards.push({ year: state.year, name }); p.reputation = clamp(p.reputation + 3, 0, 100); };
    const rivalGoals = Math.max(8, Math.round(R * (0.5 + rand(state) * 0.3)));
    if (ls.goals >= rivalGoals) give(`${lname} 득점왕`);
    const rivalAssists = Math.max(6, Math.round(R * (0.28 + rand(state) * 0.15)));
    if (ls.assists >= rivalAssists) give(`${lname} 도움왕`);
    const mvpScore = (lavg - 6.9) * 2.5 + (ls.goals + ls.assists * 0.7) / Math.max(1, R) * 3 + (rank === 1 ? 0.8 : rank <= 3 ? 0.3 : 0);
    if (ls.apps >= R * 0.6 && mvpScore > 2.0 + rand(state) * 1.2) give(`${lname} MVP`);
    if (p.age <= 22 && ls.apps >= R * 0.5 && lavg >= 6.9 && rand(state) < 0.5 + (lavg - 6.9)) give(`${lname} 영플레이어상`);
    if (ls.apps >= R * 0.6 && lavg >= 7.15) give(`${lname} 시즌 베스트 11`);

    // 발롱도르
    let ballon = null;
    if (s.apps >= 15) {
      const form = (avg - 7.0) * 2.2;
      let output;
      if (p.position === "GK") output = clamp((s.cleanSheets / s.apps - 0.35) * 4, -1, 1.5);
      else {
        const E = { ST: 0.55, LW: 0.5, RW: 0.5, CAM: 0.45, CM: 0.3, CDM: 0.18, LB: 0.18, RB: 0.18, CB: 0.12 }[p.position];
        output = clamp(((s.goals + 0.7 * s.assists) / s.apps / E - 1) * 1.2, -1, 2);
      }
      const teamGames = Math.max(1, state.season.days.length);
      const part = clamp(s.apps / teamGames, 0.3, 1);
      let trophy = 0;
      for (const t of state.trophies.filter((t) => t.year === state.year)) {
        if (t.name.includes("챔피언스리그 엘리트")) trophy += 0.4 * part;
        else if (t.name.includes("챔피언스리그")) trophy += 1.6 * part;
        else if (t.name.includes("월드컵")) trophy += 2.2;
        else if (/유로|코파 아메리카/.test(t.name)) trophy += 1.3;
        else if (/아시안컵|골드컵/.test(t.name)) trophy += 0.5;
        else if (t.name.endsWith("우승")) trophy += 0.9 * lf * part;
        else trophy += 0.25 * lf * part;
      }
      // 약한 리그의 활약은 덜 인정받음
      const score = 1.2 + (form + output) * Math.min(1, lf) + trophy + (ovr - 82) * 0.18 + (lf - 1) * 2.5;
      const rival = 3.8 + 1.5 * rand(state);
      if (score >= rival) {
        ballon = { rank: 1, score };
        give("발롱도르");
        p.reputation = clamp(p.reputation + 10, 0, 100);
        addNews(state, `🏅 ${p.name}, 발롱도르 수상! 세계 최고의 선수로 인정받았습니다.`);
      } else {
        const gap = rival - score;
        if (gap < 4.8) {
          ballon = { rank: 2 + Math.floor(gap * 6), score };
          addNews(state, `발롱도르 ${ballon.rank}위. 세계 최고에 한 걸음씩 다가가고 있습니다.`);
        }
      }
    }
    for (const a of awards) if (a.name !== "발롱도르") addNews(state, `🎖️ ${a.name} 수상!`);
    return { awards, ballon };
  }

  // ---------- 이적, 계약 ----------
  const ROLE_LABEL = { key: "핵심 선수", starter: "주전 경쟁", rotation: "로테이션", prospect: "유망주" };
  function roleFor(diff) {
    return diff >= 3 ? "key" : diff >= -4 ? "starter" : diff >= -10 ? "rotation" : "prospect";
  }
  function wageFor(state, club, role) {
    const mult = { key: 1.4, starter: 1, rotation: 0.75, prospect: 0.45 }[role];
    return Math.round((3e7 * 1.15 ** (club.strength - 55) * mult * (1 + state.player.reputation / 200)) / 1e5) * 1e5;
  }
  function marketValue(p) {
    const ovr = overall(p);
    const ageM = p.age <= 21 ? 1.8 : p.age <= 24 ? 1.5 : p.age <= 27 ? 1.2 : p.age <= 30 ? 0.8 : 0.4;
    return Math.round((1e8 * 1.18 ** (ovr - 55) * ageM) / 1e6) * 1e6;
  }

  function makeOffer(state, clubId, kind) {
    const club = D.clubMap[clubId];
    const role = roleFor(overall(state.player) - club.strength);
    return {
      clubId, kind, role, roleLabel: ROLE_LABEL[role],
      league: D.leagueMap[leagueOfClub(state, clubId) || club.league].name,
      wage: wageFor(state, club, role), years: kind === "stay" ? state.contractYears : randInt(state, 2, 4),
    };
  }

  function makeOffers(state) {
    const p = state.player;
    const ovr = overall(p);
    const country = countryOf(state);
    const offers = [];
    const cur = D.clubMap[state.clubId];
    if (!state.youth && state.contractYears > 0) offers.push(makeOffer(state, state.clubId, "stay"));
    else if (ovr >= cur.strength - (state.youth ? 22 : 14)) offers.push(makeOffer(state, state.clubId, state.youth ? "first" : "renew"));
    const reach = ovr + 5 + p.reputation / 20;
    const floor = ovr - (state.youth ? 4 : 12);
    const pool = D.clubs.filter((c) => c.id !== state.clubId && c.strength <= reach && c.strength >= floor);
    const domestic = shuffle(state, pool.filter((c) => c.country === country)).slice(0, state.youth ? 3 : 2);
    const foreignPool = pool.filter((c) => c.country !== country).sort((a, b) => b.strength - a.strength);
    const foreign = state.youth && ovr < 52 ? [] : shuffle(state, foreignPool.slice(0, 12)).slice(0, 3);
    for (const c of [...domestic, ...foreign]) offers.push(makeOffer(state, c.id, "transfer"));
    if (offers.length === 0) {
      const weakest = [...D.clubs].sort((a, b) => a.strength - b.strength).slice(0, 6);
      for (const c of shuffle(state, weakest).slice(0, 2)) offers.push(makeOffer(state, c.id, "transfer"));
    }
    return offers;
  }

  function acceptOffer(state, index) {
    if (state.phase !== "summary") return;
    const o = state.offers[index];
    if (!o) return;
    const p = state.player;
    if (o.kind !== "stay") {
      p.wage = o.wage;
      state.contractYears = o.years;
    }
    if (o.clubId !== state.clubId) {
      const fee = state.youth || state.contractYears === 0 ? 0 : marketValue(p);
      addNews(state, `✍️ ${D.clubMap[o.clubId].name} 이적 확정 · ${o.years}년 계약 (${o.roleLabel})${fee ? ` · 이적료 ${money(fee)}` : ""}`);
      p.captain = false;
      p.morale = clamp(p.morale + 8, 0, 100);
    } else if (o.kind !== "stay") {
      addNews(state, `✍️ ${D.clubMap[o.clubId].name}와 ${o.years}년 ${state.youth ? "첫 프로 계약" : "재계약"} (${o.roleLabel})`);
    }
    state.clubId = o.clubId;
    state.leagueId = leagueOfClub(state, o.clubId);
    state.youth = false;
    state.year++;
    state.offers = [];
    state.summary = null;
    p.energy = 100;
    p.injury = 0;
    p.suspension = 0;
    startSeason(state);
  }

  // ---------- 은퇴 ----------
  function retire(state) {
    if (state.phase === "retired") return;
    if (state.phase === "season" && state.season.stats.apps > 0) {
      state.history.push({
        year: state.year, age: state.player.age, club: state.clubId, youth: state.youth, league: leagueName(state), rank: null,
        overall: overall(state.player), stats: { ...state.season.stats }, trophies: [], awards: [], ballonRank: null,
      });
    }
    state.phase = "retired";
    addNews(state, `${state.player.name}, 그라운드를 떠나다. 당신의 축구 인생은 기록으로 남습니다.`);
  }

  function careerTotals(state) {
    const t = emptyStats();
    for (const h of state.history) if (!h.youth) addStats(t, h.stats);
    return t;
  }

  function careerRecord(state) {
    const t = careerTotals(state);
    const ballon = state.awards.filter((a) => a.name === "발롱도르").length;
    return {
      id: state.id, name: state.player.name, position: state.player.position, nationality: state.player.nationality,
      ballon, bestOverall: state.bestOverall, awards: state.awards.length, goals: t.goals, assists: t.assists, apps: t.apps,
      trophies: state.trophies.length, caps: state.international.caps, lastClub: D.clubMap[state.clubId].name,
      retiredAge: state.player.age, date: new Date().toISOString().slice(0, 10),
    };
  }
  // 랭킹 비교: 발롱도르 > 최고 오버롤 > 개인상 > 공격포인트
  function compareRecords(a, b) {
    return b.ballon - a.ballon || b.bestOverall - a.bestOverall || b.awards - a.awards || b.goals + b.assists - (a.goals + a.assists);
  }

  // ---------- 기타 ----------
  function addNews(state, text) {
    state.news.unshift({ year: state.year, text });
    state.news = state.news.slice(0, 150);
  }
  function money(v) {
    const neg = v < 0; v = Math.abs(v);
    const s = v >= 1e8 ? `${(v / 1e8).toFixed(1)}억 원` : v >= 1e4 ? `${Math.round(v / 1e4).toLocaleString("ko-KR")}만 원` : `${Math.round(v)}원`;
    return (neg ? "-" : "") + s;
  }
  function fame(state) {
    const recent = state.trophies.filter((t) => t.year >= state.year - 3).length * 6 + state.awards.filter((a) => a.year >= state.year - 3).length * 5;
    return Math.round(clamp(Math.max(0, (overall(state.player) - 62) * 1.5) + Math.min(45, recent) + 0.1 * state.player.reputation, 0, 100));
  }
  function fameLabel(v) {
    return v >= 85 ? "월드 스타" : v >= 70 ? "스타 플레이어" : v >= 50 ? "이름난 선수" : v >= 30 ? "주목받는 선수" : "무명";
  }

  function serialize(state) { return JSON.stringify(state); }
  function deserialize(text) {
    const s = JSON.parse(text);
    if (!s || s.version !== SAVE_VERSION || !s.player || !s.season) throw new Error("올바른 저장 파일이 아닙니다.");
    return s;
  }

  window.Engine = {
    candidates, createCareer, advance, resolveEvent, acceptOffer, retire, finishSeason,
    overall, overallValue, potentialHint, teamName, teamStrength, myTeamId, leagueName, sortTable,
    careerTotals, careerRecord, compareRecords, money, fame, fameLabel, marketValue, serialize, deserialize,
    TRAININGS, TACTICS, ROLE_LABEL, START_YEAR,
  };
})();
