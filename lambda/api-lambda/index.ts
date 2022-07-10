import AddressService from '../../src/services/address-service';


 exports.handler = async (event: any) => {
    console.log('inside api handler. event:', JSON.stringify(event, null, 2));

    try {
        const params = JSON.parse(event.body);
        if (params['primary_line'] === undefined || params['city'] === undefined || 
            params['state'] === undefined || params['zip_code'] === undefined) {
            return resp('invalid input parameter names', 422);
        }

        const addressSvc = new AddressService();
        const addresses = await addressSvc.retrieveAddress(
            params.primary_line, params.city, params.state, params.zip_code
        );

        return resp(JSON.stringify(addresses), 200);
    }
    catch (e) {
        console.log('error attempting to retrieve address', e);
        return resp('internal error searching for address', 500);
    }
  }
  
function resp(msg: string, status: number) {
    return {
        body: msg,
        statusCode: status
    }
}
