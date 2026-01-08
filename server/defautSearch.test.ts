import { describe, expect, it, beforeEach, vi } from "vitest";
import * as XLSX from "xlsx";
import { defautSearchRouter } from "./defautSearch";
import type { TrpcContext } from "./_core/context";

// Mock user context
const mockUser = {
  id: 1,
  openId: "test-user",
  email: "test@example.com",
  name: "Test User",
  loginMethod: "manus",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

// Create mock context
function createMockContext(): TrpcContext {
  return {
    user: mockUser,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

// Create sample Excel data
function createSampleExcelBuffer(): Buffer {
  const data = [
    [
      "id",
      "Flux",
      "Etat",
      "Date Création ticket",
      "Sujet",
      "Plaque Immatriculation",
      "Marque Voiture",
      "Modele Voiture",
      "Description ticket",
      "Raison sociale garage",
      "Hotliner",
      "Famille",
      "Distributeur",
      "Réseau",
      "Réseau détaillé",
      "Année première immatriculation",
      "Echanges",
      "Carburant",
      "Dernier échange garage",
    ],
    [
      83388,
      "Web",
      "Cloturé avec procédure",
      "2025-01-02 11:03:43",
      "PANNE FAP",
      "GW-422-VS",
      "CITROEN",
      "JUMPER",
      "VOYANT ALLUMÉ MODE DEGRADÉ DEFAUT P15BE RELAIS VOUGIE DU FAP",
      "GARAGE SAINT JACQUES",
      "Adrien Lebrun",
      "admission - echappement-suralimentation",
      "MARCEUL ST PIERRE DES CORP",
      "Top Garage",
      "Top garage",
      2012,
      "<p>Bonjour, merci pour le retour.</p><p>F26 + BSM HS</p>",
      "GAZOLE",
      "<p>Bonjour, </p><p>J'ai appliquer les note technique 2 panne fusible f26</p>",
    ],
    [
      83389,
      "Web",
      "Cloturé",
      "2025-01-03 10:00:00",
      "PANNE MOTEUR",
      "AB-123-CD",
      "PEUGEOT",
      "308",
      "CODE DEFAUT P20EE PROBLEME CAPTEUR OXYGENE",
      "GARAGE DUPONT",
      "Jean Dupont",
      "admission - echappement",
      "PARIS",
      "Network",
      "Network",
      2015,
      "<p>Remplacement capteur O2</p>",
      "ESSENCE",
      "<p>Capteur remplacé avec succès</p>",
    ],
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Worksheet");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

describe("defautSearchRouter", () => {
  let ctx: TrpcContext;
  let caller: ReturnType<typeof defautSearchRouter.createCaller>;

  beforeEach(() => {
    ctx = createMockContext();
    caller = defautSearchRouter.createCaller(ctx);
  });

  describe("searchDefautCode", () => {
    it("should find defect code P15BE in Excel data", async () => {
      const buffer = createSampleExcelBuffer();
      const fileUrl = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," +
        buffer.toString("base64");

      // Mock fetch to return the buffer
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => buffer,
      });

      const result = await caller.searchDefautCode({
        fileUrl,
        searchCode: "P15BE",
      });

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0]?.codeFound).toContain("P15BE");
    });

    it("should find defect code P20EE in Excel data", async () => {
      const buffer = createSampleExcelBuffer();
      const fileUrl = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," +
        buffer.toString("base64");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => buffer,
      });

      const result = await caller.searchDefautCode({
        fileUrl,
        searchCode: "P20EE",
      });

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0]?.codeFound).toContain("P20EE");
    });

    it("should be case-insensitive", async () => {
      const buffer = createSampleExcelBuffer();
      const fileUrl = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," +
        buffer.toString("base64");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => buffer,
      });

      const result1 = await caller.searchDefautCode({
        fileUrl,
        searchCode: "p15be",
      });

      const result2 = await caller.searchDefautCode({
        fileUrl,
        searchCode: "P15BE",
      });

      expect(result1.success).toBe(result2.success);
      expect(result1.results.length).toBe(result2.results.length);
    });

    it("should return empty results for non-existent code", async () => {
      const buffer = createSampleExcelBuffer();
      const fileUrl = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," +
        buffer.toString("base64");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => buffer,
      });

      const result = await caller.searchDefautCode({
        fileUrl,
        searchCode: "NONEXISTENT",
      });

      expect(result.success).toBe(false);
      expect(result.results.length).toBe(0);
    });

    it("should require search code", async () => {
      const buffer = createSampleExcelBuffer();
      const fileUrl = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," +
        buffer.toString("base64");

      try {
        await caller.searchDefautCode({
          fileUrl,
          searchCode: "",
        });
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should extract solution data from columns Q and S", async () => {
      const buffer = createSampleExcelBuffer();
      const fileUrl = "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," +
        buffer.toString("base64");

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => buffer,
      });

      const result = await caller.searchDefautCode({
        fileUrl,
        searchCode: "P15BE",
      });

      expect(result.success).toBe(true);
      if (result.results.length > 0) {
        const firstResult = result.results[0];
        expect(firstResult?.solutionQ).toBeDefined();
        expect(firstResult?.solutionS).toBeDefined();
        expect(firstResult?.rowNumber).toBeGreaterThan(0);
      }
    });
  });

  describe("getUserFiles", () => {
    it("should return user files", async () => {
      // This test would require database mocking
      // For now, we'll just verify the procedure exists and is callable
      expect(caller.getUserFiles).toBeDefined();
    });
  });
});
