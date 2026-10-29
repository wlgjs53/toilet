# 🚽 토일렛이슈

급할 때 **내 위치에서 가장 가까운 제주 공공화장실**을 3초 안에 찾아 주는 웹앱.

- 큰 "🚨 지금 급해요!" 버튼 → 가까운 순 3곳, 거리·도보 시간, 지금 열려 있는지, 길 안내 버튼
- 필터: 지금 열린 곳 / 비상벨 / CCTV / 기저귀 교환대 / 장애인용
- 위치 권한을 거절하면 동네를 직접 골라서 찾기
- 내 위치는 브라우저에서만 쓰고 서버에 저장하지 않아요

데이터: 제주특별자치도 공공화장실 정보 (공공데이터포털, `publicToiletService`) 415곳 중 좌표가 있는 곳.
**청결도와 실시간 상태는 데이터에 없어서 제공하지 않아요.** 개방 시간은 문장을 어림으로 해석한 값이라 틀릴 수 있어요.

## 구조

```
api/toilets.js        Vercel 서버리스 함수: 공공데이터 호출 + 가공 + 하루 캐시 (인증키는 서버에만)
src/lib/geo.js        거리(하버사인)·도보 시간·지도앱 길안내 링크
src/lib/hours.js      개방 시간 문장 해석
src/App.jsx           위치 찾기 / 결과 / 필터
src/components/JejuMap.jsx  3D 지도(드래그·핀치·휠 확대) + 핀
src/lib/mapProject.js  경위도+표고 -> 지도 이미지 픽셀 좌표
tools/render_map.py   블렌더로 제주 3D 지도 이미지 만들기
public/map/            jeju-3d.jpg(지도) + jeju-3d.json(좌표 계산 값)
```

## 환경변수

| 이름 | 설명 | 브라우저 노출 |
|---|---|---|
| `TOILET_API_KEY` | 공공데이터포털 일반 인증키 | **노출 안 됨** (서버 전용) |

> ⚠️ 인증키는 코드나 GitHub 에 넣지 마세요. `.env` 는 `.gitignore` 로 커밋되지 않습니다.

## 로컬 실행

```bash
npm install
cp .env.example .env     # Windows PowerShell: Copy-Item .env.example .env
# .env 에 TOILET_API_KEY 를 채우기
npm run dev              # http://localhost:5173
```

> 위치 정보(GPS)는 `https` 또는 `localhost` 에서만 동작합니다. 폰으로 테스트할 때는 Vercel 배포 주소를 쓰세요.

## Vercel 배포

1. GitHub 에 올린 뒤 https://vercel.com → **Add New → Project** → 저장소 **Import**
2. Framework Preset 은 **Vite** 로 자동 인식 (Build `npm run build`, Output `dist`)
3. **Environment Variables** 에 `TOILET_API_KEY` 를 등록 (Production/Preview/Development 모두)
4. **Deploy**. 환경변수를 나중에 바꾸면 **Redeploy** 해야 반영돼요.

## 앞으로 할 일 (아이디어)

- 사용자 제보(잠김/깨끗함/휴지 없음) — Supabase 로그인 + 테이블
- 지도 보기, 홈 화면에 추가(PWA)

## 3D 지도 다시 만들기 (선택)

지도는 SRTM 지형 데이터(DEM)를 블렌더로 렌더링한 이미지예요. 직교(원근 없음) 카메라를 고정 기울기로 써서, 화장실 핀을 수식으로 정확히 올릴 수 있어요. 구름은 없어요.

```bash
blender -b --python tools/render_map.py
```n
- DEM 파일 경로는 환경변수 `DEM_PATH`(기본 `C:\vibe\day4\dem\N33E126.hgt.gz`)로 바꿀 수 있어요.
- 기울기·높이 과장·빛 방향은 스크립트 맨 위 상수에서 고치고, 다시 실행하면 이미지와 json 이 같이 갱신돼요.
