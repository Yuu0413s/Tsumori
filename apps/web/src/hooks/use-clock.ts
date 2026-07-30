import { useEffect, useState } from "react";

/**
 * 現在時刻を1秒ごとに更新して返す。setInterval のカウントは積み上げず、
 * `now` だけを state に持ち、経過秒数は呼び出し側で毎レンダー計算する（導出状態）。
 * タブがバックグラウンドに回ると setInterval が間引かれてズレるため、
 * visibilitychange で復帰時にも再計算する。
 */
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return now;
}
