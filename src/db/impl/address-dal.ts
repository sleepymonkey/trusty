import { AddressDto } from "../../domain/address-dto";
import { IAddressDal } from "../iaddress-dal";
import DbConnectionFactory from '../connection-resolver';

const insert = 'insert into property_address (apn_id, street, city, state, zip, lat, lng) values ($1, $2, $3, $4, $5, $6, $7)';
const RETRIEVE = 'select * from property_address where street=$1 and city=$2 and state=$3 and zip=$4';
const SEARCH = `select * from property_address where street % $1 and city = $2 ORDER  BY street NOT ILIKE '$1%', street <-> $1 limit 10`;


export default class AddressDal implements IAddressDal {
    resolver: DbConnectionFactory;

    constructor() {
        this.resolver = new DbConnectionFactory();
    }


    /**
     * ensure data is valid (not empty/null) and does not already exist in our db.
     */
    async validateAndInsert(apn: string, street: string, city: string, state: string, zip: string, lat: any, lng: any):
        Promise<any>
    {
        if ((!street && !city && !zip) || (street === '' && city === '' && zip === '')) {
            return 1;
        }

        // finding duplicates is possible (and probably a good idea), but not on lambda.
        // a better idea would probably be to have an ec2 instance to process events w/o the
        // worry of memory/disk/runtime constraints

        // const existing = await this.retrieveAddress(street, city, state, zip);
        // if (existing && existing.length > 0) {
        //     return 1;  // keep track of duplicate addresses
        // }

        await this.insertAddress(apn, street, city, state, zip, lat, lng);
        return 0;
    }


    async insertAddress(apn: string, street: string, city: string, state: string, zip: string, lat: any, lng: any): 
        Promise<void> 
    {
        try {
            const conn = await this.getConnection();
            try {
                if (!lat || lat === '') {  // lat/lng can come in as empty string
                    lat = 0;
                }
                if (!lng || lng === '') {
                    lng = 0;
                }

                const values: any[] = [apn, street, city, state, zip, lat, lng];
                await conn.query(insert, values);
            }
            finally {
                conn.release();
            }
        }
        catch (e) {
            console.log('error inserting', e);
            throw e;
        }
    }

    
    async retrieveAddress(street: string, city: string, state: string, zip: string): 
        Promise<AddressDto[]> 
    {
        return await this.queryForList(RETRIEVE, [street, city, state, zip]);
    }

    async retrieveAddressByStreet(street: string, city: string):
        Promise<AddressDto[]> 
    {
        return await this.queryForList(SEARCH, [street, city]);
    }

    async queryForList(sql: string, params: any[]): 
        Promise<AddressDto[]> 
    {
        const records: AddressDto[] = [];

        try {
            const conn = await this.getConnection();

            try {
                const res = await conn.query(sql, params);
                for (const row of res.rows) {
                    records.push(this.mapRow(row));
                }
            }
            finally {
                conn.release();
            }
        }
        catch (e) {
            console.log('error retrieving records', e);
            throw e;
        }

        return records;
    }

    mapRow(dbRow:any): AddressDto {
        const dto: AddressDto = {
            apn: dbRow.apn_id,
            street: dbRow.street,
            city: dbRow.city,
            state: dbRow.state,
            zip: dbRow.zip,
            lat: dbRow.lat,
            lng: dbRow.lng,
        }

        return dto;
    }

    async getConnection() {
        const pool = await this.resolver.getDbConnectionPool();
        return await pool.connect();
    }


    // 
    // https://dba.stackexchange.com/questions/280196/optimizing-postgres-sorting-by-word-similarity
    
}
