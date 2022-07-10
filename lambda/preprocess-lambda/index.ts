import PreprocessService from '../../src/services/preprocess-service';
import S3Client from '../../src/services/s3-client';
import SnsClient from '../../src/services/sns-client';


 exports.handler = async (event: any, context: any) => {
    console.log('inside preprocess lambda. event:', JSON.stringify(event, null, 2));       

    let bucket = '';
    let objPath = '';

    // events can come from the s3 trigger OR the new sns topic event.
    const record = event.Records[0];
    console.log('record:', JSON.stringify(record));

    if (record.Sns) {
        const json = await JSON.parse(record.Sns.Message);
        bucket = json.bucket;
        objPath = json.key;
    }
    else {
        bucket = record.s3.bucket.name;
        objPath = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
    }
  
    try {
        const preprocessService = new PreprocessService(new S3Client(), new SnsClient());
        await preprocessService.ingestPropertyData(bucket, objPath);
    }
    catch (e) {
        console.log('error executing preprocess lambda', e);
    }
  }
  
