// 경위도 + 표고 -> 3D 지도 이미지 위 픽셀 좌표 (tools/render_map.py 와 같은 수식)
export function makeProjector(meta) {
  const { width: W, height: H, widthKm, cx, cy, kx, ky, clon, clat, exag, tiltDeg } = meta;
  const t = (tiltDeg * Math.PI) / 180;
  const s = W / widthKm; // px / km
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const { lon0, lat0, step, cols, rows, data } = meta.elev;

  // 표고(m) 이중선형 보간: 핀이 산 위에 있으면 지도에서 위로 올라가 보이도록
  const elevAt = (lon, lat) => {
    const fx = Math.min(cols - 1.001, Math.max(0, (lon - lon0) / step));
    const fy = Math.min(rows - 1.001, Math.max(0, (lat - lat0) / step));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const ax = fx - x0;
    const ay = fy - y0;
    const g = (xx, yy) => data[yy * cols + xx];
    return (
      g(x0, y0) * (1 - ax) * (1 - ay) +
      g(x0 + 1, y0) * ax * (1 - ay) +
      g(x0, y0 + 1) * (1 - ax) * ay +
      g(x0 + 1, y0 + 1) * ax * ay
    );
  };

  return {
    width: W,
    height: H,
    project(lon, lat) {
      const z = (elevAt(lon, lat) / 1000) * exag;
      const x = (lon - clon) * kx;
      const y = (lat - clat) * ky;
      const v = (y - cy) * ct + z * st;
      return { x: W / 2 + (x - cx) * s, y: H / 2 - v * s };
    },
  };
}
