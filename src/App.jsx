import { useMemo, useState } from 'react';
import { useToilets } from './lib/useToilets.js';
import { distanceM } from './lib/geo.js';
import { openStatus } from './lib/hours.js';
import Filters from './components/Filters.jsx';
import ToiletCard from './components/ToiletCard.jsx';

const DEFAULT_FILTERS = { openNow: true, bell: false, cctv: false, diaper: false, accessible: false };

export default function App() {
  const { items, loading, error } = useToilets();
  const [phase, setPhase] = useState('idle'); // idle | locating | ready | denied
  const [pos, setPos] = useState(null); // { lat, lng, source: 'gps' | 'region', label? }
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showAll, setShowAll] = useState(false);

  // 지역별 중심 좌표(위치를 못 가져왔을 때 직접 고르는 용도)
  const regions = useMemo(() => {
    const map = new Map();
    items.forEach((t) => {
      if (!t.area) return;
      const r = map.get(t.area) || { name: t.area, lat: 0, lng: 0, n: 0 };
      r.lat += t.lat;
      r.lng += t.lng;
      r.n += 1;
      map.set(t.area, r);
    });
    return [...map.values()]
      .map((r) => ({ name: r.name, lat: r.lat / r.n, lng: r.lng / r.n }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [items]);

  const locate = () => {
    setShowAll(false);
    if (!navigator.geolocation) {
      setPhase('denied');
      return;
    }
    setPhase('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, source: 'gps' });
        setPhase('ready');
      },
      () => setPhase('denied'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  const pickRegion = (name) => {
    const r = regions.find((x) => x.name === name);
    if (!r) return;
    setPos({ lat: r.lat, lng: r.lng, source: 'region', label: r.name });
    setPhase('ready');
  };

  const results = useMemo(() => {
    if (!pos) return [];
    const now = new Date();
    return items
      .map((t) => ({ ...t, dist: distanceM(pos, t), status: openStatus(t.hours, now) }))
      .filter((t) => (filters.openNow ? t.status.state !== 'closed' : true))
      .filter((t) => (filters.bell ? t.bell : true))
      .filter((t) => (filters.cctv ? t.cctv : true))
      .filter((t) => (filters.diaper ? t.diaper : true))
      .filter((t) => (filters.accessible ? t.accessible : true))
      .sort((a, b) => a.dist - b.dist);
  }, [items, pos, filters]);

  const visible = showAll ? results.slice(0, 20) : results.slice(0, 3);
  const farAway = results[0] && results[0].dist > 30000; // 제주 밖에서 접속한 경우

  return (
    <div className="app">
      <header className="top">
        <h1>🚽 토일렛이슈</h1>
        <p>급할 땐 가장 가까운 제주 공공화장실로!</p>
      </header>

      <main>
        {phase !== 'ready' && (
          <section className="hero">
            <button className="sos" onClick={locate} disabled={loading || !!error || phase === 'locating'}>
              {phase === 'locating' ? '📍 위치 찾는 중…' : '🚨 지금 급해요!'}
            </button>
            <p className="hint">누르면 내 위치에서 가장 가까운 화장실 3곳을 바로 보여드려요.</p>
            <p className="privacy">내 위치는 이 기기에서만 사용하고 저장하지 않아요.</p>

            {loading && <p className="muted">화장실 정보를 불러오는 중…</p>}
            {error && <p className="notice">{error}</p>}

            {phase === 'denied' && (
              <div className="notice">
                <strong>위치를 가져오지 못했어요.</strong>
                <p>브라우저의 위치 권한을 허용하거나, 아래에서 가까운 동네를 직접 골라 주세요.</p>
                <select defaultValue="" onChange={(e) => pickRegion(e.target.value)} aria-label="동네 선택">
                  <option value="" disabled>
                    동네 선택…
                  </option>
                  {regions.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>
        )}

        {phase === 'ready' && (
          <section className="results">
            <div className="results-head">
              <h2>{pos.source === 'gps' ? '내 주변 가장 가까운 화장실' : `${pos.label} 근처 화장실`}</h2>
              <button className="btn-small" onClick={locate}>
                📍 다시 찾기
              </button>
            </div>

            <Filters value={filters} onChange={setFilters} />

            {farAway && (
              <p className="notice">
                가장 가까운 곳도 {Math.round(results[0].dist / 1000)}km 떨어져 있어요. 이 서비스는 제주 지역 화장실만 안내해요.
              </p>
            )}

            {results.length === 0 ? (
              <p className="notice">조건에 맞는 화장실이 없어요. 필터를 해제해 보세요.</p>
            ) : (
              visible.map((t, i) => <ToiletCard key={t.id} t={t} rank={i + 1} featured={i === 0} />)
            )}

            {results.length > 3 && (
              <button className="more-list" onClick={() => setShowAll(!showAll)}>
                {showAll ? '3곳만 보기 ▲' : `더 보기 (가까운 ${Math.min(20, results.length)}곳까지) ▼`}
              </button>
            )}
          </section>
        )}
      </main>

      <footer className="foot">
        <p>
          데이터: 제주특별자치도 공공화장실 정보(공공데이터포털). 개방 시간과 시설은 실제와 다를 수 있어요. 청결도와 실시간
          상태는 제공되지 않아요.
        </p>
      </footer>
    </div>
  );
}
