import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event, context) => {
  let response;
  response = await handleGetRequest(event, context);
  return response;
};

const handleGetRequest = async () => {
    const command = new ScanCommand({
        TableName: "GamesTable",
    });
    try {
        const result = await docClient.send(command);
        return {
            statusCode: 200,
            body: JSON.stringify(result.Items),
        };
    }
    catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: err.message,
            }),
        };
    }
}

