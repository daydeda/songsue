import { describe, it, expect } from "vitest";
import { createHash } from "crypto";

// ---------------------------------------------------------------------------
// WHY THIS IS A PURE REFERENCE TEST, NOT A DIRECT IMPORT
//
// src/modules/audit/audit.service.ts does `import { db } from "@/db"` at the top
// of the module, and src/db/index.ts calls postgres(process.env.DATABASE_URL!) at
// import time — so importing AuditService would attempt a real (prod) connection.
// On top of that, the hashing helper (computeRowHash) and the chain-walk inside
// verifyChainIntegrity() are NOT exported.
//
// Per the test rules: no DB, no network, no source hacks. So this test reproduces
// the EXACT row-hash algorithm and chain-walk from the service (field order,
// JSON.stringify of a fixed-order tuple, sha256, genesis sentinel, prevHash link)
// and pins the load-bearing invariants against that reference: a correctly chained
// sequence is intact; mutating a row's content breaks it; reordering or removing a
// row breaks it.
//
// IF the hashing helper is ever extracted into a DB-free module (e.g.
// src/modules/audit/audit-hash.ts) this test should import the real helper instead
// of the copy below, so the reference can never silently drift from production.
// The copy is kept byte-for-byte identical to audit.service.ts as of this writing.
// ---------------------------------------------------------------------------

const GENESIS_HASH = "0".repeat(64);

interface AuditRow {
  id: string;
  timestamp: Date;
  actorId: string | null;
  targetId: string | null;
  action: string;
  ipAddress: string | null;
  prevHash: string;
  rowHash: string;
}

// Mirror of computeRowHash() in audit.service.ts — field order is load-bearing.
function computeRowHash(fields: {
  id: string;
  timestamp: string;
  actorId: string | null;
  targetId: string | null;
  action: string;
  ipAddress: string | null;
  prevHash: string;
}): string {
  const payload = JSON.stringify([
    fields.id,
    fields.timestamp,
    fields.actorId,
    fields.targetId,
    fields.action,
    fields.ipAddress,
    fields.prevHash,
  ]);
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

// Mirror of the chain-walk in AuditService.verifyChainIntegrity(), minus the DB
// fetch. Rows must be passed in ascending-timestamp order (as the service queries).
function verifyChain(rows: AuditRow[]): { valid: boolean; firstBreakIndex: number | null; reason: string } {
  const chainStart = rows.findIndex((r) => r.rowHash !== "");
  if (chainStart === -1) {
    return { valid: true, firstBreakIndex: null, reason: "no hashed rows" };
  }

  let expectedPrevHash: string | null = null;
  for (let i = chainStart; i < rows.length; i++) {
    const row = rows[i];

    if (expectedPrevHash !== null && row.prevHash !== expectedPrevHash) {
      return { valid: false, firstBreakIndex: i, reason: "prevHash mismatch (delete/insert)" };
    }

    const recomputed = computeRowHash({
      id: row.id,
      timestamp: row.timestamp.toISOString(),
      actorId: row.actorId,
      targetId: row.targetId,
      action: row.action,
      ipAddress: row.ipAddress,
      prevHash: row.prevHash,
    });

    if (recomputed !== row.rowHash) {
      return { valid: false, firstBreakIndex: i, reason: "rowHash mismatch (content modified)" };
    }

    expectedPrevHash = row.rowHash;
  }

  return { valid: true, firstBreakIndex: null, reason: "intact" };
}

// Build a correctly chained sequence the way logActionInternal would: each row's
// prevHash = previous row's rowHash (genesis for the first), rowHash computed over
// the fixed field tuple.
function makeRow(
  seed: number,
  prevHash: string,
  overrides: Partial<Omit<AuditRow, "prevHash" | "rowHash">> = {},
): AuditRow {
  const base = {
    id: `00000000-0000-0000-0000-${String(seed).padStart(12, "0")}`,
    timestamp: new Date(1_700_000_000_000 + seed * 60_000),
    actorId: `actor-${seed}`,
    targetId: `target-${seed}`,
    action: `view_medical_detail`,
    ipAddress: "10.0.0.1",
    ...overrides,
  };
  const rowHash = computeRowHash({
    id: base.id,
    timestamp: base.timestamp.toISOString(),
    actorId: base.actorId,
    targetId: base.targetId,
    action: base.action,
    ipAddress: base.ipAddress,
    prevHash,
  });
  return { ...base, prevHash, rowHash };
}

function makeChain(n: number): AuditRow[] {
  const rows: AuditRow[] = [];
  let prev = GENESIS_HASH;
  for (let i = 1; i <= n; i++) {
    const row = makeRow(i, prev);
    rows.push(row);
    prev = row.rowHash;
  }
  return rows;
}

describe("audit hash-chain reference algorithm", () => {
  it("computeRowHash is deterministic and sensitive to every field", () => {
    const fields = {
      id: "id-1",
      timestamp: new Date(1_700_000_000_000).toISOString(),
      actorId: "a",
      targetId: "t",
      action: "view_medical_detail",
      ipAddress: "10.0.0.1",
      prevHash: GENESIS_HASH,
    };
    const h = computeRowHash(fields);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(computeRowHash(fields)).toBe(h); // deterministic

    // Changing any single field changes the hash.
    expect(computeRowHash({ ...fields, action: "view_medical_signal" })).not.toBe(h);
    expect(computeRowHash({ ...fields, actorId: "b" })).not.toBe(h);
    expect(computeRowHash({ ...fields, targetId: "t2" })).not.toBe(h);
    expect(computeRowHash({ ...fields, ipAddress: "10.0.0.2" })).not.toBe(h);
    expect(computeRowHash({ ...fields, prevHash: "f".repeat(64) })).not.toBe(h);
    expect(computeRowHash({ ...fields, id: "id-2" })).not.toBe(h);
  });

  it("null actorId/targetId/ipAddress are distinct from empty-string values", () => {
    const base = {
      id: "id-1",
      timestamp: new Date(1_700_000_000_000).toISOString(),
      action: "x",
      prevHash: GENESIS_HASH,
    };
    const withNulls = computeRowHash({ ...base, actorId: null, targetId: null, ipAddress: null });
    const withEmpty = computeRowHash({ ...base, actorId: "", targetId: "", ipAddress: "" });
    expect(withNulls).not.toBe(withEmpty);
  });
});

describe("verifyChain", () => {
  it("a correctly chained sequence verifies as intact", () => {
    const result = verifyChain(makeChain(5));
    expect(result.valid).toBe(true);
    expect(result.firstBreakIndex).toBeNull();
  });

  it("an empty log is trivially valid", () => {
    expect(verifyChain([]).valid).toBe(true);
  });

  it("a single genesis-linked row is valid", () => {
    expect(verifyChain(makeChain(1)).valid).toBe(true);
  });

  it("skips leading pre-chain rows (rowHash === '') and verifies the rest", () => {
    const chain = makeChain(3);
    const preChain: AuditRow = {
      id: "legacy-1",
      timestamp: new Date(1_600_000_000_000),
      actorId: "old",
      targetId: null,
      action: "legacy",
      ipAddress: null,
      prevHash: "",
      rowHash: "", // pre-chain sentinel
    };
    const result = verifyChain([preChain, ...chain]);
    expect(result.valid).toBe(true);
  });

  it("mutating a row's content breaks the chain (rowHash mismatch)", () => {
    const chain = makeChain(5);
    // Tamper with row index 2's action WITHOUT recomputing its rowHash —
    // exactly what an attacker editing the DB directly would produce.
    chain[2] = { ...chain[2], action: "view_medical_signal" };
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.firstBreakIndex).toBe(2);
    expect(result.reason).toContain("rowHash mismatch");
  });

  it("mutating a row AND recomputing its own rowHash still breaks the chain downstream (prevHash link)", () => {
    const chain = makeChain(5);
    // Re-seal row 2 so its own rowHash is internally consistent...
    const tampered = makeRow(3, chain[2].prevHash, { action: "view_medical_signal" });
    chain[2] = tampered;
    // ...but row 3 still links to the OLD row-2 hash, so the chain breaks at row 3.
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.firstBreakIndex).toBe(3);
    expect(result.reason).toContain("prevHash mismatch");
  });

  it("removing a row breaks the chain (downstream prevHash no longer matches)", () => {
    const chain = makeChain(5);
    chain.splice(2, 1); // delete the 3rd row
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("prevHash mismatch");
  });

  it("reordering rows breaks the chain", () => {
    const chain = makeChain(5);
    // Swap rows 1 and 2.
    [chain[1], chain[2]] = [chain[2], chain[1]];
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
  });

  it("inserting a forged row breaks the chain", () => {
    const chain = makeChain(5);
    const forged = makeRow(99, chain[1].rowHash, { action: "grant_super_admin" });
    chain.splice(2, 0, forged); // insert after row 1
    const result = verifyChain(chain);
    expect(result.valid).toBe(false);
    // The genuine row that now follows the forged one links to the wrong prevHash.
    expect(result.reason).toContain("prevHash mismatch");
  });
});
