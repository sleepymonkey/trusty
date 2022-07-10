import { createReadStream, existsSync, unlinkSync } from "fs";
import { pipeline } from "stream/promises";
import { parse } from 'csv-parse';

// this needs to be pulled from somewhere else
import { Client } from 'pg';
import AddressDal from '../db/impl/address-dal';


export default class AddressService {
    addressDal: AddressDal;

    constructor() {
        this.addressDal = new AddressDal();
    }


    async retrieveAddress(street: string, city: string, state: string, zip: string) {
        console.log(`searching address: ${street} ${city} ${state} ${zip}`);

        // we look for exact match. if not found, we look for close matches based on street (prefix) and city
        const records = await this.addressDal.retrieveAddress(upper(street), upper(city), upper(state), zip);
        console.log(`records returned from address retrieve: ${JSON.stringify(records)}`);
        if (records && records.length > 0) {
            return records;
        }
        else {
            // get list of addresses that are close to street name and w/in the same city
            console.log('no records found on exact match. attempting partial match');
            return await this.addressDal.retrieveAddressByStreet(upper(street), upper(city));
        }
    }

    async storePropertyData(csvFilePath: string) {
        console.log(`etl. processing csv file: ${csvFilePath}`)
        if (!existsSync(csvFilePath)) {
            throw Error(`attempt to parse non-existent csv file: ${csvFilePath}`);
        }
        
        let skipped = 0;
        let count = 0;
        const parser = parse({});
        parser.on('readable', async () => {
            let row;
            while ((row = parser.read()) !== null) {
                if (count++ === 0) {
                    console.log(`skipping header row: ${row}`);
                    continue;
                }
                skipped += await this.addressDal.validateAndInsert(row[1], upper(row[9]), upper(row[10]), upper(row[11]), row[12], row[14], row[15]);
                if (count % 20000 === 0) {
                    console.log(`processed ${count} rows`);  // every 20k rows print a status
                }
            }
        });
        parser.on('error', function(err) {
            console.error('error parsing/inserting data:', err);
            throw err;
        });
       
        await pipeline(createReadStream(csvFilePath), parser);
        console.log(`storePropertyData. total records attempted: ${count} total skipped: ${skipped}`);
    }

    async deleteFile(csvFilePath: string) {
        if (existsSync(csvFilePath)) {
            console.log(`storage service. removing csv file: ${csvFilePath}`);
            try {
                unlinkSync(csvFilePath);
            }
            catch (err) {
                console.log(`error attempting to delete csv file: ${csvFilePath}`, err);
            }
        }
    }

}


// helper routine so we are inserting/retrieving based on upper case strings
function upper(val:string) {
    if (!val) {
        return '';
    }
    return val.toUpperCase();
}
