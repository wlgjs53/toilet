const R = 6371000; // 지구 반지름(m)
const rad = (d) => (d * Math.PI) / 180;

// 두 좌표 사이의 직선 거리(m)
export function distanceM(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 도보 시간(분): 직선거리에 길 굽음 1.3배, 분당 75m 로 어림 계산
export function walkMinutes(m) {
  return Math.max(1, Math.round((m * 1.3) / 75));
}

export function formatDistance(m) {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}

// 길 안내 링크 (각 지도 앱/웹으로 연결)
export function navLinks(t) {
  const name = encodeURIComponent(t.name);
  return {
    kakao: `https://map.kakao.com/link/to/${name},${t.lat},${t.lng}`,
    naver: `https://map.naver.com/v5/directions/-/${t.lng},${t.lat},${name}/-/walk`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}&travelmode=walking`,
  };
}
