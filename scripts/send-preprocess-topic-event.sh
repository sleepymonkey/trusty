#!/usr/bin/env bash

# helper script to invoke the preprocess lambda. during testing, uploading the full property zip file sometimes took
# upwards of half an hour.  if the file already exists in s3, tell the lambda to use it and avoid the upload time...

if [ $# -ne 3 ]; then
    echo "you must pass topic arn, bucket name and object path"
    echo "$0 arn:aws:sns:us-west-2:437991491840:rStack-etltopic04E990ED-G06J2E  trustystack-statepropertydatae91ab  property.zip"
    exit 1
fi

ARN=$1
BUCKET=$2
FILE_PATH=$3


aws sns publish --topic-arn $ARN --message "{\"bucket\": \"$2\", \"key\": \"$3\"}"
