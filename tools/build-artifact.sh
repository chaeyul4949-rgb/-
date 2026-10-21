#!/bin/sh
# 한 파일짜리 HTML(링크 공유용)로 묶습니다: sh tools/build-artifact.sh 출력경로
OUT="${1:-dist/balloon-dream.html}"
mkdir -p "$(dirname "$OUT")"
{
  echo '<title>발롱드림</title>'
  echo '<meta name="claude:viewport-fit-sides" content="cover">'
  echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800;900&display=swap">'
  echo '<style>'; cat css/style.css; echo '</style>'
  echo '<div id="app"></div>'
  echo '<input type="file" id="importFile" accept=".json,application/json,text/plain" hidden>'
  for f in js/data.js js/engine.js js/app.js; do echo '<script>'; cat "$f"; echo '</script>'; done
} > "$OUT"
echo "built $OUT"
