import { Logger } from '@tmap/logger';
import { TmapAWS } from '@tmap/aws';
import { constantCase } from 'change-case';

const AWS = new TmapAWS().getClient();
const cloudformation = new AWS.CloudFormation();
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const logger = Logger.create('tmap:gulp:cloudformation');
// Last stack wins if there are any clashes in the output name
const stacksWithOutputs = [process.env.STACK_NAME as string];

export const cloudformationOutputs = () =>
  Promise.all(stacksWithOutputs.map((s) => stackOutputs(s))).then((o) =>
    o.flat().reduce((acc, o) => ({ ...acc, ...{ [constantCase(o.key)]: o.value } }), {})
  );

const stackOutputs = (stackName: string) => {
  const stackOutputsRecurse = async (nextToken?, outputs: any[] = []) => {
    const result = await cloudformation.describeStacks({ StackName: stackName, NextToken: nextToken }).promise();
    const stackOutputs = result.Stacks?.find((s) => s.StackName === stackName)?.Outputs;
    if (stackOutputs?.length) {
      outputs = [
        ...outputs,
        ...stackOutputs.reduce(
          // Only exports with our special Description are worthy
          (acc, o) =>
            o.Description?.toUpperCase().startsWith('ENV')
              ? [...acc, { key: o.OutputKey!, value: o.OutputValue! }]
              : acc,
          []
        )
      ];
    }
    return result.NextToken ? stackOutputsRecurse(result.NextToken, outputs) : outputs;
  };
  return stackOutputsRecurse();
};
