import { Client, QueryResult } from 'pg';
import DbConnectionFactory from '../connection-resolver';


export default class InitDal {
    resolver: DbConnectionFactory;

    constructor() {
        this.resolver = new DbConnectionFactory();
    }


    /**
     * setup the db if it has not been initialized yet.
     * in the real world, we'd have scripts, etc to configure our db prior to running any operations
     * against it.  having this method eases the necessary setup on external developers...
     */
    async initializeIfNecessary() {
        try {
            const conn = await this.getConnection();

            try {
                const res = await conn.query('SELECT count(*)::int from property_address');
                console.log('db tables have previously been initialized. returning');
            }
            finally {
                conn.release();
            }
        }
        catch (e) {
            await this.createTables();
        }
    }

    async createTables():
        Promise<void>
    {
        try {
            console.log('INITIALIZING DB!');

            const conn = await this.getConnection();

            try {
                await conn.query('drop table if exists property_address');
                await conn.query(`
                    CREATE TABLE property_address
                    (
                        id              BIGSERIAL PRIMARY KEY,
                        apn_id          TEXT NOT NULL,
                        street          TEXT NOT NULL,
                        city            TEXT NOT NULL,
                        state           TEXT NOT NULL,
                        zip             TEXT NOT NULL,
                        lat             double precision,
                        lng             double precision,
                        time_created    TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
                    )
                `);

                // extension to allow simple fuzzy searches
                await conn.query('DROP EXTENSION IF EXISTS pg_trgm');
                await conn.query('CREATE EXTENSION pg_trgm');

                await conn.query('CREATE INDEX complete_addr_ndx ON property_address(street, city, state, zip)');
                await conn.query('CREATE INDEX ON property_address USING gist (street gist_trgm_ops)');
            }
            finally {
                conn.release();
            }  
        }
        catch (e) {
            console.log('error initializing db', e);
            throw e;
        } 
    }

    async getConnection() {
        const pool = await this.resolver.getDbConnectionPool();
        return await pool.connect();
    }
}
