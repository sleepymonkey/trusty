import InitDal from '../../src/db/impl/init-dal';


 exports.handler = async (event: any, context: any) => {
    console.log('inside init db lambda. event:', JSON.stringify(event, null, 2));

    try {
        const initDal = new InitDal();
        await initDal.createTables();
    }
    catch (e) {
        console.log('error attempting to initialize db', e);
    }
  }
  
