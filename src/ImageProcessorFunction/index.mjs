import sharp from "sharp";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function handler(event) {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const keyParts = key.split("/");

    if (
      keyParts.length < 5 ||
      keyParts[0] !== "mods" ||
      keyParts[3] !== "images"
    ) {
      console.warn("Skipping unrecognized key", key);
      continue;
    }

    const game = keyParts[1];
    const modId = keyParts[2];
    const modSK = `MOD#${modId}`;

    if (
      keyParts[3] !== "images" ||
      keyParts[4] !== "main" ||
      keyParts[5] !== "original"
    ) {
      console.warn("Skipping non-primary image key", key);
      continue;
    }

    const modResponse = await docClient.send(
      new GetCommand({
        TableName: "MainModTable",
        Key: { Game: game, ModID: modSK },
      }),
    );

    if (!modResponse.Item) {
      console.error("Mod item not found", { Game: game, ModID: modSK });
      continue;
    }

    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    const buffer = await streamToBuffer(response.Body);
    const resized = await sharp(buffer)
      .resize(1600, 1600, {
        fit: "inside",
      })
      .webp({
        quality: 85,
      })
      .toBuffer();

    const mainKey = `mods/${game}/${modId}/images/main.webp`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: mainKey,
        Body: resized,
        ContentType: "image/webp",
      }),
    );

    const thumb = await sharp(buffer)
      .resize(300, 300, {
        fit: "cover",
      })
      .webp({
        quality: 80,
      })
      .toBuffer();

    const thumbKey = `mods/${game}/${modId}/images/thumb.webp`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: thumbKey,
        Body: thumb,
        ContentType: "image/webp",
      }),
    );

    await docClient.send(
      new UpdateCommand({
        TableName: "MainModTable",
        Key: { Game: game, ModID: modSK },
        UpdateExpression: "SET MainImageKey = :mainKey, #s = :status",
        ExpressionAttributeNames: {
          "#s": "Status",
        },
        ExpressionAttributeValues: {
          ":mainKey": mainKey,
          ":status": "Finished",
        },
      }),
    );

    await docClient.send(
      new PutCommand({
        TableName: "ThumbnailTable",
        Item: {
          Game: game,
          "SubmissionDate+ModID": `${modResponse.Item.SubmissionDate}#${modSK}`,
          ModID: modId,
          Name: modResponse.Item.Name,
          ThumbnailKey: thumbKey,
          SubmissionDate: modResponse.Item.SubmissionDate,
        },
      }),
    );
  }
}
