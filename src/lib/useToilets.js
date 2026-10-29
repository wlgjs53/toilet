import { useEffect, useState } from 'react';

// 화장실 목록을 한 번 불러와 둡니다 (서버리스 함수가 하루 캐시).
export function useToilets() {
  const [state, setState] = useState({ items: [], loading: true, error: '' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/toilets')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || '화장실 정보를 불러오지 못했어요.');
        return data;
      })
      .then((data) => !cancelled && setState({ items: data.items, loading: false, error: '' }))
      .catch((e) => !cancelled && setState({ items: [], loading: false, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
