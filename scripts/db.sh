#!/usr/bin/env bash

# since we have placed the db into the public subnet of our VPC, we can connect directly.
# pwd and host are both stored within the trusty-db-credentials secret. so query that service
# for the complete postgres connect str.

# sigh. sometimes this 'parse' call fails.  if you can't connect to the db, run the following from
# the cmd line:  aws secretsmanager get-secret-value --secret-id "trusty-db-credentials" --query 'SecretString'
# that will display the pwd and you can export it to your bash env:
# export PGPASSWORD="blah"

PWD=$(aws secretsmanager get-secret-value --secret-id "trusty-db-credentials" --query 'SecretString' \
	  --output text | tr { '\n' | tr , '\n' | tr } '\n' | grep "password" | awk  -F'"' '{print $4}')

HOST=$(aws secretsmanager get-secret-value --secret-id "trusty-db-credentials" --query 'SecretString' \
	  --output text | tr { '\n' | tr , '\n' | tr } '\n' | grep "host" | awk  -F'"' '{print $4}')


# if the user has NOT exported the pg pwd to their env, set here
if [[ -z "${PGPASSWORD}" ]]; then
    export PGPASSWORD=$PWD
fi
psql -U postgres -h $HOST -p 5432 postgres

