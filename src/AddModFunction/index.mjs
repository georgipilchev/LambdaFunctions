import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);
const s3 = new S3Client({});

export const handler = async (event, context) => {
  const groups = event.requestContext?.authorizer?.claims?.["cognito:groups"];

  if (!groups || !groups.includes("Users")) {
    return {
      statusCode: 403,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Forbidden: Registered users only",
      }),
    };
  }

  return await handlePostRequest(event);
};

const handlePostRequest = async (event) => {
  try {
    const body = JSON.parse(event.body);

    const modId = randomUUID();
    const modSK = `MOD#${modId}`;

    // Create DynamoDB entry
    await docClient.send(
      new PutCommand({
        TableName: "MainModTable",
        Item: {
          Game: body.Game,
          ModID: modSK,
          gameSlug: body.Game.toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
          modId,
          Name: body.Name,
          Description: body.Description,
          Author: body.Author,
          Status: "Uploading",
          SubmissionDate: new Date().toISOString(),
        },
      }),
    );

    // Create version metadata and signed upload URL (if version provided)
    const version = body.Version || body.version;
    let versionData = {};

    if (version) {
      const uploadKey = `mods/${body.Game}/${modId}/versions/${version}.zip`;
      const versionSK = `MOD#${modId}#VERSION#${version}`;
      await docClient.send(
        new PutCommand({
          TableName: "MainModTable",
          Item: {
            Game: body.Game,
            ModID: versionSK,
            Version: version,
            game: body.Game,
            Description: body.Description || "",
            MainImageUrl: "", // Will be updated after image upload
            Status: "PendingUpload",
            UploadKey: uploadKey,
            CreatedAt: new Date().toISOString(),
          },
        }),
      );

      const versionDataUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({
          Bucket: process.env.BUCKET,
          Key: uploadKey,
          ContentType: "application/zip",
        }),
        { expiresIn: 300 },
      );

      versionData = { uploadKey, versionDataUrl };
    }

    // Generate signed URLs for images so the client can upload directly
    const extraImagesCount = body.extraImages || 0;
    const mainImageKey = `mods/${body.Game}/${modId}/images/main/original`;
    const mainImageUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: process.env.BUCKET,
        Key: mainImageKey,
        ContentType: "image/*",
      }),
      { expiresIn: 300 },
    );

    const extraImageUrls = [];
    const extraImageKeys = [];
    for (let i = 0; i < extraImagesCount; i++) {
      const key = `mods/${body.Game}/${modId}/images/extra/${i}`;
      extraImageKeys.push(key);
      extraImageUrls.push(
        await getSignedUrl(
          s3,
          new PutObjectCommand({
            Bucket: process.env.BUCKET,
            Key: key,
            ContentType: "image/*",
          }),
          { expiresIn: 300 },
        ),
      );
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Mod submission successful",

        modId,

        versionZipUrl: versionData.versionDataUrl || null,
        versionZipKey: versionData.uploadKey || null,

        mainImageUrl: mainImageUrl,
        mainImageKey: mainImageKey,

        extraImageUrls: extraImageUrls,
        extraImageKeys: extraImageKeys,
      }),
    };
  } catch (err) {
    console.error(err);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: err.message,
      }),
    };
  }
};
