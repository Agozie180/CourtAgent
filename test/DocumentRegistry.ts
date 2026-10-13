import { expect } from "chai";
import hre from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, keccak256, toBytes, zeroAddress, zeroHash } from "viem";

const DOC_HASH = keccak256(toBytes("TENANCY AGREEMENT: flat 3, Lekki, 12 months, NGN 1,200,000"));
const OTHER_HASH = keccak256(toBytes("a different document"));

async function deployFixture() {
  const [tenant, landlord, stranger, third] = await hre.viem.getWalletClients();
  const registry = await hre.viem.deployContract("DocumentRegistry");
  const publicClient = await hre.viem.getPublicClient();
  return { registry, publicClient, tenant, landlord, stranger, third };
}

async function expectRevert(promise: Promise<unknown>, errorName: string) {
  try {
    await promise;
  } catch (error) {
    expect(String(error)).to.contain(errorName);
    return;
  }
  expect.fail(`expected revert with ${errorName}`);
}

describe("DocumentRegistry", () => {
  it("registers a document with its parties and stores no document text", async () => {
    const { registry, tenant, landlord } = await loadFixture(deployFixture);
    await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address, landlord.account.address]], {
      account: tenant.account,
    });

    const [creator, createdAt, fullySignedAt, kind, parties, signed] = await registry.read.getRecord([DOC_HASH]);
    expect(getAddress(creator)).to.equal(getAddress(tenant.account.address));
    expect(createdAt > 0n).to.equal(true);
    expect(fullySignedAt).to.equal(0n);
    expect(kind).to.equal("TENANCY_AGREEMENT");
    expect(parties.map((party) => getAddress(party))).to.deep.equal([
      getAddress(tenant.account.address),
      getAddress(landlord.account.address),
    ]);
    expect([...signed]).to.deep.equal([false, false]);
    expect(await registry.read.isRegistered([DOC_HASH])).to.equal(true);
    expect(await registry.read.isFullySigned([DOC_HASH])).to.equal(false);
  });

  it("marks the document fully signed only after every party signs", async () => {
    const { registry, tenant, landlord } = await loadFixture(deployFixture);
    await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address, landlord.account.address]], {
      account: tenant.account,
    });

    await registry.write.sign([DOC_HASH], { account: tenant.account });
    expect(await registry.read.isFullySigned([DOC_HASH])).to.equal(false);

    await time.increase(60);
    await registry.write.sign([DOC_HASH], { account: landlord.account });
    expect(await registry.read.isFullySigned([DOC_HASH])).to.equal(true);

    const [, createdAt, fullySignedAt, , , signed] = await registry.read.getRecord([DOC_HASH]);
    expect(fullySignedAt > createdAt).to.equal(true);
    expect([...signed]).to.deep.equal([true, true]);
  });

  it("emits registration and signing events", async () => {
    const { registry, publicClient, tenant, landlord } = await loadFixture(deployFixture);
    await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address, landlord.account.address]], {
      account: tenant.account,
    });
    await registry.write.sign([DOC_HASH], { account: tenant.account });
    await registry.write.sign([DOC_HASH], { account: landlord.account });

    const logs = await publicClient.getContractEvents({
      address: registry.address,
      abi: registry.abi,
      fromBlock: 0n,
    });
    const names = logs.map((log) => (log as unknown as { eventName: string }).eventName);
    expect(names).to.deep.equal(["DocumentRegistered", "DocumentSigned", "DocumentSigned", "DocumentFullySigned"]);
  });

  it("supports a single-party record such as a widow's property record", async () => {
    const { registry, tenant } = await loadFixture(deployFixture);
    await registry.write.register([OTHER_HASH, "PROPERTY_RECORD", [tenant.account.address]], { account: tenant.account });
    await registry.write.sign([OTHER_HASH], { account: tenant.account });
    expect(await registry.read.isFullySigned([OTHER_HASH])).to.equal(true);
  });

  it("rejects a duplicate registration", async () => {
    const { registry, tenant } = await loadFixture(deployFixture);
    await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address]], { account: tenant.account });
    await expectRevert(
      registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address]], { account: tenant.account }),
      "AlreadyRegistered",
    );
  });

  it("rejects an empty hash, a bad kind and bad party lists", async () => {
    const { registry, tenant, landlord } = await loadFixture(deployFixture);
    await expectRevert(registry.write.register([zeroHash, "X", [tenant.account.address]]), "EmptyHash");
    await expectRevert(registry.write.register([DOC_HASH, "", [tenant.account.address]]), "InvalidKind");
    await expectRevert(registry.write.register([DOC_HASH, "K".repeat(65), [tenant.account.address]]), "InvalidKind");
    await expectRevert(registry.write.register([DOC_HASH, "X", []]), "InvalidParties");
    await expectRevert(registry.write.register([DOC_HASH, "X", [zeroAddress]]), "InvalidParties");
    await expectRevert(
      registry.write.register([DOC_HASH, "X", [tenant.account.address, tenant.account.address]]),
      "InvalidParties",
    );
    const nine = Array.from({ length: 9 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}` as `0x${string}`);
    await expectRevert(registry.write.register([DOC_HASH, "X", nine]), "InvalidParties");
    expect(landlord.account.address).to.not.equal(undefined);
  });

  it("only lets listed parties sign, and only once", async () => {
    const { registry, tenant, landlord, stranger } = await loadFixture(deployFixture);
    await registry.write.register([DOC_HASH, "TENANCY_AGREEMENT", [tenant.account.address, landlord.account.address]], {
      account: tenant.account,
    });
    await expectRevert(registry.write.sign([DOC_HASH], { account: stranger.account }), "NotAParty");
    await registry.write.sign([DOC_HASH], { account: tenant.account });
    await expectRevert(registry.write.sign([DOC_HASH], { account: tenant.account }), "AlreadySigned");
  });

  it("reverts when reading or signing an unregistered hash", async () => {
    const { registry, tenant } = await loadFixture(deployFixture);
    await expectRevert(registry.read.getRecord([DOC_HASH]), "NotRegistered");
    await expectRevert(registry.write.sign([DOC_HASH], { account: tenant.account }), "NotRegistered");
    expect(await registry.read.isRegistered([DOC_HASH])).to.equal(false);
  });
});
