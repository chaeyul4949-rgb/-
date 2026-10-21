// 게임 데이터: 포지션, 능력치, 국가, 리그, 클럽
// 클럽 strength 는 팀 전력(오버롤 기준)입니다. 숫자만 바꾸면 밸런스가 바뀌어요.
(function () {
  const POSITIONS = [
    { id: "ST", label: "스트라이커", group: "공격" },
    { id: "LW", label: "왼쪽 윙어", group: "공격" },
    { id: "RW", label: "오른쪽 윙어", group: "공격" },
    { id: "CAM", label: "공격형 미드필더", group: "미드필드" },
    { id: "CM", label: "중앙 미드필더", group: "미드필드" },
    { id: "CDM", label: "수비형 미드필더", group: "미드필드" },
    { id: "LB", label: "왼쪽 풀백", group: "수비" },
    { id: "CB", label: "센터백", group: "수비" },
    { id: "RB", label: "오른쪽 풀백", group: "수비" },
    { id: "GK", label: "골키퍼", group: "골키퍼" },
  ];

  const ATTR_LABELS = {
    pace: "스피드",
    shooting: "슈팅",
    passing: "패스",
    dribbling: "드리블",
    defending: "수비",
    physical: "피지컬",
    reflexes: "반사 신경",
    handling: "볼 처리",
    positioning: "위치 선정",
    kicking: "골킥",
  };

  // 포지션별 오버롤 가중치 (합계 1)
  const OVR_WEIGHTS = {
    ST: { shooting: 0.4, pace: 0.15, physical: 0.15, dribbling: 0.15, positioning: 0.15 },
    LW: { pace: 0.25, dribbling: 0.3, shooting: 0.2, passing: 0.25 },
    RW: { pace: 0.25, dribbling: 0.3, shooting: 0.2, passing: 0.25 },
    CAM: { passing: 0.35, dribbling: 0.3, shooting: 0.2, positioning: 0.15 },
    CM: { passing: 0.4, dribbling: 0.15, physical: 0.2, defending: 0.15, positioning: 0.1 },
    CDM: { defending: 0.35, passing: 0.25, physical: 0.25, positioning: 0.15 },
    LB: { pace: 0.25, defending: 0.3, passing: 0.2, physical: 0.25 },
    CB: { defending: 0.4, physical: 0.3, positioning: 0.3 },
    RB: { pace: 0.25, defending: 0.3, passing: 0.2, physical: 0.25 },
    GK: { reflexes: 0.35, handling: 0.3, positioning: 0.25, kicking: 0.1 },
  };

  // 화면에 보이는 6개 능력치
  function visibleAttributes(pos) {
    return pos === "GK"
      ? ["reflexes", "handling", "positioning", "kicking", "physical", "passing"]
      : ["pace", "shooting", "passing", "dribbling", "defending", "physical"];
  }

  // 플레이 스타일 (후보 카드 성향)
  const STYLES = {
    finisher: { name: "피니셔", emphasis: { shooting: 1, positioning: 0.6 } },
    speed: { name: "스피드형", emphasis: { pace: 1, dribbling: 0.4 } },
    power: { name: "파워형", emphasis: { physical: 1, defending: 0.3 } },
    dribbler: { name: "드리블러", emphasis: { dribbling: 1, pace: 0.4 } },
    playmaker: { name: "플레이메이커", emphasis: { passing: 1, dribbling: 0.3 } },
    defender: { name: "수비형", emphasis: { defending: 1, positioning: 0.4 } },
    reflex: { name: "반응형", emphasis: { reflexes: 1 } },
    safeHands: { name: "안정형", emphasis: { handling: 1, positioning: 0.4 } },
    buildUp: { name: "빌드업형", emphasis: { kicking: 1, passing: 0.6 } },
  };
  const POSITION_STYLES = {
    ST: ["finisher", "speed", "power", "dribbler"],
    LW: ["speed", "dribbler", "finisher", "playmaker"],
    RW: ["speed", "dribbler", "finisher", "playmaker"],
    CAM: ["playmaker", "dribbler", "finisher", "speed"],
    CM: ["playmaker", "power", "defender", "dribbler"],
    CDM: ["defender", "power", "playmaker"],
    LB: ["speed", "defender", "playmaker", "power"],
    RB: ["speed", "defender", "playmaker", "power"],
    CB: ["defender", "power", "playmaker", "speed"],
    GK: ["reflex", "safeHands", "buildUp"],
  };

  // 숨겨진 잠재력 등급
  const POTENTIAL_GRADES = [
    { grade: "C", min: 62, max: 70, weight: 26 },
    { grade: "B", min: 70, max: 78, weight: 36 },
    { grade: "A", min: 78, max: 85, weight: 25 },
    { grade: "S", min: 85, max: 92, weight: 11 },
    { grade: "SS", min: 92, max: 97, weight: 2 },
  ];

  // 성장 곡선 (숨겨진 성장 특성)
  const GROWTH_CURVES = {
    early: { name: "조기 완성형", shift: -1.5 },
    normal: { name: "표준형", shift: 0 },
    late: { name: "대기만성형", shift: 2 },
  };

  const NATIONS = [
    { id: "kr", name: "대한민국", strength: 72, confed: "AFC", flag: "🇰🇷" },
    { id: "jp", name: "일본", strength: 75, confed: "AFC", flag: "🇯🇵" },
    { id: "sa", name: "사우디아라비아", strength: 66, confed: "AFC", flag: "🇸🇦" },
    { id: "en", name: "잉글랜드", strength: 84, confed: "UEFA", flag: "🏴" },
    { id: "es", name: "스페인", strength: 86, confed: "UEFA", flag: "🇪🇸" },
    { id: "fr", name: "프랑스", strength: 86, confed: "UEFA", flag: "🇫🇷" },
    { id: "de", name: "독일", strength: 83, confed: "UEFA", flag: "🇩🇪" },
    { id: "it", name: "이탈리아", strength: 81, confed: "UEFA", flag: "🇮🇹" },
    { id: "pt", name: "포르투갈", strength: 83, confed: "UEFA", flag: "🇵🇹" },
    { id: "nl", name: "네덜란드", strength: 82, confed: "UEFA", flag: "🇳🇱" },
    { id: "be", name: "벨기에", strength: 79, confed: "UEFA", flag: "🇧🇪" },
    { id: "br", name: "브라질", strength: 84, confed: "CONMEBOL", flag: "🇧🇷" },
    { id: "ar", name: "아르헨티나", strength: 86, confed: "CONMEBOL", flag: "🇦🇷" },
    { id: "us", name: "미국", strength: 74, confed: "CONCACAF", flag: "🇺🇸" },
  ];

  const CONTINENTAL_TOURNAMENT = {
    UEFA: "UEFA 유로",
    CONMEBOL: "코파 아메리카",
    AFC: "AFC 아시안컵",
    CONCACAF: "CONCACAF 골드컵",
  };

  // 리그: [id, 이름, 국가, 티어, 클럽 목록 [이름, 전력]]
  const LEAGUE_DEFS = [
    ["en.1", "프리미어리그", "en", 1, [
      ["맨체스터 시티", 86], ["아스널", 86], ["리버풀", 86], ["첼시", 82], ["맨체스터 유나이티드", 79],
      ["토트넘", 80], ["뉴캐슬", 80], ["아스톤 빌라", 79], ["브라이턴", 76], ["노팅엄 포레스트", 76],
      ["본머스", 75], ["풀럼", 75], ["크리스털 팰리스", 76], ["브렌트퍼드", 74], ["웨스트햄", 74],
      ["에버턴", 73], ["울버햄튼", 72], ["리즈 유나이티드", 70], ["번리", 69], ["선덜랜드", 70],
    ]],
    ["en.2", "챔피언십", "en", 2, [
      ["레스터 시티", 69], ["입스위치", 68], ["사우샘프턴", 68], ["셰필드 유나이티드", 66], ["미들즈브러", 66],
      ["웨스트브로미치", 65], ["노리치 시티", 65], ["코번트리", 66], ["왓퍼드", 64], ["스토크 시티", 63],
      ["헐 시티", 62], ["브리스톨 시티", 63], ["밀월", 62], ["블랙번", 62], ["프레스턴", 62],
      ["QPR", 61], ["스완지 시티", 61], ["포츠머스", 60], ["더비 카운티", 60], ["셰필드 웬즈데이", 59],
    ]],
    ["es.1", "라리가", "es", 1, [
      ["레알 마드리드", 87], ["바르셀로나", 86], ["아틀레티코 마드리드", 83], ["아틀레틱 빌바오", 78], ["비야레알", 78],
      ["레알 소시에다드", 76], ["레알 베티스", 77], ["세비야", 74], ["지로나", 73], ["발렌시아", 73],
      ["셀타 비고", 73], ["오사수나", 72], ["라요 바예카노", 72], ["마요르카", 71], ["헤타페", 71],
      ["에스파뇰", 70], ["알라베스", 70], ["엘체", 68], ["레반테", 67], ["레알 오비에도", 67],
    ]],
    ["de.1", "분데스리가", "de", 1, [
      ["바이에른 뮌헨", 87], ["레버쿠젠", 81], ["도르트문트", 81], ["라이프치히", 80], ["프랑크푸르트", 77],
      ["슈투트가르트", 77], ["프라이부르크", 74], ["볼프스부르크", 74], ["묀헨글라트바흐", 73], ["호펜하임", 73],
      ["마인츠", 72], ["우니온 베를린", 72], ["베르더 브레멘", 71], ["아우크스부르크", 70], ["쾰른", 69],
      ["함부르크", 69], ["하이덴하임", 68], ["장크트파울리", 68],
    ]],
    ["it.1", "세리에 A", "it", 1, [
      ["인테르", 84], ["나폴리", 82], ["유벤투스", 81], ["AC 밀란", 81], ["아탈란타", 80],
      ["AS 로마", 79], ["라치오", 77], ["볼로냐", 76], ["피오렌티나", 76], ["코모", 74],
      ["토리노", 72], ["우디네세", 71], ["제노아", 70], ["칼리아리", 69], ["사수올로", 69],
      ["레체", 68], ["파르마", 68], ["엘라스 베로나", 68], ["크레모네세", 67], ["피사", 67],
    ]],
    ["fr.1", "리그 1", "fr", 1, [
      ["파리 생제르맹", 86], ["마르세유", 79], ["모나코", 79], ["릴", 77], ["리옹", 77],
      ["니스", 74], ["랑스", 74], ["렌", 73], ["스트라스부르", 73], ["툴루즈", 71],
      ["브레스트", 70], ["낭트", 69], ["오세르", 68], ["앙제", 67], ["르아브르", 67],
      ["로리앙", 66], ["파리 FC", 66], ["메스", 65],
    ]],
    ["nl.1", "에레디비시", "nl", 1, [
      ["PSV", 78], ["아약스", 77], ["페예노르트", 77], ["AZ 알크마르", 74], ["트벤테", 72],
      ["위트레흐트", 71], ["헤이렌베인", 68], ["고어헤드 이글스", 67], ["NEC 네이메헌", 67], ["스파르타 로테르담", 65],
      ["포르투나 시타르트", 65], ["헤라클레스", 64], ["PEC 즈볼러", 64], ["흐로닝언", 64], ["엑셀시오르", 63],
      ["NAC 브레다", 63], ["폴렌담", 62], ["텔스타", 62],
    ]],
    ["pt.1", "리가 포르투갈", "pt", 1, [
      ["벤피카", 80], ["스포르팅 CP", 80], ["FC 포르투", 80], ["브라가", 75], ["비토리아 기마랑이스", 71],
      ["파말리캉", 69], ["모레이렌스", 67], ["리우 아브", 67], ["질 비센트", 67], ["카사 피아", 66],
      ["에스토릴", 66], ["아로카", 65], ["산타 클라라", 65], ["나시오날", 64], ["톤델라", 63],
      ["알베르카", 63], ["AVS", 62], ["에스트렐라 아마도라", 63],
    ]],
    ["sa.1", "사우디 프로리그", "sa", 1, [
      ["알 힐랄", 78], ["알 나스르", 78], ["알 이티하드", 77], ["알 아흘리", 77], ["알 카디시야", 73],
      ["알 이티파크", 71], ["알 샤바브", 70], ["알 타아원", 69], ["네옴 SC", 68], ["알 쿨루드", 66],
      ["알 파테흐", 66], ["알 하젬", 65],
    ]],
    ["jp.1", "J1리그", "jp", 1, [
      ["비셀 고베", 67], ["가시마 앤틀러스", 67], ["산프레체 히로시마", 67], ["가시와 레이솔", 66], ["마치다 젤비아", 66],
      ["우라와 레즈", 65], ["가와사키 프론탈레", 66], ["교토 상가", 65], ["감바 오사카", 64], ["FC 도쿄", 64],
      ["세레소 오사카", 64], ["나고야 그램퍼스", 63], ["아비스파 후쿠오카", 63], ["시미즈 S펄스", 62], ["파지아노 오카야마", 61],
      ["요코하마 F. 마리노스", 64], ["도쿄 베르디", 61], ["쇼난 벨마레", 60], ["알비렉스 니가타", 60], ["요코하마 FC", 60],
    ]],
    ["kr.1", "K리그1", "kr", 1, [
      ["전북 현대", 66], ["울산 HD", 65], ["포항 스틸러스", 64], ["FC 서울", 64], ["강원 FC", 62],
      ["김천 상무", 63], ["대전 하나시티즌", 63], ["광주 FC", 61], ["제주 SK", 61], ["수원 FC", 60],
      ["FC 안양", 60], ["대구 FC", 59],
    ]],
    ["kr.2", "K리그2", "kr", 2, [
      ["수원 삼성", 58], ["인천 유나이티드", 59], ["부산 아이파크", 56], ["전남 드래곤즈", 56], ["서울 이랜드", 56],
      ["부천 FC", 55], ["성남 FC", 55], ["경남 FC", 53], ["충남아산", 53], ["김포 FC", 54],
      ["충북청주", 52], ["천안시티", 51], ["안산 그리너스", 50], ["화성 FC", 50],
    ]],
  ];

  // 승강 규칙: 상위 리그 하위 n팀 <-> 하위 리그 상위 n팀
  const PROMOTION = [
    { upper: "en.1", lower: "en.2", count: 3 },
    { upper: "kr.1", lower: "kr.2", count: 2 },
  ];

  // 국내 컵 이름
  const DOMESTIC_CUPS = {
    en: "FA컵", es: "코파 델 레이", de: "DFB 포칼", it: "코파 이탈리아", fr: "쿠프 드 프랑스",
    nl: "KNVB 베커", pt: "타사 드 포르투갈", sa: "킹스컵", jp: "일왕배", kr: "코리아컵",
  };

  // 대륙 클럽 대회 출전권 (전 시즌 순위 기준)
  const CONTINENTAL = [
    {
      id: "ucl", name: "UEFA 챔피언스리그", short: "UCL",
      slots: { "en.1": 3, "es.1": 3, "de.1": 3, "it.1": 3, "fr.1": 2, "pt.1": 1, "nl.1": 1 },
    },
    {
      id: "acle", name: "AFC 챔피언스리그 엘리트", short: "ACLE",
      slots: { "sa.1": 3, "jp.1": 3, "kr.1": 2 },
    },
  ];

  const leagues = [];
  const clubs = [];
  for (const [id, name, country, tier, list] of LEAGUE_DEFS) {
    const clubIds = [];
    list.forEach(([cname, strength], i) => {
      const cid = `${id}.${i}`;
      clubs.push({ id: cid, name: cname, strength, country, league: id });
      clubIds.push(cid);
    });
    leagues.push({ id, name, country, tier, clubIds });
  }
  const clubMap = Object.fromEntries(clubs.map((c) => [c.id, c]));
  const leagueMap = Object.fromEntries(leagues.map((l) => [l.id, l]));
  const nationMap = Object.fromEntries(NATIONS.map((n) => [n.id, n]));
  // 클럽이 있는 시작 국가
  const START_COUNTRIES = [...new Set(leagues.map((l) => l.country))];

  window.GameData = {
    POSITIONS, ATTR_LABELS, OVR_WEIGHTS, visibleAttributes, STYLES, POSITION_STYLES,
    POTENTIAL_GRADES, GROWTH_CURVES, NATIONS, nationMap, CONTINENTAL_TOURNAMENT,
    leagues, leagueMap, clubs, clubMap, PROMOTION, DOMESTIC_CUPS, CONTINENTAL, START_COUNTRIES,
  };
})();
