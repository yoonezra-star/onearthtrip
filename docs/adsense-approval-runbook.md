# On Earth Trip — AdSense 승인 실행 체크리스트

최종 점검 기준일: 2026-08-26

이 문서는 자동 CI가 확인할 수 없는 Cloudflare, Google Search Console, Google AdSense 계정 내부 작업을 승인 직전에 빠뜨리지 않기 위한 운영 체크리스트입니다.

## 1. 저장소·빌드 자동 게이트

아래 항목은 GitHub Actions `Validate site`에서 자동 검사합니다.

- 프로덕션 의존성 high 이상 취약점 감사
- 내부 링크 검사
- 이미지 경로·크기 검사
- 핵심 글 SEO 메타 검사
- 정적 사이트맵 커버리지 검사
- AdSense 콘텐츠 준비 감사
- Astro 정적 빌드
- 대표 심사 동선 15개 페이지 검사
- 광고 제외 페이지 경계 검사
- 최종 AdSense 승인 준비 게이트

모든 항목이 성공한 최신 `main`만 배포 대상으로 사용합니다.

## 2. Cloudflare 배포·도메인 확인 — 수동

Canonical 기준 도메인은 `https://www.onearthtrip.com`입니다.

- [ ] Cloudflare Pages 프로젝트의 Custom domains에 `www.onearthtrip.com`이 정상 연결돼 있다.
- [ ] `https://onearthtrip.com/*` 요청을 `https://www.onearthtrip.com/*`로 301 리디렉션한다.
- [ ] 리디렉션에서 원래 path와 query string을 보존한다.
- [ ] 기본 `*.pages.dev` 주소가 공개 접근 가능하다면 custom domain으로 301 리디렉션한다.
- [ ] `https://www.onearthtrip.com/`이 200으로 응답한다.
- [ ] `https://onearthtrip.com/example`이 동일 경로의 `https://www.onearthtrip.com/example`로 301 이동한다.
- [ ] 대표 `.html` 레거시 URL이 확장자 없는 canonical URL로 301 이동한다.

주의: Cloudflare Pages의 `_redirects` 파일은 domain-level redirect를 지원하지 않으므로 apex → www 통일은 Cloudflare Redirect Rules 또는 Bulk Redirects에서 설정합니다.

## 3. Google Search Console — 수동

- [ ] `onearthtrip.com` Domain property 소유권이 확인돼 있다.
- [ ] Sitemaps에 `https://www.onearthtrip.com/sitemap-index.xml`을 제출한다.
- [ ] 제출한 sitemap 상태가 성공이고 Google이 읽을 수 있다.
- [ ] URL Inspection의 Live Test에서 홈이 접근 가능하다.
- [ ] 아래 대표 URL을 우선 검사한다.
  - `https://www.onearthtrip.com/`
  - `https://www.onearthtrip.com/reading-guide`
  - `https://www.onearthtrip.com/life`
  - `https://www.onearthtrip.com/culture`
  - `https://www.onearthtrip.com/field-notes`
  - `https://www.onearthtrip.com/trip-checklist`
  - `https://www.onearthtrip.com/2026/08/abu-dhabi-3-day-itinerary`
  - `https://www.onearthtrip.com/2026/08/sheikh-zayed-grand-mosque-visit-guide`
  - `https://www.onearthtrip.com/2026/04/blog-post_11`
  - `https://www.onearthtrip.com/author`
- [ ] 새 사이트라면 대표 페이지부터 제한적으로 Request indexing 한다.
- [ ] Page indexing 보고서에서 sitemap 기준 색인 증가 여부를 확인한다.

Search Console에 이미 sitemap이 알려져 있더라도 직접 제출하면 Google의 sitemap 읽기 상태를 보고서에서 추적할 수 있습니다.

## 4. Google AdSense 사이트 등록 — 수동

- [ ] AdSense > Sites > New site에서 `onearthtrip.com`을 등록한다.
- [ ] `/page`, query string, `www` 같은 서브도메인 주소를 사이트 등록값으로 사용하지 않는다.
- [ ] 사이트 상태가 `Requires review`인지 확인한다.
- [ ] 현재 페이지 `<head>`의 AdSense code snippet이 계정의 publisher ID와 일치하는지 확인한다.
- [ ] `https://www.onearthtrip.com/ads.txt`가 열리고 publisher ID가 일치하는지 확인한다.
- [ ] 검토 요청을 제출한다.

현재 소스는 검색·문의·개인정보·약관·About·Author·편집원칙·404 같은 기능/신뢰 페이지에서는 AdSense 로더를 제외하고, 콘텐츠 표면에는 사이트 검증용 로더를 유지합니다.

## 5. 승인 대기 중 운영 원칙

- 신규 글을 대량으로 한 번에 추가하지 않는다.
- 현재 공식 정보가 바뀐 기존 글의 수정과 직접 경험 자료 연결을 우선한다.
- 빈 페이지, 테스트 페이지, 자동 생성형 얇은 페이지를 만들지 않는다.
- Search Console 오류가 나오면 새 콘텐츠보다 크롤링·canonical·redirect 문제를 먼저 해결한다.
- 승인 결과가 나오기 전 광고 위치를 과도하게 추가하지 않는다.

## 6. 승인 후 광고 게재 전

- EEA·영국·스위스 사용자에게 광고를 게재한다면 Google 요구사항에 맞는 인증 CMP/Privacy & messaging 설정을 완료한다.
- 자동 광고를 켜기 전 모바일에서 본문 가림, 메뉴 방해, 과도한 광고 밀도를 점검한다.
- `/search`, 정책·문의·운영자 페이지의 광고 제외 정책은 유지한다.

## 신청 판단

다음 세 조건이 모두 충족되면 신청 단계로 넘어갑니다.

1. 최신 `main`의 모든 CI 게이트가 성공한다.
2. Cloudflare에서 canonical 도메인과 리디렉션이 실제 응답으로 확인된다.
3. Search Console Live Test에서 홈과 대표 콘텐츠 URL이 Google에 접근 가능하다.
