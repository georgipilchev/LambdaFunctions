import { ListTablesCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event, context) => {

  // const groups =
  //   event.requestContext?.authorizer?.claims?.["cognito:groups"];

  // if (!groups || !groups.includes("Administrators")) {
  //   return {
  //     statusCode: 403,
  //     body: JSON.stringify({
  //       message: "Forbidden: Admins only",
  //     }),
  //   };
  // }

  return await handlePostRequest(event, context);
};


const handlePostRequest = async (event, context) => {
  const { Game, ImageLink } = JSON.parse(event.body);
  const slug = Game.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const command = new PutCommand({
    TableName: "GamesTable",
    Item: {
      GameID: context.awsRequestId,
      Game,
      slug,
      ImageLink,
    },
  });
  try {
    await docClient.send(command);

    return {
    statusCode: 200,
    body: JSON.stringify({ message: "Game added successfully" }),
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
};
