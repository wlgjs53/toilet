import { useState } from 'react';
import { formatDistance, navLinks, walkMinutes } from '../lib/geo.js';

const STATE_LABEL = { open: '지금 이용 가능', closed: '지금은 닫혔을 수 있어요', unknown: '시간 확인 필요' };

export default function ToiletCard({ t, rank, featured, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const links = navLinks(t);
  const tags = [
    t.bell && '🔔 비상벨',
    t.cctv && '📹 CCTV',
    t.diaper && '👶 기저귀 교환대',
    t.accessible && '♿ 장애인용',
  ].filter(Boolean);

  return (
    <article
      id={`card-${t.id}`}
      onClick={onSelect}
      className={`card ${featured ? 'featured' : ''} ${selected ? 'selected' : ''} state-${t.status.state}`}
    >
      <div className="card-top">
        <span className="rank">{rank}</span>
        <div className="card-title">
          <h3>{t.name}</h3>
          <p className="muted">
            {t.type}
            {t.place ? ` · ${t.place}` : ''} · {t.area}
          </p>
        </div>
      </div>

      <div className="dist-row">
        <span className="dist">{formatDistance(t.dist)}</span>
        <span className="walk">도보 약 {walkMinutes(t.dist)}분</span>
        <span className={`badge ${t.status.state}`}>{STATE_LABEL[t.status.state]}</span>
      </div>
      <p className="hours">🕒 {t.status.label}</p>

      {tags.length > 0 && (
        <div className="tags">
          {tags.map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
      )}

      <div className="nav-buttons">
        <a className="go primary" href={links.kakao} target="_blank" rel="noreferrer">
          카카오맵 길안내
        </a>
        <a className="go" href={links.naver} target="_blank" rel="noreferrer">
          네이버
        </a>
        <a className="go" href={links.google} target="_blank" rel="noreferrer">
          구글
        </a>
      </div>

      <button className="more" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? '접기 ▲' : '자세히 ▼'}
      </button>

      {open && (
        <div className="detail">
          <dl>
            <dt>주소</dt>
            <dd>{t.address}</dd>
            <dt>개방 시간</dt>
            <dd>{t.hours || '정보 없음'}</dd>
            <dt>칸 수</dt>
            <dd>
              남자 대변기 {t.stalls.male} · 소변기 {t.stalls.urinal} / 여자 대변기 {t.stalls.female}
            </dd>
            {t.manager && (
              <>
                <dt>관리 기관</dt>
                <dd>{t.manager}</dd>
              </>
            )}
            {t.tel && (
              <>
                <dt>전화</dt>
                <dd>
                  <a href={`tel:${t.tel}`}>{t.tel}</a>
                </dd>
              </>
            )}
            {t.note && (
              <>
                <dt>참고</dt>
                <dd>{t.note}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </article>
  );
}
