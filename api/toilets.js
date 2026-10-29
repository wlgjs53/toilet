// Vercel 서버리스 함수: 제주 공공화장실 목록
// - 인증키(TOILET_API_KEY)는 서버에만 두고, 브라우저에는 가공한 결과만 내려 줍니다.
// - 화장실 시설 정보는 자주 바뀌지 않아서 CDN 에 하루 동안 캐시합니다.
const BASE = 'https://apis.data.go.kr/6510000/publicToiletService/getPublicToiletInfoList';
const PAGE_SIZE = 100;

const num = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};

function normalize(x) {
  const lat = parseFloat(x.laCrdnt);
  const lng = parseFloat(x.loCrdnt);
  return {
    id: x.dataCd,
    name: x.toiletNm || '이름 없음',
    type: x.seNm || '',
    place: x.toiletInstlPlacePttnNm || '',
    area: x.emdNm || '',
    address: x.rnAdres || x.lnmAdres || '',
    lat,
    lng,
    hours: x.opnTimeInfo || '',
    tel: x.telno || '',
    manager: x.mngrInsttNm || '',
    note: x.etcCn || '',
    bell: x.emgncBellInstlYn === 'Y',
    cctv: x.toiletEntrncCctvInstlYn === 'Y',
    diaper: x.diaperExhgTablYn === 'Y',
    accessible: num(x.maleDspsnClosetCnt) + num(x.femaleDspsnClosetCnt) > 0,
    stalls: {
      male: num(x.maleClosetCnt),
      urinal: num(x.maleUrinalCnt),
      female: num(x.femaleClosetCnt),
    },
  };
}

async function fetchPage(key, pageNo) {
  const url = `${BASE}?serviceKey=${encodeURIComponent(key)}&pageNo=${pageNo}&numOfRows=${PAGE_SIZE}&_type=json`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`공공데이터 응답 오류 (${r.status})`);
  const data = await r.json();
  const header = data?.response?.header;
  if (header && header.resultCode !== '00') throw new Error(header.resultMsg || '공공데이터 오류');
  return data.response.body;
}

export default async function handler(req, res) {
  const key = process.env.TOILET_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'TOILET_API_KEY 환경변수가 설정되지 않았습니다.' });
  }
  try {
    const first = await fetchPage(key, 1);
    const total = num(first.totalCount);
    const pages = Math.ceil(total / PAGE_SIZE);
    const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => fetchPage(key, i + 2)));
    const raw = [first, ...rest].flatMap((b) => b.items?.item ?? []);

    const items = raw
      .map(normalize)
      .filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lng) && t.lat > 33 && t.lat < 34.2 && t.lng > 126 && t.lng < 127);

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ total, count: items.length, items });
  } catch (e) {
    return res.status(502).json({ error: '화장실 정보를 불러오지 못했습니다.' });
  }
}
