// 화장실 주변 상가·건물 (서버리스 함수 /api/nearby)
export async function fetchNearby(lat, lng) {
  const r = await fetch(`/api/nearby?lat=${lat}&lng=${lng}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || '주변 장소를 불러오지 못했어요.');
  return data; // { source, radius, items: [{ name, category, emoji, lat, lng, distance, address, url }] }
}

// 화장실 기준 방향(북/동/남/서...)
export function compass(fromLat, fromLng, toLat, toLng) {
  const dy = toLat - fromLat;
  const dx = (toLng - fromLng) * Math.cos((fromLat * Math.PI) / 180);
  const deg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  return ['북', '북동', '동', '남동', '남', '남서', '서', '북서'][Math.round(deg / 45) % 8];
}
