import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // or your frontend URL
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function handler(event) {
  console.log(JSON.stringify(event, null, 2));

  const { Game, modId, version } = event.pathParameters ?? {};

  if (!Game || !modId || !version) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Game, modId and version are required",
      }),
    };
  }
  try {
    const versionRecord = await docClient.send(
      new GetCommand({
        TableName: "MainModTable",
        Key: { Game: Game, ModID: `VMOD#${modId}VERSION#${version}` },
      }),
    );

    if (!versionRecord.Item?.UploadKey) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ message: "Version not found" }),
      };
    }

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.BUCKET,
        Key: versionRecord.Item.UploadKey,
      }),
      {
        expiresIn: 120,
      },
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ url }),
    };
  } catch (err) {
    console.error("Download error", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Failed to generate download URL" }),
    };
  }
}
