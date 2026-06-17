import { ListTablesCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event, context) => {
  let response;
  response = await handlePostRequest(event, context);
  return response;
};

const handleDeleteRequest = async (event) => {
  const { GameID } = JSON.parse(event.body);

  const command = new DeleteCommand({
    TableName: "GamesTable",
    Key: { GameID },
  });

  try {
    await docClient.send(command);
  } catch (err) {
    return {
        statusCode: 500,
        body: JSON.stringify({
          message: err.message,
        }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Game deleted successfully" }),
  };
};
