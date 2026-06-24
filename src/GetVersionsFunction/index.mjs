import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // or your frontend URL
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export const handler = async (event, context) => {
  // Handle browser preflight request
  if (
    event.requestContext?.http?.method === "OPTIONS" ||
    event.httpMethod === "OPTIONS"
  ) {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }
  const game = event.pathParameters?.Game;
  const modId = event.pathParameters?.modId;
  if (!game || !modId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Missing required query parameter 'game' or 'modId'.",
      }),
    };
  }
  return await handleGetRequest(game, modId);
};

const buildQueryInput = (game, modId) => ({
  TableName: "MainModTable",
  KeyConditionExpression: "Game = :game AND begins_with(ModID, :modIdPrefix)",
  ExpressionAttributeValues: {
    ":game": game,
    ":modIdPrefix": `VMOD#${modId}`,
  },
});

const handleGetRequest = async (game, modId) => {
  const command = new QueryCommand(buildQueryInput(game, modId));

  try {
    const result = await docClient.send(command);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result.Items),
    };
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: err.message,
      }),
    };
  }
};
