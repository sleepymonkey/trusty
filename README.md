# Welcome to your CDK TypeScript project


The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests (`NB!` requires manual steps)
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template



### Setup:
* ensure you are running node v16 (or later)
* configure the amazon cli: `aws configure` (follow prompts to set default profile)
* cd to the project root and execute: `cdk deploy`
* to run automated tests, you must have local postgres db (tested with pg14) and manually execute: `trusty/src/services/test/manual-integrations/db-init-integration-test.ts` to initialize the db (notes in test file)


### Technical overview
I decided to work within the bounds of the current Trusty software stack: lambda, postgres, cdk. There are many different approaches to ETL and I evaluated several: data pipeline, glue, step functions.  However, in terms of producing a repeateable, scripted deployment model, cdk combined with existing tools proved simplest. This has the extra benefit of minimizing reliance on AWS and gives much greater ability to write automated tests for the end to end process.  AWS becomes a light 'wrapper' around the core functionality, which can be deployed, tested, etc locally in preparation for deployment to the cloud.  


The overall approach:
* upload zip file to s3 bucket
* triggers preprocess lambda
* downloads, uncompresses and splits resulting CSV info multiple, smaller files
* all files written to shared EFS network file system
* file locations sent as events to SNS topic
* triggers ETL lambda to parse CSV data and store address records in postgres db


### Scripts
* `initiate-etl.sh` -- uploads zip file to s3 bucket. kicks off etl process
* `curl-api.sh` -- invoke POST /address search api call
* `db.sh` -- opens psql cli to remote postgres db (makes best attempt at auto configuring. see comments in script fails to connect)
* `send-preprocess-topic-event.sh` -- convenience script to reprocess an existing zip file
* `send-etl-topic-event.sh` -- convenience script to re-process existing CSV file (file must exist in shared EFS drive)
