import { Storage } from '../../common/service';

const ENTITY_TYPE = 'schedule';

export class ScheduleStorage extends Storage {
  constructor(tableName = process.env.DYNAMO_TABLE as string) {
    super(tableName, ENTITY_TYPE);
  }

  getSchedule(userId: string) {
    return this.getItem(userId).then((i) => i.attributes);
  }

  saveSchedule(userId: string, schedule: any) {
    return this.createItem(userId, schedule);
  }
}
