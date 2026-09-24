jest.mock("../db/pool", () => {
  const { createPgMock } = require("../testUtils/pgMock");
  return createPgMock();
});

jest.mock("@stellar/stellar-sdk", () => {
  const mockStream = jest.fn(() => jest.fn());
  const mockCursor = jest.fn(() => ({ stream: mockStream }));
  const mockForAccount = jest.fn(() => ({ cursor: mockCursor }));
  const mockTransactions = jest.fn(() => ({ forAccount: mockForAccount }));
  const mockEvents = jest.fn(() => ({ cursor: jest.fn(() => ({ stream: jest.fn() })) }));
  const mockServer = { transactions: mockTransactions, events: mockEvents };
  return { Horizon: { Server: jest.fn(() => mockServer) } };
});

const pool = require("../db/pool");
const IndexerService = require("./indexerService");

process.env.CONTRACT_ID = "test-contract-id";

describe("indexerService", () => {
  beforeEach(() => {
    pool.reset();
    pool.indexerState.last_processed_ledger = null;
  });

  const platformWallet = "GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYZABC";

  describe("loadCheckpoint", () => {
    it("returns 1000 when DB has last_processed_ledger at 1000", async () => {
      pool.indexerState.last_processed_ledger = 1000;
      pool.indexerState.synced = true;
      pool.indexerState.last_transaction_at = null;

      const service = new IndexerService({ platformWallet });
      const result = await service.loadCheckpoint();
      expect(result).toBe(1000);
      expect(service.syncState.lastProcessedLedger).toBe(1000);
      expect(service.syncState.synced).toBe(true);
    });

    it("falls back to null and logs a warning when DB cursor read fails", async () => {
      pool.query.mockRejectedValueOnce(new Error("DB connection lost"));

      const warnSpy = jest.spyOn(console, "warn").mockImplementation();
      const service = new IndexerService({ platformWallet });
      const result = await service.loadCheckpoint();

      expect(result).toBeNull();
      expect(service.syncState.lastProcessedLedger).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("HORIZON_CURSOR_START"),
        expect.anything(),
      );

      warnSpy.mockRestore();
    });
  });

  describe("start with checkpoint", () => {
    it("starts stream cursor from lastProcessedLedger when set", async () => {
      pool.indexerState.last_processed_ledger = 1000;
      pool.indexerState.synced = true;
      pool.indexerState.last_transaction_at = null;

      const service = new IndexerService({ platformWallet });
      await service.loadCheckpoint();

      await service.start();

      const mockCursor = service.horizon.transactions().forAccount().cursor;
      expect(mockCursor).toHaveBeenCalledWith("1000");
      expect(service.syncState.running).toBe(true);
    });

    it("uses HORIZON_CURSOR_START when lastProcessedLedger is null", async () => {
      const service = new IndexerService({ platformWallet });
      await service.loadCheckpoint();

      await service.start();

      const mockCursor = service.horizon.transactions().forAccount().cursor;
      expect(mockCursor).toHaveBeenCalledWith("now");
    });
  });

  describe("crash recovery", () => {
    it("restarts from last committed cursor after crash mid-batch", async () => {
      pool.indexerState.last_processed_ledger = 1000;
      pool.indexerState.synced = true;
      pool.indexerState.last_transaction_at = null;

      const service = new IndexerService({ platformWallet });
      await service.loadCheckpoint();

      service.syncState.running = false;
      service.syncState.lastProcessedLedger = 1000;

      await service.start();

      const mockCursor = service.horizon.transactions().forAccount().cursor;
      expect(mockCursor).toHaveBeenCalledWith("1000");
      expect(service.syncState.lastProcessedLedger).toBe(1000);
    });
  });
});
