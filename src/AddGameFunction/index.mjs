import { ListTablesCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  UpdateCommand,
  PutCommand,
  DynamoDBDocumentClient,
  ScanCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const georgi = 1;
const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event, context) => {
  let response;
  response = await handlePostRequest(event, context);
  return response;
};

const handlePostRequest = async (event, context) => {
  const { Game, ImageLink } = JSON.parse(event.body);

  const command = new PutCommand({
    TableName: "GamesTable",
    Item: {
      GameID: context.awsRequestId,
      Game,
      ImageLink,
    },
  });

  await docClient.send(command);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Game added successfully" }),
  };
};
