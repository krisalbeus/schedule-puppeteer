import type { AWS } from '@serverless/typescript';
import { PartialAwsConfig } from '@tmap/serverless';
import { all as mergeObjects } from 'deepmerge';

export const baseService = (customConf: PartialAwsConfig = {}, addons: PartialAwsConfig[] = []) =>
  mergeObjects([
    {
      frameworkVersion: '2.50.0',
      service: process.env.APPLICATION!,
      configValidationMode: 'error',
      variablesResolutionMode: '20210326',
      // Remove this when serverless 3
      enableLocalInstallationFallback: true,
      // Silence some console noise
      disabledDeprecations: [
        'LOAD_VARIABLES_FROM_ENV_FILES',
        // These dont work but are suppose to - sls bug?
        'DISABLE_LOCAL_INSTALLATION_FALLBACK_SETTING',
        'CLI_OPTIONS_SCHEMA'
      ],
      package: {
        individually: false
      },
      plugins: ['serverless-dotenv-plugin', 'serverless-plugin-log-retention', 'serverless-webpack'],
      custom: {
        // A note - serverless itself will fetch and auto parse the secret and create sub properties from here that can be referenced below
        dotenv: {
          logging: false,
          // Document in readme these must be in .envrc
          // STACK_NAME can go once m2m -> reports old APIGW calls are fully gone
          include: ['APPLICATION', 'ENVIRONMENT', 'CORE_STACK', 'STACK_NAME']
        },
        logRetentionInDays: 90,
        webpack: {
          webpackConfig: 'webpack.serverless.config.ts',
          excludeFiles: 'src/**/*.test.ts',
          packager: 'yarn',
          packagerOptions: {
            scripts: [
              'npx rimraf ./node_modules/**/{aws-sdk,@types,.bin}/**/*.* yarn.lock',
              'npx modclean --run --patterns="default:safe" --modules-dir=./node_modules --ignore="**/makefile.js" --additional-patterns="yarn.lock"'
            ]
          },
          includeModules: {
            forceExclude: ['aws-sdk']
          }
        }
      },
      provider: {
        name: 'aws',
        runtime: 'nodejs14.x',
        apiGateway: {
          shouldStartNameWithService: true
        },
        endpointType: 'REGIONAL',
        stage: process.env.ENVIRONMENT,
        region: process.env.AWS_REGION as AWS['provider']['region'],
        // // TODO: New account level deployment bucket with region in it's name so we can be region agnostic
        // deploymentBucket: `sls-${process.env.UNIT}-${process.env.DOMAIN}-deployments`,
        versionFunctions: false,
        stackTags: {
          APPLICATION: process.env.APPLICATION as string,
          ENVIRONMENT: process.env.ENVIRONMENT as string
        },
        environment: {
          AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
          // Allows local override for invoke local + offline with fallback to defaults
          DEBUG: `\${env:DEBUG, 'schedule*'}`,
          DEBUG_DEPTH: `\${env:DEBUG_DEPTH, '6'}`,
          DEBUG_HIDE_DATE: 'true',
          DEBUG_LEVEL: `\${env:DEBUG_LEVEL, 'info'}`,
          TZ_LOCAL: 'Australia/Sydney'
        },
        // Arguable default
        timeout: 30,
        // Serverless default but let's specify to remind us to tune.
        memorySize: 1024
        // // TODO: Datagw accounts should have same exports!
        // vpc: {
        //   securityGroupIds: [{ 'Fn::ImportValue': `${process.env.CORE_STACK}-VpcLambdaSecurityGroupId` }],
        //   subnetIds: [
        //     { 'Fn::ImportValue': `sls-${process.env.UNIT}-LambdaSubnetA` },
        //     { 'Fn::ImportValue': `sls-${process.env.UNIT}-LambdaSubnetB` },
        //     { 'Fn::ImportValue': `sls-${process.env.UNIT}-LambdaSubnetC` }
        //   ]
        // },
      }
    },
    customConf,
    ...addons
  ]);

const funziesConf = (): PartialAwsConfig => ({
  plugins: ['serverless-offline'],
  custom: {
    ...serverlessOfflineConfig(),
    webpack: {
      includeModules: {
        forceExclude: ['chrome-aws-lambda']
      }
    },
    dynamoTable: '${env:DYNAMO_TABLE, self:custom.defaults.dynamoTable}',
    defaults: {
      dynamoTable: { Ref: 'DynamoTable' }
    }
  },
  provider: {
    runtime: 'nodejs14.x',
    environment: {
      DYNAMO_TABLE: '${self:custom.dynamoTable}'
    },
    iam: {
      role: {
        statements: [
          {
            Effect: 'Allow',
            Action: [
              'dynamodb:GetItem',
              'dynamodb:PutItem',
              'dynamodb:UpdateItem',
              'dynamodb:DeleteItem',
              'dynamodb:BatchWriteItem',
              'dynamodb:BatchGetItem',
              'dynamodb:Query',
              'dynamodb:Scan'
            ],
            Resource: [
              { 'Fn::GetAtt': ['DynamoTable', 'Arn'] },
              { 'Fn::Join': ['/', [{ 'Fn::GetAtt': ['DynamoTable', 'Arn'] }, 'index/*']] }
            ]
          }
        ]
      }
    }
  },
  functions: {
    schedule: {
      handler: 'src/schedule/schedule.handler',
      environment: {
        DEBUG_LEVEL: 'debug',
        DEBUG: 'schedule*',
        DEFAULT_USER_ID: '60245626'
      },
      timeout: 900,
      memorySize: 2048,
      layers: [{ Ref: 'ChromeLambdaLayer' }],
      events: [
        {
          schedule: 'cron(0 14 ? * MON *)'
        },
        {
          http: 'PATCH /schedules/update'
        }
      ]
    },
    getSchedule: {
      handler: 'src/schedule/get-schedule.handler',
      environment: {
        DEFAULT_USER_ID: '60245626'
      },
      events: [
        {
          http: 'GET /schedule'
        }
      ]
    },
    getSchedules: {
      handler: 'src/schedule/get-schedules.handler',
      environment: {
        DEFAULT_USER_ID: '60245626'
      },
      events: [
        {
          http: 'GET /schedules'
        }
      ]
    }
  },
  layers: {
    chrome: {
      path: 'chrome-layer-1',
      name: `${process.env.ENVIRONMENT}-chrome`,
      description: 'Chromium',
      compatibleRuntimes: ['nodejs14.x']
    }
  },
  resources: {
    Resources: {
      DynamoTable: {
        Type: 'AWS::DynamoDB::Table',
        Properties: {
          AttributeDefinitions: [
            {
              AttributeName: 'hashKey',
              AttributeType: 'S'
            },
            {
              AttributeName: 'entity',
              AttributeType: 'S'
            }
          ],
          KeySchema: [
            {
              AttributeName: 'hashKey',
              KeyType: 'HASH'
            },
            {
              AttributeName: 'entity',
              KeyType: 'RANGE'
            }
          ],
          BillingMode: 'PAY_PER_REQUEST',
          SSESpecification: {
            // Uses default AWS DynamoDB  master key
            SSEEnabled: true
          },
          PointInTimeRecoverySpecification: {
            PointInTimeRecoveryEnabled: true
          }
        }
      }
    },
    Outputs: {
      DynamoTable: { Description: 'ENV - Dynamo table', Value: { Ref: 'DynamoTable' } }
    }
  }
});

const serverlessOfflineConfig = () => ({
  'serverless-offline': {
    httpPort: uniquePort(process.env.APPLICATION as string, 4000),
    lambdaPort: uniquePort(process.env.APPLICATION as string, 3000),
    // TODO: Revisit for bffe offline - use to be occasionally useful to "steal web client JWT token" and use as authorization header to get userId etc
    noAuth: true,
    noPrependStageInUrl: true,
    useChildProcesses: true
  }
});

const uniquePort = (str: string, start: number, range = 1000) => {
  let i = str.length;
  let hash1 = 5381;
  let hash2 = 52_711;

  while (i--) {
    const char = str.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }
  return (((hash1 >>> 0) * 4096 + (hash2 >>> 0)) % range) + start;
};

// Must be last
module.exports = baseService(funziesConf());
