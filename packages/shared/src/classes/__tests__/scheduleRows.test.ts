import { expandProjectedClassScheduleRows } from '../scheduleRows';

describe('expandProjectedClassScheduleRows', () => {
  it('turns one Class into one timetable item per projected schedule row', () => {
    const result = expandProjectedClassScheduleRows([{
      class_id: 'class-1',
      day_of_week: 2,
      start_time: '13:00',
      end_time: '14:00',
      room: 'Legacy room',
      schedule_rows: [
        { id: 'row-1', day_of_week: 2, start_time: '13:00', end_time: '14:00', room: 'Room 1', position: 0 },
        { id: 'row-2', day_of_week: 3, start_time: '14:00', end_time: '15:00', room: 'Room 2', position: 1 },
      ],
    }]);

    expect(result).toHaveLength(2);
    expect(result.map((row) => row.class_id)).toEqual(['class-1', 'class-1']);
    expect(result.map((row) => [row.day_of_week, row.start_time, row.room])).toEqual([
      [2, '13:00', 'Room 1'],
      [3, '14:00', 'Room 2'],
    ]);
  });
});
