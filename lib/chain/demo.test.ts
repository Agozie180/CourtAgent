import { describe, expect, it } from "vitest";
import { getAddress, type Address } from "viem";
import { hashDocument } from "@/lib/hash/document";
import { DEMO_LANDLORD, DEMO_TENANT, DemoRegistry, type StorageLike } from "./demo";

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
}

function registryFor(storage: StorageLike, actor: { current: Address | null }) {
  return new DemoRegistry(storage, () => actor.current, () => 1_700_000_000);
}

describe("DemoRegistry (mirrors the contract rules)", () => {
  const hash = hashDocument("Tenancy agreement, Lekki");

  it("registers, then needs every party to sign", async () => {
    const storage = memoryStorage();
    const actor = { current: DEMO_TENANT as Address | null };
    const registry = registryFor(storage, actor);

    const tx = await registry.register(hash, "TENANCY_AGREEMENT", [DEMO_TENANT, DEMO_LANDLORD]);
    expect(tx.source).toBe("demo");
    expect((await registry.getRecord(hash))?.fullySignedAt).toBe(0);

    await registry.sign(hash);
    expect((await registry.getRecord(hash))?.signed).toEqual([true, false]);

    actor.current = DEMO_LANDLORD;
    await registry.sign(hash);
    const record = await registry.getRecord(hash);
    expect(record?.signed).toEqual([true, true]);
    expect(record?.fullySignedAt).toBe(1_700_000_000);
    expect(record?.parties.map((p) => getAddress(p))).toEqual([getAddress(DEMO_TENANT), getAddress(DEMO_LANDLORD)]);
  });

  it("persists across instances using the same storage", async () => {
    const storage = memoryStorage();
    const actor = { current: DEMO_TENANT as Address | null };
    await registryFor(storage, actor).register(hash, "PROPERTY_RECORD", [DEMO_TENANT]);
    expect(await registryFor(storage, actor).getRecord(hash)).not.toBeNull();
  });

  it("rejects duplicates, strangers, double signing and bad input", async () => {
    const storage = memoryStorage();
    const actor = { current: DEMO_TENANT as Address | null };
    const registry = registryFor(storage, actor);
    await registry.register(hash, "TENANCY_AGREEMENT", [DEMO_TENANT, DEMO_LANDLORD]);

    await expect(registry.register(hash, "TENANCY_AGREEMENT", [DEMO_TENANT])).rejects.toThrow("AlreadyRegistered");
    await registry.sign(hash);
    await expect(registry.sign(hash)).rejects.toThrow("AlreadySigned");

    actor.current = "0x0000000000000000000000000000000000000abc";
    await expect(registry.sign(hash)).rejects.toThrow("NotAParty");

    const other = hashDocument("another");
    await expect(registry.register(other, "TENANCY_AGREEMENT", [])).rejects.toThrow("InvalidParties");
    await expect(registry.register(other, "TENANCY_AGREEMENT", [DEMO_TENANT, DEMO_TENANT])).rejects.toThrow(
      "InvalidParties",
    );
    await expect(registry.sign(other)).rejects.toThrow("NotRegistered");
  });

  it("F-1: only a listed party can register a document (same rule as the contract)", async () => {
    const storage = memoryStorage();
    const actor = { current: "0x0000000000000000000000000000000000000abc" as Address | null };
    const registry = registryFor(storage, actor);
    await expect(registry.register(hash, "TENANCY_AGREEMENT", [DEMO_TENANT, DEMO_LANDLORD])).rejects.toThrow(
      "CreatorNotAParty",
    );
    expect(await registry.getRecord(hash)).toBeNull();
  });

  it("returns null for an unknown hash and needs an actor to write", async () => {
    const storage = memoryStorage();
    const actor = { current: null as Address | null };
    const registry = registryFor(storage, actor);
    expect(await registry.getRecord(hash)).toBeNull();
    await expect(registry.register(hash, "TENANCY_AGREEMENT", [DEMO_TENANT])).rejects.toThrow("acting as");
  });
});
