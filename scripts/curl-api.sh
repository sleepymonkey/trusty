#!/usr/bin/env bash

# make the /address search api call

if [ $# -ne 5 ]; then
    echo "you must pass street, city, state, zip, api endpoint (see output from cdk deploy)"
    echo "NB! api endpoint must NOT end with fwd slash! '/'"
    echo "$0 '68 BAYSIDE Court' 'RICHMOND' 'CA' '94804' https://sz43jpujsh.execute-api.us-west-2.amazonaws.com/prod"
    exit 1
fi

STREET=$1
CITY=$2
STATE=$3
ZIP=$4
ENDPOINT=$5


curl -d "{\"primary_line\":\"$STREET\", \"city\": \"$CITY\", \"state\": \"$STATE\", \"zip_code\": \"$ZIP\"}" -H "Content-Type: application/json" -X POST "$ENDPOINT/address"

