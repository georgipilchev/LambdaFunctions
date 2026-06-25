import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  const groups = event.requestContext?.authorizer?.claims?.["cognito:groups"];

  if (!groups || !groups.includes("Administrators")) {
    return {
      statusCode: 403,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:5173",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        message: "Forbidden: Admins only",
      }),
    };
  }

  return await handleDeleteRequest(event);
};

const handleDeleteRequest = async (event) => {
  const { GameID } = JSON.parse(event.body);

  const command = new DeleteCommand({
    TableName: "GamesTable",
    Key: { GameID },
  });

  try {
    await docClient.send(command);
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:5173",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        message: "Game deleted successfully",
      }),
    };
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "http://localhost:5173",
        "Cache-Control": "no-store"
      },
      body: JSON.stringify({
        message: err.message,
      }),
    };
  }
};
