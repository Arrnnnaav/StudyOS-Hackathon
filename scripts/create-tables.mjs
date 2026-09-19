// Creates the DynamoDB tables StudyOS expects, against a local endpoint.
// Run: node scripts/create-tables.mjs
import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
  ResourceInUseException,
} from '@aws-sdk/client-dynamodb'

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8001',
  credentials: { accessKeyId: 'dummy', secretAccessKey: 'dummy' },
})

const tables = {
  StudyOSUsers: { GSI: true },
  StudyOSProgress: { GSI: false },
  StudyOSAsks: { GSI: true },
  StudyOSReviews: { GSI: true },
  StudyOSEvents: { GSI: false },
  StudyOSExtensionTokens: { GSI: false },
  StudyOSPairingCodes: { GSI: false },
  StudyOSAskSafety: { GSI: false },
  StudyOSOrganizations: { GSI: false },
}

// All StudyOS tables use PK (partition) + SK (sort), string keys.
const gsi = {
  IndexName: 'GSI1',
  KeySchema: [
    { AttributeName: 'GSI1PK', KeyType: 'HASH' },
    { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
  ],
  Projection: { ProjectionType: 'ALL' },
}

async function ensure(table, withGsi) {
  const attrDefs = [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
  ]
  if (withGsi) attrDefs.push({ AttributeName: 'GSI1PK', AttributeType: 'S' }, { AttributeName: 'GSI1SK', AttributeType: 'S' })

  const params = {
    TableName: table,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: attrDefs,
    BillingMode: 'PAY_PER_REQUEST',
  }
  if (withGsi) params.GlobalSecondaryIndexes = [gsi]

  try {
    await client.send(new CreateTableCommand(params))
    return `${table}: created`
  } catch (e) {
    if (e instanceof ResourceInUseException) return `${table}: already exists`
    throw e
  }
}

const existing = (await client.send(new ListTablesCommand({}))).TableNames || []
console.log('Existing tables:', JSON.stringify(existing))

for (const [name, opt] of Object.entries(tables)) {
  console.log(await ensure(name, opt.GSI))
}
console.log('Done.')
