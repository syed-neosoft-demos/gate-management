import { useEffect, useState } from "react";

export function useClock() {
  const [time, setTime] = useState("--:--:--");
  const [date, setDate] = useState("—");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString());
      setDate(
        now.toLocaleDateString([], {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      );
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  return { time, date };
}
