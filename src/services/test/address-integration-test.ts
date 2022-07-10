import AddressDal from '../../db/impl/address-dal';
import AddressService from '../address-service';
import DbConnectionFactory from '../../db/connection-resolver';


beforeEach(async () => {
    const conn = await getConnection();
    await conn.query('delete from property_address');
    conn.release();
})

describe('addresses save / retrieve', () => {
    
    test('test store and retrieve', async () => {
        const csvAddresses = __dirname + '/data/addresses.csv';  

        const svc = new AddressService();
        await svc.storePropertyData(csvAddresses);

        // hack. still haven't figured out my async issue while parsing CSV file (where the prob exists)
        const delay = (ms: number | undefined) => new Promise(resolve => setTimeout(resolve, ms))
        await delay(1000);

        // data contains the following record which should be ignored:
        // 06115,910-001-734-000,,,,,,,,,,CA,,,,,BLOCK GROUP,,
        const conn = await getConnection();
        const res = await conn.query('select count(*) as count from property_address');
        expect(res.rows[0].count).toEqual('3');  // 4 records total, but only 3 are 'valid' and saved to the db
    })

    test('test retrieve', async () => {
        const addressDal = new AddressDal();
        await addressDal.validateAndInsert('1-111-1', '229 BRUSH ST', 'OAKLAND', 'CA', '94607', 37.799219, -122.283);

        const svc = new AddressService();
        const addresses = await svc.retrieveAddress('229 BRUSH ST', 'OAKLAND', 'CA', '94607');
        expect(addresses.length).toEqual(1);
        const address = addresses[0];
        expect(address.apn).toEqual('1-111-1')
        expect(address.street).toEqual('229 BRUSH ST')
        expect(address.city).toEqual('OAKLAND')
        expect(address.state).toEqual('CA')
        expect(address.zip).toEqual('94607')
    })

    test('test similar street', async () => {
        const addressDal = new AddressDal();
        await addressDal.validateAndInsert('560-680-315', '68 BAYSIDE CT', 'RICHMOND', 'CA', '94804', 37.799219, -122.283);
        await addressDal.validateAndInsert('560-680-253', '62 BAYSIDE CT', 'RICHMOND', 'CA', '94804', 37.799219, -122.283);
        await addressDal.validateAndInsert('560-680-311', '64 BAYSIDE CT',  'RICHMOND', 'CA', '94804', 37.799219, -122.283);        
        await addressDal.validateAndInsert('518-360-002-1', '43 ST', 'RICHMOND', 'CA', '94801', 37.799219, -122.283);

        const delay = (ms: number | undefined) => new Promise(resolve => setTimeout(resolve, ms))
        await delay(1000);
        
        // there will be no exact match for this initial query
        const svc = new AddressService();
        const addresses = await svc.retrieveAddress('68 BAYSIDE C', 'RICHMOND', 'CA', '94607');
        console.log(`returned addrs: ${JSON.stringify(addresses)}`);
        expect(addresses.length).toEqual(3);

        // first one should be the closest match on street
        const address = addresses[0];
        expect(address.apn).toEqual('560-680-315');
        expect(address.street).toEqual('68 BAYSIDE CT');
    })

})


async function getConnection() {
    const pool = await new DbConnectionFactory().getDbConnectionPool();    
    return await pool.connect();
}
