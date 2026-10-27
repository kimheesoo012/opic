# 格闘家人生シミュレーター (Fighter Life)

휴대폰 세로 화면용 격투가 인생 시뮬레이션 게임입니다. 빌드된 정적 파일만 들어 있고, 서버 없이 브라우저에서 동작합니다.

- 주소: `https://kimheesoo012.github.io/opic/fighter-life/`
- `index.html`: 게임 본체(JS·CSS 내장)
- `manifest.webmanifest`, `sw.js`, `icon-*.png`: 홈 화면 추가와 오프라인 실행용(PWA)
- 서비스 워커는 이 폴더 범위에서만 동작하고, 자기 캐시(`fls-` 접두사)만 지웁니다. 같은 도메인의 다른 앱(opic-app 등) 캐시는 건드리지 않습니다.
- 글꼴은 Google Fonts(DotGothic16, Zen Kaku Gothic New, SIL OFL 1.1)를 불러옵니다. 음악·효과음은 Web Audio API로 그 자리에서 합성합니다.
