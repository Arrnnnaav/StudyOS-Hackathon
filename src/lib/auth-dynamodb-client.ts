import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import type { DynamoDBDocument } from '@aws-sdk/lib-dynamodb'

type AuthCommand = GetCommand | PutCommand | QueryCommand | UpdateCommand | DeleteCommand | BatchWriteCommand
type V3DocumentClient = { send(command: AuthCommand): Promise<unknown> }

/**
 * Auth.js' DynamoDB adapter uses the AWS SDK v2 DocumentClient method shape.
 * StudyOS uses SDK v3, so this bridge converts each adapter operation to v3's
 * `client.send(new Command(input))` shape.
 */
export function asAuthDynamoClient(client: V3DocumentClient): DynamoDBDocument {
  return {
    get: (input: ConstructorParameters<typeof GetCommand>[0]) => client.send(new GetCommand(input)),
    put: (input: ConstructorParameters<typeof PutCommand>[0]) => client.send(new PutCommand(input)),
    query: (input: ConstructorParameters<typeof QueryCommand>[0]) => client.send(new QueryCommand(input)),
    update: (input: ConstructorParameters<typeof UpdateCommand>[0]) => client.send(new UpdateCommand(input)),
    delete: (input: ConstructorParameters<typeof DeleteCommand>[0]) => client.send(new DeleteCommand(input)),
    batchWrite: (input: ConstructorParameters<typeof BatchWriteCommand>[0]) => client.send(new BatchWriteCommand(input)),
  } as unknown as DynamoDBDocument
}
