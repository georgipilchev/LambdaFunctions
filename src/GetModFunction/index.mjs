import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
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

const buildGetInput = (game, modId) => ({
  TableName: "MainModTable",
  Key: {
    Game: game,
    ModID: `MOD#${modId}`,
  },
});

const handleGetRequest = async (game, modId) => {
  const command = new GetCommand(buildGetInput(game, modId));
  try {
    const result = await docClient.send(command);
    const key = result.Item.MainImageKey;

    result.Item.MainImageUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.BUCKET,
        Key: key,
      }),
      { expiresIn: 3600 },
    );

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
