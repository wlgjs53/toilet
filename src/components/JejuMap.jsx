import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { makeProjector } from '../lib/mapProject.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const MAX_K = 1.5; // 이미지 한 픽셀이 화면 1.5픽셀을 넘으면 흐려져서 확대 한계를 둠

// 블렌더로 만든 제주 3D 지도 위에 화장실 핀을 올리고, 드래그/핀치/휠로 움직이는 지도
export default function JejuMap({ meta, toilets, results, me, selectedId, onSelect, overlay }) {
  const wrapRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 });
  const pointers = useRef(new Map());
  const initialized = useRef(false);

  const proj = useMemo(() => makeProjector(meta), [meta]);
  const W = meta.width;
  const H = meta.height;
  const kFit = size.w ? size.w / W : 1;

  // 컨테이너 크기 추적
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const limit = useCallback(
    (v) => {
      const k = clamp(v.k, kFit * 0.95, Math.max(kFit, MAX_K));
      const iw = W * k;
      const ih = H * k;
      const mx = size.w * 0.25;
      const my = size.h * 0.25;
      const tx = clamp(v.tx, Math.min(0, size.w - iw) - mx, Math.max(0, size.w - iw) + mx);
      const ty = clamp(v.ty, Math.min(0, size.h - ih) - my, Math.max(0, size.h - ih) + my);
      return { k, tx, ty };
    },
    [kFit, size, W, H],
  );

  // 처음에는 섬 전체가 보이게
  useEffect(() => {
    if (!size.w || initialized.current) return;
    initialized.current = true;
    setView({ k: kFit, tx: 0, ty: (size.h - H * kFit) / 2 });
  }, [size, kFit, H]);

  const zoomAt = useCallback(
    (px, py, factor) => {
      setView((v) => {
        const k2 = clamp(v.k * factor, kFit * 0.95, Math.max(kFit, MAX_K));
        const r = k2 / v.k;
        return limit({ k: k2, tx: px - (px - v.tx) * r, ty: py - (py - v.ty) * r });
      });
    },
    [kFit, limit],
  );

  // 마우스 휠 확대/축소 (페이지 스크롤 방지를 위해 passive:false)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.25 : 0.8);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e) => {
    wrapRef.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const rect = wrapRef.current.getBoundingClientRect();
    if (pointers.current.size === 1) {
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      setView((v) => limit({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)[1];
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 0) zoomAt((e.clientX + other.x) / 2 - rect.left, (e.clientY + other.y) / 2 - rect.top, after / before);
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e) => pointers.current.delete(e.pointerId);

  // 내 위치 + 가까운 3곳이 한 화면에 들어오게 이동
  const focusKey = me ? `${me.lat.toFixed(4)},${me.lng.toFixed(4)}|${results.slice(0, 3).map((r) => r.id).join(',')}` : '';
  useEffect(() => {
    if (!me || !size.w) return;
    const pts = [me, ...results.slice(0, 3)].map((p) => proj.project(p.lng, p.lat));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const bw = Math.max(80, Math.max(...xs) - Math.min(...xs));
    const bh = Math.max(60, Math.max(...ys) - Math.min(...ys));
    const k = clamp(Math.min(size.w / (bw * 1.9), size.h / (bh * 2.2)), kFit, Math.max(kFit, 0.9));
    const cxp = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cyp = (Math.max(...ys) + Math.min(...ys)) / 2;
    setView(limit({ k, tx: size.w / 2 - cxp * k, ty: size.h / 2 - cyp * k }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, size.w, size.h]);

  // 카드에서 고른 화장실이 화면 밖이면 그쪽으로 이동
  useEffect(() => {
    if (!selectedId || !size.w) return;
    const t = results.find((r) => r.id === selectedId);
    if (!t) return;
    const p = proj.project(t.lng, t.lat);
    setView((v) => limit({ ...v, tx: size.w / 2 - p.x * v.k, ty: size.h / 2 - p.y * v.k }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const dots = useMemo(() => toilets.map((t) => ({ id: t.id, ...proj.project(t.lng, t.lat) })), [toilets, proj]);
  const resultPins = useMemo(
    () => results.map((t, i) => ({ ...t, rank: i + 1, ...proj.project(t.lng, t.lat) })),
    [results, proj],
  );
  const mePin = me ? proj.project(me.lng, me.lat) : null;
  const top = resultPins[0];

  return (
    <div className="map-wrap">
      <div
        ref={wrapRef}
        className="map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ '--inv': 1 / view.k }}
      >
        <div
          className="map-layer"
          style={{ width: W, height: H, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})` }}
        >
          <img src={meta.image} width={W} height={H} alt="제주도 3D 지도" draggable={false} />

          {mePin && top && (
            <svg className="route" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
              <line x1={mePin.x} y1={mePin.y} x2={top.x} y2={top.y} />
            </svg>
          )}

          {dots.map((d) => (
            <span key={d.id} className="dot" style={{ left: d.x, top: d.y }} />
          ))}

          {resultPins
            .slice()
            .reverse()
            .map((p) => (
              <button
                key={p.id}
                className={`pin ${p.rank === 1 ? 'first' : ''} ${selectedId === p.id ? 'sel' : ''}`}
                style={{ left: p.x, top: p.y }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onSelect(p.id)}
                aria-label={`${p.rank}번 ${p.name}`}
              >
                <span>{p.rank}</span>
              </button>
            ))}

          {mePin && (
            <span className="me" style={{ left: mePin.x, top: mePin.y }}>
              <i />
            </span>
          )}
        </div>

        <div className="map-ctrl" onPointerDown={(e) => e.stopPropagation()}>
          <button onClick={() => zoomAt(size.w / 2, size.h / 2, 1.6)} aria-label="확대">
            +
          </button>
          <button onClick={() => zoomAt(size.w / 2, size.h / 2, 0.625)} aria-label="축소">
            −
          </button>
        </div>

        {overlay && (
          <div className="map-overlay" onPointerDown={(e) => e.stopPropagation()}>
            {overlay}
          </div>
        )}
      </div>
    </div>
  );
}
