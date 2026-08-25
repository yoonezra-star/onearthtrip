export const coreStorySeoMeta = {
  "/2026/08/abu-dhabi-first-30-days.html": {
    title: "아부다비 첫 7일 체크리스트: 이동·날씨·생활 준비",
    description: "아부다비에 처음 도착한 여행자와 새 거주자가 첫 7일 동안 확인할 이동, 날씨, 장보기, 생활 동선을 공식 안내와 함께 정리했습니다."
  },
  "/2026/08/abu-dhabi-dubai-weekend-rhythm.html": {
    title: "아부다비 두바이 이동: 출발 전 확인할 6가지",
    description: "아부다비와 두바이를 오갈 때 이동 시간, 공식 교통 안내, 예약, 마지막 1km, 휴식 시간을 함께 점검하는 실용 계획표입니다."
  },
  "/2026/08/uae-culture-etiquette-first-visit.html": {
    title: "UAE 문화 공간 방문: 복장·촬영·라마단 확인법",
    description: "UAE 모스크와 문화 공간 방문 전 확인할 복장, 촬영, 입장 시간, 라마단 관련 안내를 공식 정보 중심으로 정리했습니다."
  },
  "/2026/08/uae-seven-emirates-slow-travel.html": {
    title: "UAE 7개 토후국 여행 계획: 지역별로 고르는 법",
    description: "아부다비·두바이부터 산과 동해안까지 UAE 7개 토후국을 여행 목적과 이동 여건에 맞춰 나누어 계획하는 방법을 정리했습니다."
  },
  "/2026/08/uae-personal-photo-archive.html": {
    title: "UAE 개인 사진 아카이브: 2012~2022 직접 촬영 기록",
    description: "2012~2022년 아부다비와 두바이 등에서 직접 촬영한 UAE 사진·영상 기록을 연도별로 모은 개인 현장 아카이브입니다."
  },
  "/2026/04/blog-post_11.html": {
    title: "셰이크 자이드 그랜드 모스크: 2012·2014 직접 촬영 기록",
    description: "2012년 낮과 2014년 밤에 직접 촬영한 셰이크 자이드 그랜드 모스크 사진으로 외관, 장식, 방문객 동선과 야간의 빛을 기록합니다."
  },
  "/2012/12/dubai-burj-khalifa-2012.html": {
    title: "부르즈 할리파 2012년 직접 촬영: 낮·밤·음악분수 기록",
    description: "2012년 두바이에서 직접 촬영한 부르즈 할리파 낮·밤 사진과 음악분수 영상으로 당시 현장의 거리감과 관람 흐름을 기록합니다."
  },
  "/2026/05/dune-bashing.html": {
    title: "UAE 사막 사파리 2012년 기록: 듄 베이싱·낙타·사막",
    description: "2012년 UAE 사막 사파리에서 직접 촬영한 낙타와 모래 언덕 사진, 듄 베이싱 뒤의 개인 경험을 당시 기록 범위에 맞춰 정리했습니다."
  },
  "/2021/06/sir-bani-yas-coastal-road-2021.html": {
    title: "시르바니야스 섬 2021년: 해안도로 사진·영상 기록",
    description: "2021년 6월 시르바니야스 섬에서 직접 촬영한 해안도로 사진과 56초 영상으로 바다·모래·초목 사이 이동 장면을 기록합니다."
  },
  "/2022/04/abu-dhabi-national-aquarium.html": {
    title: "아부다비 국립 아쿠아리움 2022년 직접 촬영 기록",
    description: "2022년 4월 아부다비 국립 아쿠아리움에서 직접 촬영한 입구, 리프 수조, 상어 수조 사진으로 당시 관람 경험을 기록합니다."
  }
};

export function getSeoMeta(permalink) {
  return coreStorySeoMeta[permalink];
}
