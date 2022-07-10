import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { S3Client as client, GetObjectCommand } from "@aws-sdk/client-s3";

export default class S3Client {
    // in case i start running into timeout problems
    // https://stackoverflow.com/questions/70625366/streaming-files-from-aws-s3-with-nodejs

    async streamToDirectory(bucket: string, s3ObjPath: string, filePath: string) {
        const params = {
            Bucket: bucket,
            Key: s3ObjPath 
        };

        try {
            console.log(`instantiating s3 client. downloading s3 obj: ${params.Bucket}/${params.Key} to: ${filePath}`);
            const s3 = new client({});
            const data = await s3.send(new GetObjectCommand(params));

            await pipeline(data.Body, createWriteStream(filePath));

            console.log('downloading file from s3 complete!');
        }
        catch (e) {
            console.log(`error downloading s3 object: ${params.Bucket}/${params.Key}`, e)
        }
    }
}
