import { AddressDto } from "../domain/address-dto"

export interface IAddressDal {

    validateAndInsert (
        apn: string,
        street: string,
        city: string,
        state: string,
        zip: string,
        lat: number,
        lng: number): Promise<void>

    retrieveAddress(street: string, city: string, state: string, zip: string): Promise<AddressDto[]>
}
