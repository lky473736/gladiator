import { useMemo } from 'react';
import '../styles/StreakCalendar.css';

function StreakCalendar({ streakData, color }) {
  const getColorIntensity = (count) => {
    if (count === 0) return 'level-0';
    if (count === 1) return 'level-1';
    if (count <= 3) return 'level-2';
    if (count <= 5) return 'level-3';
    return 'level-4';
  };

  const generateCalendarData = () => {
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    const weeks = [];
    let currentDate = new Date(oneYearAgo);

    // 시작일을 일요일로 조정
    const dayOfWeek = currentDate.getDay();
    currentDate.setDate(currentDate.getDate() - dayOfWeek);

    while (currentDate <= today) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const streakEntry = streakData.find(s => s.date.split('T')[0] === dateStr);
        const count = streakEntry ? streakEntry.problem_count : 0;

        week.push({
          date: new Date(currentDate),
          dateStr: dateStr,
          count: count,
          level: getColorIntensity(count)
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    return weeks;
  };

  const weeks = useMemo(() => generateCalendarData(), [streakData]);

  return (
    <div className="streak-calendar">
      <div className="streak-weeks">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="streak-week">
            {week.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className={`streak-day ${day.level} color-${color}`}
                title={`${day.dateStr}: ${day.count}개 문제`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="streak-legend">
        <span>Less</span>
        <div className={`legend-box level-0 color-${color}`} />
        <div className={`legend-box level-1 color-${color}`} />
        <div className={`legend-box level-2 color-${color}`} />
        <div className={`legend-box level-3 color-${color}`} />
        <div className={`legend-box level-4 color-${color}`} />
        <span>More</span>
      </div>
    </div>
  );
}

export default StreakCalendar;
