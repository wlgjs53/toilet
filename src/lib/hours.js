// 개방 시간 문장을 해석해서 "지금 열려 있나?" 를 어림으로 알려 줍니다.
// 반환: { state: 'open' | 'closed' | 'unknown', label }
//  - 예) "연중무휴", "(평일/주말)09:00~18:00", "(평일)09:00~18:00/주말휴무",
//        "(평일/주말)09:00~18:00/월요일휴무"
// 형식이 다양해서 100% 정확하지 않으니, 화면에도 원문을 함께 보여 줍니다.
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function openStatus(text, now = new Date()) {
  const t = (text || '').replace(/\s+/g, '');
  if (!t) return { state: 'unknown', label: '개방 시간 정보 없음' };
  if (/24시간|상시|연중무휴/.test(t) && !/\d{1,2}:\d{2}~/.test(t)) {
    return { state: 'open', label: '연중무휴' };
  }

  const m = t.match(/(\d{1,2}):(\d{2})~(\d{1,2}):(\d{2})/);
  if (!m) return { state: 'unknown', label: '개방 시간 확인 필요' };

  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  // 쉬는 요일 (예: "월요일휴무", "월요일휴관")
  const off = t.match(/([월화수목금토일])요일휴[무관]/);
  if (off && off[1] === DAYS[day]) return { state: 'closed', label: `오늘(${off[1]}요일) 휴무` };
  // 주말 휴무 / 평일만 개방
  if (isWeekend && (/주말휴[무관]/.test(t) || (/^\(평일\)/.test(t) && !/\(평일\/주말\)/.test(t)))) {
    return { state: 'closed', label: '주말 휴무' };
  }

  const cur = now.getHours() * 60 + now.getMinutes();
  const start = +m[1] * 60 + +m[2];
  const end = +m[3] * 60 + +m[4];
  const open = end > start ? cur >= start && cur < end : cur >= start || cur < end;
  const range = `${m[1].padStart(2, '0')}:${m[2]}~${m[3].padStart(2, '0')}:${m[4]}`;
  return open
    ? { state: 'open', label: `영업 중 · ${range}` }
    : { state: 'closed', label: `지금은 닫음 · ${range}` };
}
