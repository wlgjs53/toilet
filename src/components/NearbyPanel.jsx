import { compass } from '../lib/nearby.js';

const RINGS = [100, 200, 300];

// 화장실을 가운데 두고 주변 300m 안의 가게·건물을 귀여운 레이더 그림 + 목록으로 보여줍니다.
export default function NearbyPanel({ toilet, state }) {
  if (!state) return null;
  if (state.loading) return <div className="nearby muted">🔍 주변을 둘러보는 중…</div>;
  if (state.error) return <div className="nearby notice">{state.error}</div>;
  const items = state.items || [];
  if (items.length === 0) return <div className="nearby muted">300m 안에 등록된 장소가 없어요.</div>;

  const SIZE = 300;
  const C = SIZE / 2;
  const scale = (C - 22) / 300; // 300m = 반지름

  const placed = items.slice(0, 24).map((p, i) => {
    const dy = p.lat - toilet.lat;
    const dx = (p.lng - toilet.lng) * Math.cos((toilet.lat * Math.PI) / 180);
    const m = Math.hypot(dx, dy) * 111320 || 1;
    const px = (dx * 111320 * scale) * 1;
    const py = (-dy * 111320 * scale) * 1;
    // 같은 자리에 겹치지 않도록 아주 조금 퍼뜨림
    const jitter = ((i * 37) % 7) - 3;
    return { ...p, x: C + px + jitter, y: C + py + ((i * 53) % 7) - 3, m, i };
  });

  return (
    <div className="nearby">
      <h4>🏘️ 주변 300m 둘러보기</h4>
      <svg className="radar" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="주변 장소 지도">
        <circle cx={C} cy={C} r={C - 4} fill="#eaf7ff" />
        {RINGS.map((m) => (
          <g key={m}>
            <circle cx={C} cy={C} r={m * scale} fill="none" stroke="#9fd3f5" strokeDasharray="4 5" strokeWidth="1.5" />
            <text x={C + 4} y={C - m * scale + 12} fontSize="10" fill="#6aa7cf">
              {m}m
            </text>
          </g>
        ))}
        <text x={C} y="14" textAnchor="middle" fontSize="11" fill="#6aa7cf" fontWeight="700">
          북
        </text>
        {placed.map((p) => (
          <g key={`${p.name}-${p.i}`}>
            <title>{`${p.name} · ${p.category} · ${p.distance}m`}</title>
            <circle cx={p.x} cy={p.y} r="12" fill="#fff" stroke="#ffb3c6" strokeWidth="2" />
            <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize="13">
              {p.emoji}
            </text>
          </g>
        ))}
        <circle cx={C} cy={C} r="17" fill="#fff" stroke="#ff6b6b" strokeWidth="3" />
        <text x={C} y={C + 7} textAnchor="middle" fontSize="20">
          🚽
        </text>
      </svg>

      <ul className="poi-list">
        {items.slice(0, 12).map((p) => (
          <li key={`${p.name}-${p.category}-${p.distance}`}>
            <span className="poi-emoji">{p.emoji}</span>
            <span className="poi-name">
              {p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer">
                  {p.name}
                </a>
              ) : (
                p.name
              )}
              <small>{p.category}</small>
            </span>
            <span className="poi-dist">
              {compass(toilet.lat, toilet.lng, p.lat, p.lng)} {p.distance}m
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small-note">
        {state.source === 'kakao' ? '출처: 카카오 로컬' : '출처: OpenStreetMap'} · 영업 여부는 현장에서 확인해 주세요.
      </p>
    </div>
  );
}
