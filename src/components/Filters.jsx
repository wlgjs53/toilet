const OPTIONS = [
  { key: 'openNow', label: '⏰ 지금 열린 곳만' },
  { key: 'bell', label: '🔔 비상벨' },
  { key: 'cctv', label: '📹 CCTV' },
  { key: 'diaper', label: '👶 기저귀 교환대' },
  { key: 'accessible', label: '♿ 장애인용' },
];

export default function Filters({ value, onChange }) {
  return (
    <div className="filters" role="group" aria-label="필터">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          className={`chip ${value[o.key] ? 'on' : ''}`}
          aria-pressed={value[o.key]}
          onClick={() => onChange({ ...value, [o.key]: !value[o.key] })}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
