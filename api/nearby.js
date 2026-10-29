// Vercel 서버리스 함수: 화장실 주변 상가·건물·명소
// - KAKAO_REST_API_KEY 가 있으면 카카오 로컬 API(정확하고 빠름)를 사용합니다.
// - 없으면 OpenStreetMap(Overpass)을 시도합니다. (무료지만 서버가 붐비면 실패할 수 있어요)
const RADIUS = 300; // m

// 카카오 카테고리 그룹 코드 -> 이름/아이콘
const KAKAO_CATS = [
  ['CS2', '편의점', '🏪'],
  ['CE7', '카페', '☕'],
  ['FD6', '음식점', '🍽️'],
  ['MT1', '마트', '🛒'],
  ['PM9', '약국', '💊'],
  ['HP8', '병원', '🏥'],
  ['BK9', '은행', '🏦'],
  ['AT4', '관광명소', '🏞️'],
  ['CT1', '문화시설', '🎭'],
  ['PO3', '공공기관', '🏛️'],
  ['AD5', '숙박', '🛏️'],
  ['PK6', '주차장', '🅿️'],
];

const rad = (d) => (d * Math.PI) / 180;
function distanceM(aLat, aLng, bLat, bLng) {
  const R = 6371000;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fromKakao(key, lat, lng) {
  const calls = KAKAO_CATS.map(async ([code, label, emoji]) => {
    const url =
      'https://dapi.kakao.com/v2/local/search/category.json?' +
      new URLSearchParams({
        category_group_code: code,
        x: String(lng),
        y: String(lat),
        radius: String(RADIUS),
        sort: 'distance',
        size: '5',
      });
    const r = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`kakao ${r.status}`);
    const data = await r.json();
    return (data.documents || []).map((d) => ({
      name: d.place_name,
      category: label,
      emoji,
      lat: parseFloat(d.y),
      lng: parseFloat(d.x),
      distance: parseInt(d.distance, 10) || Math.round(distanceM(lat, lng, parseFloat(d.y), parseFloat(d.x))),
      address: d.road_address_name || d.address_name || '',
      url: d.place_url || '',
    }));
  });
  const settled = await Promise.allSettled(calls);
  if (settled.every((s) => s.status === 'rejected')) throw new Error('kakao failed');
  return settled.filter((s) => s.status === 'fulfilled').flatMap((s) => s.value);
}

// OpenStreetMap 태그 -> 분류
function osmCategory(t) {
  const a = t.amenity;
  const s = t.shop;
  if (s === 'convenience') return ['편의점', '🏪'];
  if (s === 'supermarket' || s === 'mall' || s === 'department_store') return ['마트', '🛒'];
  if (a === 'cafe') return ['카페', '☕'];
  if (a === 'restaurant' || a === 'fast_food' || a === 'food_court') return ['음식점', '🍽️'];
  if (a === 'pharmacy') return ['약국', '💊'];
  if (a === 'hospital' || a === 'clinic' || a === 'dentist' || a === 'doctors') return ['병원', '🏥'];
  if (a === 'bank' || a === 'atm') return ['은행', '🏦'];
  if (a === 'parking') return ['주차장', '🅿️'];
  if (a === 'townhall' || a === 'police' || a === 'post_office' || a === 'public_building') return ['공공기관', '🏛️'];
  if (a === 'school' || a === 'kindergarten' || a === 'university') return ['학교', '🏫'];
  if (t.tourism === 'hotel' || t.tourism === 'guest_house' || t.tourism === 'hostel' || t.tourism === 'motel') return ['숙박', '🛏️'];
  if (t.tourism) return ['관광명소', '🏞️'];
  if (a === 'cinema' || a === 'theatre' || a === 'arts_centre' || a === 'library') return ['문화시설', '🎭'];
  if (s) return ['상점', '🛍️'];
  if (t.leisure) return ['공원·체육', '🌳'];
  if (a) return ['시설', '📍'];
  if (t.building) return ['건물', '🏢'];
  return ['기타', '📍'];
}

async function fromOverpass(lat, lng) {
  const around = `(around:${RADIUS},${lat},${lng})`;
  const q = `[out:json][timeout:10];(${['shop', 'amenity', 'tourism', 'leisure', 'building']
    .map((k) => `nwr${around}[name][${k}];`)
    .join('')});out center tags 80;`;
  const r = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'toilet-issue-jeju/1.0',
      Accept: 'application/json',
    },
    body: `data=${encodeURIComponent(q)}`,
    signal: AbortSignal.timeout(9000),
  });
  if (!r.ok) throw new Error(`overpass ${r.status}`);
  const data = await r.json();
  return (data.elements || [])
    .map((e) => {
      const pLat = e.lat ?? e.center?.lat;
      const pLng = e.lon ?? e.center?.lon;
      if (pLat == null || pLng == null) return null;
      const [category, emoji] = osmCategory(e.tags || {});
      return {
        name: e.tags.name,
        category,
        emoji,
        lat: pLat,
        lng: pLng,
        distance: Math.round(distanceM(lat, lng, pLat, pLng)),
        address: e.tags['addr:full'] || '',
        url: '',
      };
    })
    .filter(Boolean);
}

export default async function handler(req, res) {
  const lat = parseFloat(req.query?.lat);
  const lng = parseFloat(req.query?.lng);
  if (!(lat > 33 && lat < 34.2 && lng > 126 && lng < 127.1)) {
    return res.status(400).json({ error: '제주 지역 좌표가 아니에요.' });
  }

  const kakaoKey = process.env.KAKAO_REST_API_KEY;
  let source = kakaoKey ? 'kakao' : 'osm';
  let items;
  try {
    items = kakaoKey ? await fromKakao(kakaoKey, lat, lng) : await fromOverpass(lat, lng);
  } catch (e) {
    if (kakaoKey) {
      // 카카오 실패 시 OSM 으로 한 번 더
      try {
        items = await fromOverpass(lat, lng);
        source = 'osm';
      } catch (e2) {
        items = null;
      }
    }
  }
  if (!items) {
    return res.status(502).json({
      error: kakaoKey
        ? '주변 장소를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'
        : '주변 장소 서비스가 지금 붐벼요. 잠시 뒤 다시 시도해 주세요. (카카오 키를 등록하면 더 안정적이에요)',
    });
  }

  // 이름 중복 제거 + 가까운 순
  const seen = new Set();
  const out = items
    .filter((p) => p.distance <= RADIUS + 50)
    .sort((a, b) => a.distance - b.distance)
    .filter((p) => {
      const k = `${p.name}|${p.category}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 30);

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ source, radius: RADIUS, items: out });
}
