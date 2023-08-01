import {NearBindgen, call, view, near, borshSerialize, borshDeserialize} from "near-sdk-js";
import { Buffer } from 'buffer/';
import {encode} from "near-sdk-js/lib/utils.js";
// import * as borsh from 'borsh';

@NearBindgen({})
export class StatusMessage {
    constructor() {
        this.records = new Map()
    }

    deserialize() {
        borshDeserializeStatusMessage(this)
    }

    serialize() {
        borshSerializeStatusMessage(this)
    }

    @call({})
    set_status({ message }) {
        let account_id = near.signerAccountId()
        env.log(`${account_id} set_status with message ${message}`)
        this.records.set(account_id, message)
    }

    @view({})
    get_status({ account_id }) {
        env.log(`get_status for account_id ${account_id}`)
        return this.records.get(account_id) || null
    }
}


const schema = {
    struct: { map: { key: 'string', value: 'string' } }
};

function borshSerializeStatusMessage(statusMessage) {
    near.storageWriteRaw(encode('STATE'), borshSerialize(schema, statusMessage));
}

function borshDeserializeStatusMessage(to) {
    let state = near.storageRead('STATE');

    if (state) {
        let temp = borshDeserialize(schema, Buffer.from(state), StatusMessage)
        Object.assign(to, temp);
    } else {
        throw new Error('Contract state is empty')
    }
}