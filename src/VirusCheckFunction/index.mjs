import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client({});

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

const VT_API_KEY = process.env.VT_API_KEY;
const VT_BASE_URL = "https://www.virustotal.com/api/v3";

export async function handler(event) {
  const record = event.Records[0];
  const bucket = record.s3.bucket.name;
  const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
  console.log(`Scanning ${key} in ${bucket}`);
  const clean = await scanFile(bucket, key);
  const { Game, modId, version } = parseVersionKey(key);

  if (!Game || !modId || !version) {
    console.error("Unable to parse version key", key);
    return;
  }

  const status = clean ? "Ready" : "Blocked";

  try {
    await updateVersionStatus(Game, modId, version, status);
  } catch (err) {
    console.error("Failed DynamoDB update", err);
  }
  // Bad file -> delete
  if (!clean) {
    console.log("Deleting malicious object");

    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }
}

// Returns:
// true  = safe / unknown
// false = malicious
async function scanFile(bucket, key) {
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    // Stream object to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);

    console.log(`File size: ${fileBuffer.length} bytes`);

    // Get upload URL from VirusTotal
    const uploadUrlResponse = await fetch(`${VT_BASE_URL}/files/upload_url`, {
      method: "GET",
      headers: {
        "x-apikey": VT_API_KEY,
      },
    });

    if (!uploadUrlResponse.ok) {
      throw new Error(
        `Failed to get upload URL: ${uploadUrlResponse.statusText}`,
      );
    }

    const uploadUrlData = await uploadUrlResponse.json();
    const uploadUrl = uploadUrlData.data;

    console.log("Uploading file to VirusTotal");

    // Upload file to the obtained URL
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([fileBuffer], { type: "application/zip" }),
      key.split("/").pop(),
    );

    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "x-apikey": VT_API_KEY,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`File upload failed: ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    const analysisId = uploadResult.data.id;

    console.log("File uploaded, analysis ID:", analysisId);
    console.log("Polling for analysis results...");

    // Poll for analysis results
    const stats = await pollAnalysisResults(analysisId);

    console.log("VT scan results:", stats);

    if (stats.malicious > 3) {
      console.log("Threshold reached. File is malicious.");
      console.log(
        JSON.stringify(
          {
            analysisId,
            stats,
          },
          null,
          2,
        ),
      );
      return false;
    }

    console.log("File passed scan");
    return true;
  } catch (err) {
    console.error("Scan error", err);
    return false;
  }
}

async function pollAnalysisResults(
  analysisId,
  maxAttempts = 50,
  delayMs = 5000,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${VT_BASE_URL}/analyses/${analysisId}`, {
        method: "GET",
        headers: {
          "x-apikey": VT_API_KEY,
        },
      });

      if (!response.ok) {
        console.error(
          `Attempt ${attempt + 1}: Failed to get analysis - ${response.statusText}`,
        );
        await sleep(delayMs);
        continue;
      }

      const analysisData = await response.json();
      const status = analysisData.data.attributes.status;

      console.log(`Attempt ${attempt + 1}: Analysis status = ${status}`);

      if (status === "completed") {
        return analysisData.data.attributes.stats;
      }

      if (attempt < maxAttempts - 1) {
        await sleep(delayMs);
      }
    } catch (err) {
      console.error(`Attempt ${attempt + 1}: Polling error`, err);
      if (attempt < maxAttempts - 1) {
        await sleep(delayMs);
      }
    }
  }

  throw new Error(`Analysis did not complete within ${maxAttempts} attempts`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseVersionKey(key) {
  const parts = key.split("/");
  // mods/{game}/{modId}/versions/{version}.zip
  if (parts.length < 5 || parts[0] !== "mods" || parts[3] !== "versions") {
    return {};
  }
  return {
    Game: parts[1],
    modId: parts[2],
    version: parts[4].replace(/\.zip$/i, ""),
  };
}

async function updateVersionStatus(Game, modId, version, status) {
  const versionSK = `VMOD#${modId}#VERSION#${version}`;

  await docClient.send(
    new UpdateCommand({
      TableName: "MainModTable",
      Key: {
        Game,
        ModID: versionSK,
      },
      UpdateExpression: "SET #s = :status, ScannedAt = :now",
      ExpressionAttributeNames: {
        "#s": "Status",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":now": new Date().toISOString(),
      },
    }),
  );
}
