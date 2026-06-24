import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client } from "@aws-sdk/client-s3";
const s3 = new S3Client({});
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
  return await handleGetRequest(game);
};

const buildQueryInput = (game) => ({
  TableName: "ThumbnailTable",
  KeyConditionExpression: "Game = :game",
  ExpressionAttributeValues: {
    ":game": game,
  },
});

const handleGetRequest = async (game) => {
  if (!game) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Missing required query parameter 'game'.",
      }),
    };
  }

  const command = new QueryCommand(buildQueryInput(game));

  try {
    const result = await docClient.send(command);

    for (const item of result.Items) {
      const key = item.ThumbnailKey;

      item.ThumbnailUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: process.env.BUCKET_NAME,
          Key: key,
        }),
        { expiresIn: 3600 },
      );
    }

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
