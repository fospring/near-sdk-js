# Auto reconstruct by json schema
## Problem Solved: Could not decode contract state to class instance in early version of sdk
JS SDK decode contract as utf-8 and parse it as JSON, results in a JS Object.  
One thing not intuitive is objects are recovered as Object, not class instance. For example, Assume an instance of this class is stored in contract state:
```typescript
Class Car {
    name: string;
    speed: number;
    
    run() {
      // ...
    }
}
```
When load it back, the SDK gives us something like:
```json
{"name": "Audi", "speed": 200}
```
However this is a JS Object, not an instance of Car Class, and therefore you cannot call run method on it.  
This also applies to when user passes a JSON argument to a contract method. If the contract is written in TypeScript, although it may look like:
```typescript
add_a_car(car: Car) {
  car.run(); // doesn't work
  this.some_collection.set(car.name, car);
}
```
But car.run() doesn't work, because SDK only know how to deserialize it as a plain object, not a Car instance.  
This problem is particularly painful when class is nested, for example collection class instance LookupMap containing Car class instance. Currently SDK mitigate this problem by requires user to manually reconstruct the JS object to an instance of the original class.
## A method to decode string to class instance by json schema file
we just need to add static member in the class type.
```typescript
Class Car {
    static schema = {
        name: "string",
        speed: "number",
    };
    name: string;
    speed: number;
    
    run() {
      // ...
    }
}
```
After we add static member in the class type in our smart contract, it will auto reconstruct smart contract and it's member to class instance recursive by sdk.  
And we can call class's functions directly after it deserialized.
```js
add_a_car(car: Car) {
  car.run(); // it works!
  this.some_collection.set(car.name, car);
}
```
### The schema format
#### We support multiple type in schema:
* build-in non object types: `string`, `number`, `boolean`
* build-in object types: `date`, `bigint`
* build-in collection types: `array`, `map`
  * for `array` type, we need to declare it in the format of `{array: {value: valueType}}`
  * for `map` type, we need to declare it in the format of `{map: {key: 'KeyType', value: 'valueType'}}`
* Custom Class types: `Car` or any class types
* Near collection types: `Vector`, `LookupMap`, `LookupSet`, `UnorderedMap`, `UnorderedSet`
  * 
We have a test example which contains all those types in one schema: [status-deserialize-class.js](./examples/src/status-deserialize-class.js)
```js
class StatusDeserializeClass {
    static schema = {
        is_inited: "boolean",
        records: {map: {key: 'string', value: 'string'}},
        car: Car,
        messages: {array: {value: 'string'}},
        efficient_recordes: {unordered_map: {value: 'string'}},
        nested_efficient_recordes: {unordered_map: {value: {unordered_map: {value: 'string'}}}},
        nested_lookup_recordes: {unordered_map: {value: {lookup_map: {value: 'string'}}}},
        vector_nested_group: {vector: {value: {lookup_map: {value: 'string'}}}},
        lookup_nest_vec: {lookup_map: {value: {vector: {value: 'string'}}}},
        unordered_set: {unordered_set: {value: 'string'}},
        user_car_map: {unordered_map: {value: Car}},
        big_num: 'bigint',
        date: 'date'
    };

    constructor() {
        this.is_inited = false;
        this.records = {};
        this.car = new Car();
        this.messages = [];
        // account_id -> message
        this.efficient_recordes = new UnorderedMap("a");
        // id -> account_id -> message
        this.nested_efficient_recordes = new UnorderedMap("b");
        // id -> account_id -> message
        this.nested_lookup_recordes = new UnorderedMap("c");
        // index -> account_id -> message
        this.vector_nested_group = new Vector("d");
        // account_id -> index -> message
        this.lookup_nest_vec = new LookupMap("e");
        this.unordered_set = new UnorderedSet("f");
        this.user_car_map = new UnorderedMap("g");
        this.big_num = 1n;
        this.date = new Date();
    }
    // other methods
}
```
#### no need to announce GetOptions.reconstructor in decoding nested collections
In this other hand, after we set schema for the Near collections with nested collections, we don't need to announce `reconstructor` when we need to get and decode a nested collections because the data type info in the schema will tell sdk what the nested data type.  
Before we set schema if we need to get a nested collection we need to set `reconstructor` in `GetOptions`:
```typescript
@NearBindgen({})
export class Contract {
    outerMap: UnorderedMap<UnorderedMap<string>>;

    constructor() {
        this.outerMap = new UnorderedMap("o");
    }

    @view({})
    get({id, accountId}: { id: string; accountId: string }) {
        const innerMap = this.outerMap.get(id, {
            reconstructor: UnorderedMap.reconstruct,  // we need to announce reconstructor explicit
        });
        if (innerMap === null) {
            return null;
        }
        return innerMap.get(accountId);
    }
}
```
After we set schema info we don't need to set `reconstructor` in `GetOptions`, sdk can infer which reconstructor should be took by the schema:
```typescript
@NearBindgen({})
export class Contract {
    static schema = {
      outerMap: {unordered_map: {value: { unordered_map: {value: 'string'}}}}
    };
    
    outerMap: UnorderedMap<UnorderedMap<string>>;

    constructor() {
        this.outerMap = new UnorderedMap("o");
    }

    @view({})
    get({id, accountId}: { id: string; accountId: string }) {
        const innerMap = this.outerMap.get(id, {
            reconstructor: UnorderedMap.reconstruct,  // we need to announce reconstructor explicit, reconstructor can be infered from static schema
        });
        if (innerMap === null) {
            return null;
        }
        return innerMap.get(accountId);
    }
}
```
