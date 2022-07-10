import { Pool } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { resolve } from 'path';
import { Fn } from 'aws-cdk-lib';



export default class DbConnectionResolver {
    connectionPool: Pool;

    /** 
     * build the db connection pool depending on our execution env. locally, we utilize the standard
     * postgres initial configuration options.  
     */
    async getDbConnectionPool(): Promise<Pool> {
        if (this.connectionPool) {  // we've already been initialized
            return this.connectionPool;
        }

        const isLambda = !!process.env.LAMBDA_TASK_ROOT;
        if (isLambda) {
            this.connectionPool = await this.buildLambdaConnection();
        } else {
            this.connectionPool = this.buildLocalConnection();
        }

        return this.connectionPool;
    }

    buildLocalConnection() {
        console.log(`returning connection pool for local execution environment`);

        return new Pool({ 
            host: process.env.PGHOST || 'localhost',
            user: process.env.PGUSER || 'postgres',
            password: process.env.PGPASSWORD || '',
            port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432, 
            database: 'postgres',
        });
    }

    async buildLambdaConnection() {
        console.log(`returning connection pool for lambda conn.`);

        const smClient = new SecretsManagerClient({});
        const command = new GetSecretValueCommand({SecretId: process.env.DB_CREDENTIALS_SECRET_NAME});
        
        const data = await smClient.send(command);
        if (!data.SecretString) {
            throw Error('unable to determine credentials from secret mgr');
        }

        const connectionAttrs = await JSON.parse(data.SecretString);

        const config = {
            host: connectionAttrs['host'],
            user: 'postgres',
            password: connectionAttrs['password'],
            port: 5432, 
            database: 'postgres',
        }

        return new Pool(config);
    }
}

