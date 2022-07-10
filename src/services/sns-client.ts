import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

export default class SnsClient {
    snsClient: SNSClient;

    constructor() {
        this.snsClient = new SNSClient({});
    }

    async publishEvent(arn: string, jsonObj: any): Promise<void> {
        var params = {
            Message: JSON.stringify(jsonObj),
            TopicArn: arn
          };

          try {
            const data = await this.snsClient.send(new PublishCommand(params));
            console.log(`successfully published to topic: ${jsonObj}`, data);
          } 
          catch (err) {
            console.log(`error attempting to publish to topic: ${jsonObj}`, err);
          }
    }
}
