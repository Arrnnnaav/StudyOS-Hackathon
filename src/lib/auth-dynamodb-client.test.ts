import test from 'node:test'
import assert from 'node:assert/strict'
import { DynamoDBAdapter } from '@auth/dynamodb-adapter'
import { QueryCommand } from '@aws-sdk/lib-dynamodb'
import { asAuthDynamoClient } from './auth-dynamodb-client.ts'

test('Auth.js account lookup works through an AWS SDK v3 document client', async () => {
  const commands: unknown[] = []
  const v3Client = {
    send: async (command: unknown) => {
      commands.push(command)
      return { Items: [] }
    },
  }
  const adapter = DynamoDBAdapter(asAuthDynamoClient(v3Client), {
    tableName: 'StudyOSUsers', partitionKey: 'PK', sortKey: 'SK', indexName: 'GSI1', indexPartitionKey: 'GSI1PK', indexSortKey: 'GSI1SK',
  })

  assert.equal(await adapter.getUserByAccount!({ provider: 'google', providerAccountId: 'account-1' }), null)
  assert.equal(commands.length, 1)
  assert.ok(commands[0] instanceof QueryCommand)
})
