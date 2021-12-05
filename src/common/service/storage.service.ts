import AWS from 'aws-sdk';
import { DocumentClient, ItemList } from 'aws-sdk/clients/dynamodb';

export const HASH_KEY = 'hashKey';

export type ItemAttributes = DocumentClient.AttributeMap;

AWS.config.update({
  region: process.env.AWS_REGION as string
});

export interface Item {
  [HASH_KEY]: string;
  entity: string;
  createdAt: string;
  updatedAt?: string;
  attributes: ItemAttributes;
}

export class Storage {
  protected tableName: string;
  protected entity: string;
  protected ddbClient: DocumentClient;

  constructor(tableName: string, entity: string) {
    if (this.constructor === Storage) {
      throw new TypeError('Class "TmapStorage" cannot be instantiated directly.');
    }

    this.ddbClient = new AWS.DynamoDB.DocumentClient();
    this.entity = entity;
    this.tableName = tableName;
  }

  createItem(id: string, item: ItemAttributes) {
    const dbItem = {
      ...item,
      ...this._itemKey(id),
      createdAt: new Date().toISOString()
    };

    return this.ddbClient.put({ TableName: this.tableName, Item: dbItem }).promise();
  }

  // If an attribute is not included in the item, it will be left as is in the dynamo item
  // If an attribute is included with a value of undefined, it will be deleted from the dynamo item
  updateItem(id: string, item: ItemAttributes) {
    const dbItem = {
      ...item,
      updatedAt: new Date().toISOString()
    };

    const params = {
      TableName: this.tableName,
      Key: this._itemKey(id),
      UpdateExpression: '',
      ExpressionAttributeValues: {},
      ExpressionAttributeNames: {},
      ReturnValues: 'UPDATED_NEW'
    };

    let prefix = 'set';
    for (const attribute of Object.keys(dbItem).filter((key) => dbItem[key] !== undefined)) {
      const value = dbItem[attribute];
      if (
        Object.prototype.hasOwnProperty.call(value, 'expression') &&
        Object.prototype.hasOwnProperty.call(value, 'expressionValues')
      ) {
        params.UpdateExpression += `${prefix} #${attribute} = ${value.expression}`;
        params.ExpressionAttributeValues[`:${attribute}`] = value.expressionValue;
        params.ExpressionAttributeValues = { ...params.ExpressionAttributeValues, ...value.expressionValues };
      } else {
        params.UpdateExpression += `${prefix} #${attribute} = :${attribute}`;
        params.ExpressionAttributeValues[`:${attribute}`] = value;
      }
      params.ExpressionAttributeNames[`#${attribute}`] = attribute;
      prefix = ',';
    }

    prefix = ' remove';
    for (const attribute of Object.keys(dbItem).filter((key) => dbItem[key] === undefined)) {
      params.UpdateExpression += `${prefix} #${attribute}`;
      params.ExpressionAttributeNames[`#${attribute}`] = attribute;
      prefix = ',';
    }

    return this.ddbClient.update(params).promise();
  }

  async getItem(id: string): Promise<Item | undefined> {
    const res = await this.ddbClient.get({ TableName: this.tableName, Key: this._itemKey(id) }).promise();

    return this._itemFromDdb(res.Item);
  }

  private _itemFromDdb(itemAttributes: ItemAttributes | undefined): Item | undefined {
    if (!itemAttributes) {
      return;
    }

    const item = { ...itemAttributes };
    const hashKey = item[HASH_KEY];
    if (!hashKey) {
      return;
    }

    // Who needs delete
    const { entity, createdAt, updatedAt, [HASH_KEY]: hashkey, ...attributes } = item;

    return {
      [HASH_KEY]: hashKey,
      entity,
      createdAt,
      updatedAt,
      attributes
    } as Item;
  }

  private _itemKey(id: string) {
    return {
      [HASH_KEY]: `${this.entity}-${id}`,
      entity: this.entity
    };
  }

  protected itemsFromDdb(items: ItemList): Item[] {
    return items.map((i) => this._itemFromDdb(i)).filter(Boolean) as Item[];
  }

  scan() {
    const scanRecurse = async (results: ItemList = [], startKey?: DocumentClient.Key): Promise<ItemList> => {
      const res = await this.ddbClient.scan({ TableName: this.tableName, ExclusiveStartKey: startKey }).promise();
      results = [...results, ...(res.Items || [])];
      return res.LastEvaluatedKey ? scanRecurse(results, res.LastEvaluatedKey) : results;
    };
    return scanRecurse().then((items) => this.itemsFromDdb(items));
  }
}
