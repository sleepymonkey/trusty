#!/usr/bin/env bash

# helper script to invoke the etl lambda. you can retrieve the file name from the preprocess logs.
# if the file still exists on the shared EFS file system, it will be (re-)processed

if [ $# -ne 2 ]; then
    echo "you must pass topic arn and file path"
    echo "$0 arn:aws:sns:us-west-2:437991491840:rStack-etltopic04E990ED-G06J2E /mnt/csv/output-c8292092-7e10-40c6-8832-5e1838f2d267.csv"
    exit 1
fi

ARN=$1
FILE_PATH=$2

aws sns publish --topic-arn $ARN --message "{\"csv_file\": \"$2\"}"
