import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress, keccak256, toBytes, zeroAddress, zeroHash, type Address, type Hex } from "viem";
import { documentRegistryAbi } from "../../lib/chain/abi.ts";

const { viem, networkHelpers } = await network.getOrCreate();

const DOC_HASH = keccak256(toBytes("TENANCY AGREEMENT: flat 3, Lekki, 12 months, NGN 1,200,000"));
const OTHER_HASH = keccak256(toBytes("a different document"));

async function deployFixture() {
  const [tenant, landlord, stranger] = await viem.getWalletClients();
  const registry = await viem.deployContract("DocumentRegistry");
  const publicClient = await viem.getPublicClient();
  return { registry, publicClient, tenant, landlord, stranger };
}
const fresh = () => networkHelpers.loadFixture(deployFixture);

async function expectRevert(promise: Promise<unknown>, errorName: string) {
  try {
    await promise;
  } catch (error) {
    assert.ok(String(error).includes(errorName), `expected revert with ${errorName}, got: ${String(error).slice(0, 300)}`);
    return;
  }
  assert.fail(`expected revert with ${errorName}`);
}

describe("DocumentRegistry", () => {
  it("registers a document with its parties and stores no document text", async () => {
    const { registry, tenant, landlord } = await fresh();
    await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address, landlord.account.address]], {
      account: tenant.account,
    });

    const [creator, createdAt, fullySignedAt, kind, parties, signed] = await registry.read.getRecord([DOC_HASH]);
    assert.equal(getAddress(creator), getAddress(tenant.account.address));
    assert.ok(createdAt > 0n);
    assert.equal(fullySignedAt, 0n);
    assert.equal(kind, "TENANCY_AGREEMENT");
    assert.deepEqual(parties.map((party) => getAddress(party)), [
      getAddress(tenant.account.address),
      getAddress(landlord.account.address),
    ]);
    assert.deepEqual([...signed], [false, false]);
    assert.equal(await registry.read.isRegistered([DOC_HASH]), true);
    assert.equal(await registry.read.isFullySigned([DOC_HASH]), false);
  });

  it("marks the document fully signed only after every party signs", async () => {
    const { registry, tenant, landlord } = await fresh();
    await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address, landlord.account.address]], {
      account: tenant.account,
    });

    await registry.write.sign([DOC_HASH], { account: tenant.account });
    assert.equal(await registry.read.isFullySigned([DOC_HASH]), false);

    await networkHelpers.time.increase(60);
    await registry.write.sign([DOC_HASH], { account: landlord.account });
    assert.equal(await registry.read.isFullySigned([DOC_HASH]), true);

    const [, createdAt, fullySignedAt, , , signed] = await registry.read.getRecord([DOC_HASH]);
    assert.ok(fullySignedAt > createdAt);
    assert.deepEqual([...signed], [true, true]);
  });

  it("emits registration and signing events", async () => {
    const { registry, publicClient, tenant, landlord } = await fresh();
    await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address, landlord.account.address]], {
      account: tenant.account,
    });
    await registry.write.sign([DOC_HASH], { account: tenant.account });
    await registry.write.sign([DOC_HASH], { account: landlord.account });

    const logs = await publicClient.getContractEvents({ address: registry.address, abi: registry.abi, fromBlock: 0n });
    const names = logs.map((log) => (log as unknown as { eventName: string }).eventName);
    assert.deepEqual(names, ["DocumentRegistered", "DocumentSigned", "DocumentSigned", "DocumentFullySigned"]);
  });

  it("supports a single-party record such as a widow's property record", async () => {
    const { registry, tenant } = await fresh();
    await registry.write.register([OTHER_HASH, "PROPERTY_RECORD", [tenant.account.address]], { account: tenant.account });
    await registry.write.sign([OTHER_HASH], { account: tenant.account });
    assert.equal(await registry.read.isFullySigned([OTHER_HASH]), true);
  });

  it("rejects a duplicate registration", async () => {
    const { registry, tenant } = await fresh();
    await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address]], { account: tenant.account });
    await expectRevert(
      registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address]], { account: tenant.account }),
      "AlreadyRegistered",
    );
  });

  it("rejects an empty hash, a bad kind and bad party lists", async () => {
    const { registry, tenant } = await fresh();
    const me = tenant.account;
    await expectRevert(registry.write.register([zeroHash, "X", [me.address]], { account: me }), "EmptyHash");
    await expectRevert(registry.write.register([DOC_HASH, "", [me.address]], { account: me }), "InvalidKind");
    await expectRevert(registry.write.register([DOC_HASH, "K".repeat(65), [me.address]], { account: me }), "InvalidKind");
    await expectRevert(registry.write.register([DOC_HASH, "X", []], { account: me }), "InvalidParties");
    await expectRevert(registry.write.register([DOC_HASH, "X", [zeroAddress]], { account: me }), "InvalidParties");
    await expectRevert(registry.write.register([DOC_HASH, "X", [me.address, me.address]], { account: me }), "InvalidParties");
    const nine = Array.from({ length: 9 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}` as Address);
    await expectRevert(registry.write.register([DOC_HASH, "X", nine], { account: me }), "InvalidParties");
  });

  it("only lets listed parties sign, and only once", async () => {
    const { registry, tenant, landlord, stranger } = await fresh();
    await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address, landlord.account.address]], {
      account: tenant.account,
    });
    await expectRevert(registry.write.sign([DOC_HASH], { account: stranger.account }), "NotAParty");
    await registry.write.sign([DOC_HASH], { account: tenant.account });
    await expectRevert(registry.write.sign([DOC_HASH], { account: tenant.account }), "AlreadySigned");
  });

  it("reverts when reading or signing an unregistered hash", async () => {
    const { registry, tenant } = await fresh();
    await expectRevert(registry.read.getRecord([DOC_HASH]), "NotRegistered");
    await expectRevert(registry.write.sign([DOC_HASH], { account: tenant.account }), "NotRegistered");
    assert.equal(await registry.read.isRegistered([DOC_HASH]), false);
  });

  it("F-1: a stranger cannot register a hash on behalf of other parties", async () => {
    const { registry, tenant, landlord, stranger } = await fresh();
    // The caller must be one of the listed parties, so nobody can squat on a document hash with a
    // party list of their own choosing.
    await expectRevert(
      registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address, landlord.account.address]], {
        account: stranger.account,
      }),
      "CreatorNotAParty",
    );
    assert.equal(await registry.read.isRegistered([DOC_HASH]), false);
    await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address, landlord.account.address]], {
      account: tenant.account,
    });
    assert.equal(await registry.read.isRegistered([DOC_HASH]), true);
  });

  it("the TypeScript ABI used by the app matches the compiled contract", async () => {
    const artifact = await (await import("hardhat")).default.artifacts.readArtifact("DocumentRegistry");
    type Item = { type: string; name?: string; inputs?: { type: string }[] };
    const signature = (item: Item) => `${item.type}:${item.name ?? ""}(${(item.inputs ?? []).map((i) => i.type).join(",")})`;
    const wanted = (artifact.abi as Item[]).filter((i) => i.type !== "constructor").map(signature).sort();
    const have = (documentRegistryAbi as unknown as Item[]).map(signature).sort();
    assert.deepEqual(have, wanted);
  });

  it("gas stays small (measured, printed for the README)", async () => {
    const { registry, publicClient, tenant, landlord } = await fresh();
    const used = async (hash: Hex) => (await publicClient.waitForTransactionReceipt({ hash })).gasUsed;
    const registerTwo = await used(
      await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address, landlord.account.address]], {
        account: tenant.account,
      }),
    );
    const signFirst = await used(await registry.write.sign([DOC_HASH], { account: tenant.account }));
    const signLast = await used(await registry.write.sign([DOC_HASH], { account: landlord.account }));
    const registerOne = await used(
      await registry.write.register([OTHER_HASH, "PROPERTY_RECORD", [tenant.account.address]], { account: tenant.account }),
    );
    console.log(
      `      GAS register(2 parties)=${registerTwo} sign(first)=${signFirst} sign(last, fully signed)=${signLast} register(1 party)=${registerOne}`,
    );
    assert.ok(registerTwo < 400_000n);
    assert.ok(signLast < 120_000n);
  });
});
