import AddressService from '../../src/services/address-service';


 exports.handler = async (event: any, context: any) => {
    console.log('inside storage lambda. event:', JSON.stringify(event, null, 2));

    const jsonStr = event.Records[0].Sns.Message

    try {
        const json = await JSON.parse(jsonStr);
        console.log(`csv file location: ${json.csv_file}`);

        const storageSvc = new AddressService();
        await storageSvc.storePropertyData(json.csv_file);

        await storageSvc.deleteFile(json.csv_file);
    } 
    catch (e) {
        console.log(`error processing etl message`, e);
    }

  }
  
