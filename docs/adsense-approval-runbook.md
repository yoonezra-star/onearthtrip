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
- 대표 심사 동선 15개 페이지 + `/search` 색인 경계 검사
- 광고 제외 페이지 경계 검사
- 최종 AdSense 승인 준비 게이트

대표 심사 동선은 홈, 핵심 허브, 대표 실용 가이드, 대표 field-note뿐 아니라 About, Author, Editorial Policy, Contact, Privacy, Terms까지 실제 `dist` HTML을 검사합니다.

모든 항목이 성공한 최신 `main`만 배포 대상으로 사용합니다.

## 2. Cloudflare 배포·도메인 확인 — 수동

Canonical 기준 도메인은 `https://www.onearthtrip.com`입니다.

- [ ] Cloudflare Pages 프로젝트의 Custom domains에 `www.onearthtrip.com`이 정상 연결돼 있다.
- [ ] apex `onearthtrip.com`도 Cloudflare가 요청을 받을 수 있는 DNS/도메인 상태다.
- [ ] `https://onearthtrip.com/*` 요청을 `https://www.onearthtrip.com/*`로 301 리디렉션한다.
- [ ] 리디렉션에서 원래 path와 query string을 보존한다.
- [ ] 기본 `*.pages.dev` 주소가 공개 접근 가능하다면 custom domain으로 301 리디렉션한다.
- [ ] `https://www.onearthtrip.com/`이 200으로 응답한다.
- [ ] `https://onearthtrip.com/example`이 동일 경로의 `https://www.onearthtrip.com/example`로 301 이동한다.
- [ ] `https://onearthtrip.com/reading-guide?utm_source=test`가 `https://www.onearthtrip.com/reading-guide?utm_source=test`로 301 이동한다.
- [ ] 이미 `www`인 URL은 다시 다른 호스트로 이동하지 않고 최종 페이지에 도달한다.
- [ ] 대표 `.html` 레거시 URL이 확장자 없는 canonical URL로 301 이동한다.

### 권장 Redirect Rule

Cloudflare Redirect Rules에서 다음 형태로 확인합니다.

- Incoming request: `https://onearthtrip.com/*`
- Target URL: `https://www.onearthtrip.com/${1}`
- Status code: `301`
- Preserve query string: `On`

Cloudflare의 공식 root→www 예제도 원래 path와 query string을 보존하는 구성을 사용합니다. `public/_redirects`만으로 domain-level apex→www 통일이 끝났다고 가정하지 않습니다.

## 3. Google Search Console — 수동

- [ ] `onearthtrip.com` Domain property 소유권이 확인돼 있다.
- [ ] Sitemaps에 `https://www.onearthtrip.com/sitemap-index.xml`을 제출한다.
- [ ] 제출한 sitemap 상태가 성공이고 Google이 읽을 수 있다.
- [ ] URL Inspection의 Live Test에서 홈이 접근 가능하다.

### URL Inspection 권장 순서

아래 순서대로 확인하면 사이트 구조와 대표 콘텐츠를 함께 점검할 수 있습니다.

1. `https://www.onearthtrip.com/`
2. `https://www.onearthtrip.com/reading-guide`
3. `https://www.onearthtrip.com/life`
4. `https://www.onearthtrip.com/culture`
5. `https://www.onearthtrip.com/trip-checklist`
6. `https://www.onearthtrip.com/2026/08/uae-entry-checklist-before-travel`
7. `https://www.onearthtrip.com/2026/08/abu-dhabi-3-day-itinerary`
8. `https://www.onearthtrip.com/2026/08/sheikh-zayed-grand-mosque-visit-guide`
9. `https://www.onearthtrip.com/field-notes`
10. `https://www.onearthtrip.com/2026/04/blog-post_11`
11. `https://www.onearthtrip.com/author`
12. `https://www.onearthtrip.com/editorial-policy`

각 URL에서 우선 확인할 항목:

- Page fetch: 성공
- Crawl allowed?: Yes
- Indexing allowed?: Yes
- User-declared canonical: 검사한 `https://www.onearthtrip.com/...` URL
- Google-selected canonical: 이미 처리된 URL이라면 동일한 canonical이 이상적
- Live Test: 페이지 접근 가능

새 사이트라 아직 Google index 데이터가 없으면 그것만으로 오류로 판단하지 않습니다. Live Test가 성공하고 canonical/robots가 정상이라면 대표 URL부터 제한적으로 `Request indexing` 합니다.

### 문제가 나오면 보내야 할 정보

URL Inspection에서 문제가 있으면 아래를 그대로 복사하거나 캡처해서 보냅니다.

- 검사한 전체 URL
- `URL is on Google` / `URL is not on Google` 상태
- Page indexing 사유 문구
- Last crawl 날짜
- Page fetch 결과
- Crawl allowed? 결과
- Indexing allowed? 결과
- User-declared canonical
- Google-selected canonical
- Referring page가 표시되면 해당 값
- Sitemap이 표시되면 해당 값
- `Test live URL` 결과
- Live Test에서 실패하면 표시되는 상세 오류 문구
- Soft 404 또는 렌더링 의심이면 `View tested page`의 Screenshot과 HTML 상태

Sitemap에서 문제가 있으면 아래를 보냅니다.

- 제출한 sitemap URL
- Status
- Last read
- Discovered pages 수
- 표시된 정확한 오류 문구
- `sitemap-index.xml`을 브라우저에서 직접 열었을 때 보이는 결과

Search Console의 Sitemaps 보고서는 보고서에서 직접 제출한 sitemap의 읽기 상태를 추적하는 용도이므로, Google이 이미 sitemap을 알고 있어도 직접 제출해 두는 편이 좋습니다.

## 4. Google AdSense 사이트 등록 — 수동

- [ ] AdSense > Sites > New site에서 `onearthtrip.com`을 등록한다.
- [ ] `/page`, query string, fragment, port가 붙은 URL을 사이트 등록값으로 사용하지 않는다.
- [ ] canonical이 `www`여도 AdSense 사이트 등록은 표준 도메인 `onearthtrip.com` 기준으로 진행한다.
- [ ] 사이트 상태가 `Requires review`인지 확인한다.
- [ ] 현재 페이지 `<head>`의 AdSense code snippet publisher ID가 `ca-pub-6918910185244897`인지 확인한다.
- [ ] `<meta name="google-adsense-account" content="ca-pub-6918910185244897">`가 유지되는지 확인한다.
- [ ] `https://www.onearthtrip.com/ads.txt`가 열리고 `pub-6918910185244897`이 일치하는지 확인한다.
- [ ] 검토 요청을 제출한다.

Google은 AdSense 사이트 URL에 path, parameter, fragment, port가 없는 표준 도메인을 사용하도록 안내합니다. `www.onearthtrip.com`이 실제 canonical host인 것과 AdSense에 등록하는 사이트 단위를 혼동하지 않습니다.

현재 소스는 검색·문의·개인정보·약관·About·Author·편집원칙·404 같은 기능/신뢰 페이지에서는 AdSense loader를 제외하고, 계정 확인용 `google-adsense-account` meta는 유지합니다. 콘텐츠 표면에는 AdSense loader를 유지합니다.

## 5. 승인 대기 중 운영 원칙

- 신규 글을 대량으로 한 번에 추가하지 않는다.
- 현재 공식 정보가 바뀐 기존 글의 수정과 직접 경험 자료 연결을 우선한다.
- 빈 페이지, 테스트 페이지, 자동 생성형 얇은 페이지를 만들지 않는다.
- Search Console 오류가 나오면 새 콘텐츠보다 크롤링·canonical·redirect 문제를 먼저 해결한다.
- 승인 결과가 나오기 전 광고 위치를 과도하게 추가하지 않는다.
- 기존 permalink를 승인 목적만으로 변경하지 않는다.

## 6. 승인 후 광고 게재 전

- EEA·영국·스위스 사용자에게 광고를 게재한다면 Google 요구사항에 맞는 인증 CMP/Privacy & messaging 설정을 완료한다.
- 자동 광고를 켜기 전 모바일에서 본문 가림, 메뉴 방해, 과도한 광고 밀도를 점검한다.
- `/search`, 정책·문의·운영자 페이지의 광고 제외 정책은 유지한다.

## 7. 승인 준비 상태를 세 그룹으로 관리

### 자동 검증 완료

- GitHub Actions 전체 성공
- 콘텐츠 품질 게이트 통과
- 내부링크·이미지·SEO·sitemap 검사 통과
- 대표 reviewer path 빌드 HTML 검사 통과
- 광고 제외 페이지 경계 통과
- publisher ID / `google-adsense-account` meta / ads.txt 일치

### 사용자가 직접 확인해야 할 것

- Cloudflare apex→www 실제 301 응답
- path/query string 보존
- `www` 최종 응답 200
- Search Console sitemap 읽기 상태
- 대표 URL Live Test
- Google-selected canonical
- AdSense Sites 내부 등록·검토 상태
- 라이브 `ads.txt` 접근

### AdSense 신청 전 아직 남은 것

자동 검증 성공만으로 바로 신청 완료로 보지 않습니다. 아래 3개가 실제 계정/네트워크에서 확인되면 신청 단계로 넘어갑니다.

1. 최신 `main`의 모든 CI 게이트가 성공한다.
2. Cloudflare에서 canonical 도메인과 apex→www 리디렉션이 실제 응답으로 확인된다.
3. Search Console Live Test에서 홈과 대표 콘텐츠 URL이 Google에 접근 가능하다.
