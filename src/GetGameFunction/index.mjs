import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173", // or your frontend URL
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

  const gameslug = event.pathParameters?.Slug;
  if (!gameslug) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Missing required query parameter 'game'.",
      }),
    };
  }
  return await handleGetRequest(gameslug);
};

const buildGetInput = (gameslug) => ({
  TableName: "GamesTable",
  Key: {
    Slug: gameslug,
  },
});

const handleGetRequest = async (gameslug) => {
  const command = new GetCommand(buildGetInput(gameslug));

    try {
    const result = await docClient.send(command);

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.Item),
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





