#!/usr/bin/env bash

# this will kick off the end-to-end ETL process

if [ $# -ne 2 ]; then
    echo "you must pass s3 bucket name and local property zip"
    echo "$0 trustystack-statepropertydatae91ab  property.zip"
    exit 1
fi

S3_BUCKET=$1
FILE_PATH=$2

aws s3 cp $FILE_PATH  s3://$S3_BUCKET
