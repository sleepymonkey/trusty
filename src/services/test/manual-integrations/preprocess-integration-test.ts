import PreprocessService from '../../preprocess-service';
import S3Client from '../../s3-client';
import SnsClient from '../../sns-client';


/**
 * make actual calls out to AWS services. in order to see this execute, you must perform the following:
 * 1. make note of s3 bucket name (contained in output of cdk deploy)
 * 2. upload a zip file to that bucket
 * 3. remove '.skip' from the test method below
 * 
 * this should download the zip to your local computer, uncompress amd split the resulting CSV into a
 * number of smaller files. note we override the Sns client so events are not sent to actual topics in
 * our AWS environment.
 * 
 * test will not run as part of the automated suite.  can manually kick off in the IDE or from cli:
 * node 'node_modules/.bin/jest' './src/services/test/manual-integrations/preprocess-integration-test.ts' -t 'test unzip'
 * from root trusty directory.
 */

const AWS_S3_BUCKET = 'trustystack-statepropertydatae91b3a12-s8blybazhfzv';  // this must change!
const ZIP_FILE_IN_S3 = 'property-small.zip';

test.skip('test unzip', async () => {
    const etlService = new PreprocessService(new S3Client(), new MockSnsClient());
    const files = await etlService.ingestPropertyData(AWS_S3_BUCKET, ZIP_FILE_IN_S3);
    
    console.log(`list of files returned from preprocess service: ${files}`);
}, 900000)


class MockSnsClient extends SnsClient {
    constructor() {
        super();
        process.env.ETL_SNS_TOPIC = 'bunk';
    }
    async publishEvent(arn: string, jsonObj: any) {
        console.log('overriding sns client');
    }
}
