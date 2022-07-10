#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { TrustyStack } from '../lib/trusty-stack';

const app = new cdk.App();
new TrustyStack(app, 'TrustyStack', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
   // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },


  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});



// automated lambda tests
// https://levelup.gitconnected.com/unit-test-and-integration-test-for-aws-lambda-nodejs-in-typescript-2235a0f69f5


// how to reference 

// multiple stacks if we want to separate the static from dynamic shit
// https://docs.aws.amazon.com/cdk/v2/guide/stack_how_to_create_multiple_stacks.html
// const app = new cdk.App();

// new MultistackStack(app, "MyWestCdkStack", {
//     env: {region: "us-west-1"},
//     encryptBucket: false
// });
  
// new MultistackStack(app, "MyEastCdkStack", {
//     env: {region: "us-east-1"},
//     encryptBucket: true
// });

// how to deploy each stack:
// cdk deploy MyEastCdkStack --profile=PROFILE_NAME
