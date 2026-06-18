import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // or your frontend URL
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export const handler = async (event, context) => {

  // Handle browser preflight request
  if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  return await handleGetRequest();
};

const handleGetRequest = async () => {
  const command = new ScanCommand({
    TableName: "GamesTable",
  });

  try {
    const result = await docClient.send(command);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result.Items),
    };
  }
  catch (err) {
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