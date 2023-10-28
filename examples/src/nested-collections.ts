import { NearBindgen, near, call, view, UnorderedMap } from "near-sdk-js";

@NearBindgen({})
export class Contract {
  outerMap: UnorderedMap<UnorderedMap<string>>;
  groups: UnorderedMap<UnorderedMap<UnorderedMap<string>>>;

  constructor() {
    this.outerMap = new UnorderedMap("o");
    this.groups = new UnorderedMap("gs");
  }

  // Using some type-awared format instead of standard JSON.stringify
  @call({})
  add({ id, text }: { id: string; text: string }) {
    // But car.run() doesn't work, because SDK only know how to deserialize it as a plain object, not a Car instance.
    // This problem is particularly painful when class is nested, for example collection class instance LookupMap containing Car class instance. Currently SDK mitigate this problem by requires user to manually reconstruct the JS object to an instance of the original class.
    const innerMap = this.outerMap.get(id, {
      // reconstructor: UnorderedMap.reconstruct,
      defaultValue: new UnorderedMap<string>("i_" + id + "_"),
    });
    innerMap.set(near.signerAccountId(), text);
    this.outerMap.set(id, innerMap);
  }

  @view({})
  get({ id, accountId }: { id: string; accountId: string }) {
    const innerMap = this.outerMap.get(id, {
      reconstructor: UnorderedMap.reconstruct,
    });
    if (innerMap === null) {
      return null;
    }
    return innerMap.get(accountId);
  }

  @call({})
  add_to_group({
    group,
    id,
    text,
  }: {
    group: string;
    id: string;
    text: string;
  }) {
    const groupMap = this.groups.get(group, {
      // reconstructor: UnorderedMap.reconstruct,
      defaultValue: new UnorderedMap<UnorderedMap<string>>("g_" + group + "_"),
    });
    const innerMap = groupMap.get(id, {
      // reconstructor: UnorderedMap.reconstruct,
      defaultValue: new UnorderedMap<string>("gi_" + group + "_" + id + "_"),
    });
    innerMap.set(near.signerAccountId(), text);
    groupMap.set(id, innerMap);
    this.groups.set(group, groupMap);
  }

  @view({})
  get_from_group({
    group,
    id,
    accountId,
  }: {
    group: string;
    id: string;
    accountId: string;
  }) {
    const groupMap = this.groups.get(group, {
      // reconstructor: UnorderedMap.reconstruct,
    });
    if (groupMap === null) {
      return null;
    }
    const innerMap = groupMap.get(id, {
      // reconstructor: UnorderedMap.reconstruct,
    });
    if (innerMap === null) {
      return null;
    }
    return innerMap.get(accountId);
  }
}
