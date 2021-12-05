import 'source-map-support/register';
import Debug from 'debug';
import { Handler } from 'aws-lambda';
import { ScheduleStorage } from './service/schedule-storage.service';

const debug = Debug('schedule');

export const handler: Handler = async (event) => {
  debug(event);
  const date = event.queryStringParameters?.date;

  if (!date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid date' })
    };
  }

  const userId = process.env.DEFAULT_USER_ID as string;
  const storage = new ScheduleStorage();

  const scheduleInfo = await storage.getSchedule(userId);
  const schedule = scheduleInfo.schedule.find((s) => s.start.startsWith(date));

  if (!schedule) {
    return {
      statusCode: 404
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(schedule)
  };
};
