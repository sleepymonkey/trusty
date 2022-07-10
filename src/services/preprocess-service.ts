import { Extract } from 'unzipper';
import { createReadStream, createWriteStream, readdirSync, mkdirSync, unlink } from 'fs';
import { pipeline } from 'stream/promises';
import { v4 as uuidv4 } from 'uuid';
const csvSplitStream = require('csv-split-stream');
import { extname, join } from 'path'
import S3Client from './s3-client';
import SnsClient from './sns-client';
import InitDal from '../db/impl/init-dal';

const CSV_ROOT_PATH = process.env.CSV_ROOT_PATH || '/tmp';  // we use /tmp when testing locally
const SPLIT_FILE_LINE_COUNT = process.env.SPLIT_FILE_LINE_COUNT ? 
    parseInt(process.env.SPLIT_FILE_LINE_COUNT) : 80000;


export default class PreprocessService {
    s3Client: S3Client;
    snsClient: SnsClient;

    constructor(s3Client: S3Client, snsClient: SnsClient) {
        this.s3Client = s3Client;
        this.snsClient = snsClient;
    }


    async ingestPropertyData(s3Bucket: string, s3ObjPath: string): Promise<string[]> {
        // initialize the db tables/extensions/indexes if not already setup
        const initDal = new InitDal();
        await initDal.initializeIfNecessary();

        // create a unique dir so we can retrieve the actual .csv file (extract() specifies only a parent dir)
        const uniqueDownloadDir = `${CSV_ROOT_PATH}/${uuidv4()}`;
        mkdirSync(uniqueDownloadDir);

        // download the zip file from s3 to our new, unique directory
        const zipFileLocation = `${uniqueDownloadDir}/orig.zip`;
        await this.s3Client.streamToDirectory(s3Bucket, s3ObjPath, zipFileLocation);

        // uncompress the zip file into the unique dir
        const extractedCsvFile = await this.unzip(uniqueDownloadDir, zipFileLocation);

        // split the csv file into a number of smaller files that can be processed concurrently
        const allFiles = await this.splitCsvFile(extractedCsvFile, SPLIT_FILE_LINE_COUNT);
        console.log(`list of files created: ${allFiles}`);

        // alert the storage lambda that new files need to be processed
        await this.publishSnsEvents(allFiles);
        return allFiles;
    }


    async unzip(uniqueDownloadDir:string, zipFileLocation:string): Promise<string> {
        console.log('unzipping file ' + zipFileLocation);
        await pipeline(createReadStream(zipFileLocation), Extract({ path: `${uniqueDownloadDir}/`}));
        console.log('done unzipping');

        // remove the zip now that we're done with it
        unlink(zipFileLocation, (err) => {
            if (err) {
                console.log(`error deleting zip file: ${zipFileLocation}`)
            }
        })

        // hack. the pipeline function apparently does not respond correctly to event(s) from the unzipper lib.
        // without this delay, the extracted csv file is not found in the download dir (i'm doing something dumb here)
        const delay = (ms: number | undefined) => new Promise(resolve => setTimeout(resolve, ms))
        await delay(2000);

        // get the full name of the csv file...
        let extractedCsvFile;
        console.log(`all files in download dir ${uniqueDownloadDir}: ${readdirSync(uniqueDownloadDir)}`);
        readdirSync(uniqueDownloadDir).forEach(file => {
            console.log(`looking for csv file: ${file}`);
            if (extname(file).toLowerCase() === '.csv') {  // there should only be a single csv file in our unique directory
                extractedCsvFile = join(uniqueDownloadDir, file);
            }
        });
        if (!extractedCsvFile) {
            throw Error('error! csv file was not discovered after unzipping!');
        }

        return extractedCsvFile;
    }

    async splitCsvFile(path: string, lines: number) {
        const files: string[] = [];

        try {
            await csvSplitStream.split(
                createReadStream(path), 
                { lineLimit: lines },
                () => {
                    // this is the list of small (ish) csv files that will be processed by the next set of lambdas 
                    const fileName = `${CSV_ROOT_PATH}/output-${uuidv4()}.csv`;
                    files.push(fileName);
                    return createWriteStream(fileName)
                }
            )
        } catch (e) {
            throw e;
        }

        return files;
    }

    async publishSnsEvents(csvFiles: string[]) {
        const snsArn = process.env.ETL_SNS_TOPIC;
        if (!snsArn) {
            throw Error('etl sns topic is not defined!');
        }

        for (const csvFile of csvFiles) {
            await this.snsClient.publishEvent(snsArn, {csv_file: csvFile});
        }
    }

}
