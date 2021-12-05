import 'source-map-support/register';
import Debug from 'debug';
import { Handler } from 'aws-lambda';
import { ScheduleStorage } from './service/schedule-storage.service';

const debug = Debug('schedule');

interface Shift {
  start: string;
  title: string;
  end: string;
};
interface ScheduleItem {
  schedule: Shift[];
}

export const handler: Handler = async (event) => {
  debug(event);

  const userId = process.env.DEFAULT_USER_ID as string;
  const storage = new ScheduleStorage();

  const scheduleInfo = (await storage.getSchedule(userId)) as ScheduleItem;
  const schedule = scheduleInfo.schedule.reduce((map, item) => {
    const key = item.start.slice(0, 10);
    if (map.has(key)) {
      map.set(key, [...map.get(key)!, item]);
    } else {
      map.set(key, [item]);
    }
    return map;
  }, new Map<string, Shift[]>());

  if (!schedule) {
    return {
      statusCode: 404
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(Object.fromEntries(schedule))
  };
};
