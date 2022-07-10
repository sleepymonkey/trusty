import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { aws_iam as iam } from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_rds as rds } from 'aws-cdk-lib';
import { aws_sns as sns } from 'aws-cdk-lib';
import { aws_efs as efs } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import { aws_lambda_event_sources as les } from 'aws-cdk-lib';
import { aws_apigateway as apigw } from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

const EFS_MOUNT_POINT = '/mnt/csv';
const CREDENTIALS_NAME = 'trusty-db-credentials';

export class TrustyStack extends cdk.Stack {

    public readonly vpc: ec2.Vpc;
    public readonly dbInstance: rds.DatabaseInstance;


    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.vpc = new ec2.Vpc(this, 'vpc', {
            maxAzs: 2,
        });


        const credentials = rds.Credentials.fromGeneratedSecret('postgres', {secretName: CREDENTIALS_NAME});

        // place the db in a public subnet with public access to ease connectivity.  mostly this is to avoid 
        // having to spin up a bastion host or similar for querying db during testing...
        this.dbInstance = new rds.DatabaseInstance(this, 'trusty-db', {
            vpc: this.vpc,
            vpcSubnets: {
              // subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
              subnetType: ec2.SubnetType.PUBLIC,
            },
            engine: rds.DatabaseInstanceEngine.postgres({
              version: rds.PostgresEngineVersion.VER_14_2,
            }),
            instanceType: ec2.InstanceType.of(
              ec2.InstanceClass.BURSTABLE3,
              ec2.InstanceSize.MEDIUM,
            ),
            credentials: credentials,
            multiAz: false,
            allocatedStorage: 25,
            allowMajorVersionUpgrade: false,
            autoMinorVersionUpgrade: true,
            backupRetention: cdk.Duration.days(0),
            deleteAutomatedBackups: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            deletionProtection: false,
            databaseName: 'postgres',
            publiclyAccessible: true,
        });
      
        this.dbInstance.connections.allowFromAnyIpv4(ec2.Port.tcp(5432))


        /* set of sns topics and event sources used for triggering lambdas */

        // helper topic to kick off preprocess/etl execution.  uploading the full zip file can take 20+ mins.
        // we have a script that can send an event to this topic which in turn will invoke the end-to-end process
        const preprocessTopic = new sns.Topic(this, 'preprocess-topic', {
            displayName: 'etl topic',
        });
        const preprocessEventSource = new les.SnsEventSource(preprocessTopic);

        // sns topic used to communicate available CSV files for parsing/storage
        const etlTopic = new sns.Topic(this, 'etl-topic', {
            displayName: 'etl topic',
        });
        const etlEventSource = new les.SnsEventSource(etlTopic);


        /**
         * shared EFS network file system. necessary if we want to store large files accessible to a lambda function
         */
        const fs = new efs.FileSystem(this, 'efs', {
            vpc: this.vpc,
            removalPolicy: cdk.RemovalPolicy.DESTROY
        });

        const accessPoint = fs.addAccessPoint('etl-access-point', {
            createAcl: {
              ownerGid: '1001',
              ownerUid: '1001',
              permissions: '755'
            },
            path:'/export/lambda',
            posixUser: {
              gid: '1001',
              uid: '1001'
            }
        });


        /**
         * s3 bucket containing property data zip files. uploading a property file to this bucket will trigger the 
         * preprocess lambda function which downloads the zip file to a shared network file system. once downloaded,
         * the zip file will be uncompressed and split into multiple, smaller CSV files. these files 
         */
        const s3Bucket = new s3.Bucket(this, 'state-property-data', {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true
        });

        // trigger the preprocess function when a new zip file is added to state property data bucket
        const s3ObjEvent = new les.S3EventSource(s3Bucket, {
            events: [
              s3.EventType.OBJECT_CREATED
            ]
        });


        /**
         * triggered by s3 object created event or sns event.  downloads property zip file, uncompresses and splits
         * files into multiple, smaller CSV files.  each of these files ultimately is translated into an event 
         * for ETL processing.
         */     
        const preprocessLambda = new NodejsFunction(this, 'preprocess-function', {
            memorySize: 1024,
            timeout: cdk.Duration.seconds(900),
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: path.join(__dirname, '/../lambda/preprocess-lambda/index.ts'), 
            handler: 'handler',
            functionName: 'preprocess-handler',
            vpc: this.vpc,
            filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, EFS_MOUNT_POINT),
            environment: {
                CSV_ROOT_PATH: EFS_MOUNT_POINT,
                PROPERTY_DATA_S3_BUCKET: s3Bucket.bucketName,
                DB_CREDENTIALS_SECRET_NAME: CREDENTIALS_NAME,
                ETL_SNS_TOPIC: etlTopic.topicArn
            },
            bundling: {
                minify: true,
                externalModules: ['aws-sdk', 'pg-native'],
            },
        });

        // assign needed policies to the preprocessor function
        const s3BucketsPolicy = new iam.PolicyStatement({
            actions: ['s3:*'],
            resources: ['arn:aws:s3:::*'],
        });
        const snsPolicy = new iam.PolicyStatement({
            actions: ['sns:*'],
            resources: ['*'],
        });
        const secretsPolicy = new iam.PolicyStatement({
            actions: ['secretsmanager:*'],
            resources: ['*'],
        });

        // combine all the explicit policies for the preprocess lambda role
        preprocessLambda.role?.attachInlinePolicy(
            new iam.Policy(this, 'preprocess-lambda-policy', {
                statements: [s3BucketsPolicy, snsPolicy, secretsPolicy],
            }),
        );
      
        // this lambda can be invoked via either of these 2 events
        preprocessLambda.addEventSource(s3ObjEvent);  // s3 uploads trigger
        preprocessLambda.addEventSource(preprocessEventSource);  // manual publish events trigger


        /**
         * etl processing lambda, triggered as events are communicated to a SNS topic. each event corresponds to
         * a single CSV file written to the shared network file system.  
         */
        const etlFunction = new NodejsFunction(this, 'etl-function', {
            memorySize: 1024,
            timeout: cdk.Duration.seconds(900),
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: path.join(__dirname, '/../lambda/etl-lambda/index.ts'), 
            handler: 'handler',
            vpc: this.vpc,
            functionName: 'etl-handler',
            filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, EFS_MOUNT_POINT),
            environment: {
                CSV_ROOT_PATH: EFS_MOUNT_POINT,
                DB_CREDENTIALS_SECRET_NAME: CREDENTIALS_NAME,
            },
            bundling: {
                minify: true,
                externalModules: ['aws-sdk', 'pg-native'],  // sigh. pg-native here is some wild west. wtf
            },
        });

        etlFunction.role?.attachInlinePolicy(
            new iam.Policy(this, 'etl-lambda-policy', {
                statements: [secretsPolicy],
            }),
        );

        etlFunction.addEventSource(etlEventSource);


        /**
         * lambda for POST /address api search calls
         */
        const apiFunction = new NodejsFunction(this, 'api-function', {
            memorySize: 256,
            timeout: cdk.Duration.seconds(15),
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: path.join(__dirname, '/../lambda/api-lambda/index.ts'), 
            handler: 'handler',
            vpc: this.vpc,
            functionName: 'api-handler',
            environment: {
                DB_CREDENTIALS_SECRET_NAME: CREDENTIALS_NAME,
            },
            bundling: {
                minify: true,
                externalModules: ['aws-sdk', 'pg-native'],
            },
        });

        apiFunction.role?.attachInlinePolicy(
            new iam.Policy(this, 'api-lambda-policy', {
                statements: [secretsPolicy],
            }),
        );
      

        /**
         * trigger for the api lambda
         */
        let api = new apigw.RestApi(this, 'trusty-api', {
            description: 'trusty api gateway',
        });

        // represents the /address resource
        const address = api.root.addResource('address');
        
        // associate lambda 
        address.addMethod(
            'POST',
            new apigw.LambdaIntegration(apiFunction),
        );
        

        /**
         * outputs for scripts, etc
         */
        new cdk.CfnOutput(this, 'etl-sns-topic', {
            value: etlTopic.topicArn,
        });

        new cdk.CfnOutput(this, 'preprocess-sns-topic', {
            value: preprocessTopic.topicArn,
        });

        new cdk.CfnOutput(this, 'dbEndpoint', {
            value: this.dbInstance.instanceEndpoint.hostname,
        });

        new cdk.CfnOutput(this, 's3DataBucket', {
            value: s3Bucket.bucketName,
        });

        new cdk.CfnOutput(this, 'api endpoint', {
            value: api.url ?? 'bad problems...'
          });
    }

}
