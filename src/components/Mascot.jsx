// 토일렛이슈 마스코트: 방긋 웃는 변기 친구
export default function Mascot({ size = 56, mood = 'happy', className = '' }) {
  const sad = mood === 'sad';
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="토일렛이슈 마스코트">
      {/* 물탱크 */}
      <rect x="14" y="4" width="36" height="16" rx="6" fill="#fff" stroke="#3d3550" strokeWidth="3" />
      <rect x="40" y="8" width="6" height="4" rx="2" fill="#8ecbff" />
      {/* 변기 몸통 */}
      <path
        d="M10 24 H54 C54 40 48 52 40 56 V60 H24 V56 C16 52 10 40 10 24 Z"
        fill="#fff"
        stroke="#3d3550"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <ellipse cx="32" cy="24" rx="22" ry="5" fill="#bfe8ff" stroke="#3d3550" strokeWidth="3" />
      {/* 얼굴 */}
      {sad ? (
        <>
          <path d="M22 38 q3 -3 6 0" stroke="#3d3550" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M36 38 q3 -3 6 0" stroke="#3d3550" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M27 49 q5 -4 10 0" stroke="#3d3550" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="25" cy="38" r="3" fill="#3d3550" />
          <circle cx="39" cy="38" r="3" fill="#3d3550" />
          <path d="M27 45 q5 6 10 0" stroke="#3d3550" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      )}
      <circle cx="19" cy="44" r="3.2" fill="#ff9db5" opacity="0.9" />
      <circle cx="45" cy="44" r="3.2" fill="#ff9db5" opacity="0.9" />
    </svg>
  );
}
