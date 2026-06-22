import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event) => {
  const attrs = event.request.userAttributes;

  await client.send(
    new PutCommand({
      TableName: "UserTable",
      Item: {
        username: event.userName,
        email: attrs.email,
        createdAt: new Date().toISOString(),
      },
    }),
  );

  return event;
};
