import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { saveExcelFile, getExcelFilesByUser, saveSearchResult } from "./db";
import * as XLSX from "xlsx";

interface SearchMatch {
  rowNumber: number;
  codeFound: string;
  modelVoiture: string;
  sujet: string;
  solutionQ: string;
  solutionS: string;
  successProbability: number;
}

function parseExcelData(buffer: Buffer | Uint8Array): unknown[][] {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const workbook = XLSX.read(buf, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
  return jsonData as unknown[][];
}

function calculateSuccessProbability(solution: string): number {
  const text = solution.toLowerCase();
  const highSuccessKeywords = [
    "résolu", "réparé", "remplacé", "changé", "installé",
    "corrigé", "fixed", "replaced", "solved", "success"
  ];
  const mediumSuccessKeywords = [
    "diagnostic", "test", "vérif", "check", "inspect",
    "à tester", "à vérifier", "possible", "likely"
  ];
  
  let probability = 50;
  if (highSuccessKeywords.some(keyword => text.includes(keyword))) {
    probability = 85;
  } else if (mediumSuccessKeywords.some(keyword => text.includes(keyword))) {
    probability = 65;
  }
  
  if (solution.length > 200) probability += 10;
  if (solution.length < 50) probability -= 10;
  
  return Math.min(Math.max(probability, 20), 100);
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

function searchDefautCodes(
  data: unknown[][],
  searchCode: string
): SearchMatch[] {
  const foundResults: SearchMatch[] = [];
  const searchNormalized = normalizeCode(searchCode);
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!Array.isArray(row)) continue;

    const description = String(row[8] || "").trim();
    const sujet = String(row[4] || "").trim();
    const modelVoiture = String(row[7] || "Modèle inconnu").trim();
    const solutionQ = String(row[16] || "Non spécifié").trim();
    const solutionS = String(row[18] || "Non spécifié").trim();

    const descriptionNormalized = normalizeCode(description);
    
    if (descriptionNormalized.includes(searchNormalized)) {
      const combinedSolution = `${solutionQ} ${solutionS}`;
      const probability = calculateSuccessProbability(combinedSolution);

      foundResults.push({
        rowNumber: i + 1,
        codeFound: searchNormalized,
        modelVoiture,
        sujet,
        solutionQ,
        solutionS,
        successProbability: probability,
      });
    }
  }

  return foundResults.sort((a, b) => b.successProbability - a.successProbability);
}

async function generateAISummary(
  searchCode: string,
  results: SearchMatch[]
): Promise<string> {
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Tu es un assistant technique expert en diagnostic automobile. Tu dois générer des résumés techniques concis et directs pour les techniciens hotline.",
        },
        {
          role: "user",
          content: `Génère un résumé technique concis (2-3 phrases maximum) pour le code défaut ${searchCode} basé sur les solutions trouvées:\n\n${results
            .map(
              (r, idx) => `Solution ${idx + 1}:\n- Modèle: ${r.modelVoiture}\n- Échanges: ${r.solutionQ}\n- Dernier échange: ${r.solutionS}`
            )
            .join("\n\n")}\n\nSois direct, technique et adapté à un technicien hotline automobile.`,
        },
      ],
    });

    if (response.choices && response.choices[0]?.message?.content) {
      const content = response.choices[0].message.content;
      return typeof content === 'string' ? content : '';
    }
    return "";
  } catch (error) {
    console.error("Error generating AI summary:", error);
    return "";
  }
}

export const defautSearchRouter = router({
  uploadFile: protectedProcedure
    .input(
      z.object({
        fileBase64: z.string(),
        fileName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const buffer = Buffer.from(input.fileBase64, 'base64');
        const data = parseExcelData(buffer);

        if (!data || data.length < 2) {
          throw new Error("Le fichier Excel est vide ou invalide");
        }

        const fileKey = `excel-files/${ctx.user.id}/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        const rowCount = data.length - 1;
        await saveExcelFile(ctx.user.id, input.fileName, fileKey, rowCount);

        return {
          success: true,
          rowCount,
          fileName: input.fileName,
          url,
        };
      } catch (error) {
        console.error("Error uploading file:", error);
        throw new Error(
          error instanceof Error ? error.message : "Erreur lors du chargement du fichier"
        );
      }
    }),

  searchDefautCode: protectedProcedure
    .input(
      z.object({
        fileUrl: z.string(),
        searchCode: z.string().min(1, "Le code défaut est requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const response = await fetch(input.fileUrl);
        if (!response.ok) {
          throw new Error("Impossible de télécharger le fichier");
        }
        const buffer = await response.arrayBuffer();

        const data = parseExcelData(Buffer.from(buffer));
        const results = searchDefautCodes(data, input.searchCode);

        if (results.length === 0) {
          return {
            success: false,
            message: `Aucun résultat trouvé pour le code ${input.searchCode}`,
            results: [],
            summary: "",
          };
        }

        const summary = await generateAISummary(input.searchCode, results);

        await saveSearchResult(
          ctx.user.id,
          0,
          input.searchCode,
          JSON.stringify(results),
          summary
        );

        return {
          success: true,
          results,
          summary,
        };
      } catch (error) {
        console.error("Error searching defaut code:", error);
        throw new Error(
          error instanceof Error ? error.message : "Erreur lors de la recherche"
        );
      }
    }),

  getUserFiles: protectedProcedure.query(async ({ ctx }) => {
    try {
      const files = await getExcelFilesByUser(ctx.user.id);
      return files;
    } catch (error) {
      console.error("Error getting user files:", error);
      throw new Error("Erreur lors de la récupération des fichiers");
    }
  }),
});
