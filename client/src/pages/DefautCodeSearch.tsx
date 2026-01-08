import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, Search, AlertCircle, CheckCircle, FileSpreadsheet, X, TrendingUp } from "lucide-react";
import { Streamdown } from "streamdown";

interface SearchResult {
  rowNumber: number;
  codeFound: string;
  modelVoiture: string;
  sujet: string;
  solutionQ: string;
  solutionS: string;
  successProbability: number;
}

interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  summary: string;
  message?: string;
}

function getProbabilityColor(probability: number): string {
  if (probability >= 80) return "bg-green-100 text-green-700 border-green-300";
  if (probability >= 60) return "bg-blue-100 text-blue-700 border-blue-300";
  if (probability >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-300";
  return "bg-orange-100 text-orange-700 border-orange-300";
}

function getProbabilityLabel(probability: number): string {
  if (probability >= 80) return "Très probable";
  if (probability >= 60) return "Probable";
  if (probability >= 40) return "Possible";
  return "À explorer";
}

export default function DefautCodeSearch() {
  const [fileLoaded, setFileLoaded] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.defautSearch.uploadFile.useMutation();
  const searchMutation = trpc.defautSearch.searchDefautCode.useMutation();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setIsLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let base64String = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        base64String += String.fromCharCode(bytes[i]);
      }
      base64String = btoa(base64String);
      const result = await uploadMutation.mutateAsync({
        fileBase64: base64String,
        fileName: file.name,
      });

      setFileName(result.fileName);
      setFileUrl(result.url);
      setRowCount(result.rowCount);
      setFileLoaded(true);
      setSearchResults([]);
      setAiSummary("");
      setIsLoading(false);
    } catch (err) {
      console.error("Upload error:", err);
      setError(
        err instanceof Error ? err.message : "Erreur lors du chargement du fichier"
      );
      setFileLoaded(false);
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchCode.trim()) {
      setError("Veuillez entrer un code défaut");
      return;
    }

    if (!fileLoaded || !fileUrl) {
      setError("Veuillez d'abord charger un fichier Excel");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const result = await searchMutation.mutateAsync({
        fileUrl,
        searchCode,
      });

      if (result.success) {
        setSearchResults(result.results);
        setAiSummary(result.summary);
      } else {
        setError(result.message || "Aucun résultat trouvé");
        setSearchResults([]);
        setAiSummary("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la recherche");
      setSearchResults([]);
      setAiSummary("");
    } finally {
      setIsLoading(false);
    }
  };

  const clearFile = () => {
    setFileLoaded(false);
    setFileName("");
    setFileUrl("");
    setSearchCode("");
    setSearchResults([]);
    setAiSummary("");
    setError("");
    setRowCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Recherche Codes Défauts
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Assistant technique hotline automobile - Recherche instantanée
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Étape 1 : Charger le fichier Excel
                </CardTitle>
                <CardDescription>
                  Sélectionnez votre fichier Excel (.xls ou .xlsx)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <label className="flex-1 cursor-pointer">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Upload className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-600 font-medium">
                            {fileName || "Cliquez pour sélectionner un fichier"}
                          </span>
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileUpload}
                        disabled={isLoading}
                        className="hidden"
                      />
                    </label>
                    {fileLoaded && (
                      <Button
                        onClick={clearFile}
                        variant="outline"
                        size="icon"
                        className="h-auto"
                        title="Supprimer le fichier"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    )}
                  </div>

                  {fileLoaded && (
                    <div className="flex items-center gap-2 text-green-600 text-sm p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span>
                        Fichier chargé : <strong>{rowCount}</strong> lignes de données
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Search Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Étape 2 : Rechercher un code défaut
                </CardTitle>
                <CardDescription>
                  Entrez le code défaut et optionnellement le symptôme de panne
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    type="text"
                    value={searchCode}
                    onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Ex: P20EE"
                    disabled={!fileLoaded || isLoading}
                    className="font-mono text-lg"
                  />
                  <Button
                    onClick={handleSearch}
                    disabled={!fileLoaded || isLoading || !searchCode.trim()}
                    className="gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Recherche...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Rechercher
                      </>
                    )}
                  </Button>
                </div>
                

              </CardContent>
            </Card>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Results Section */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-5 h-5" />
                      Résultats pour : {searchCode}
                    </CardTitle>
                    <CardDescription>
                      {searchResults.length} correspondance(s) trouvée(s) - Triées par probabilité de réussite
                    </CardDescription>
                  </CardHeader>
                </Card>

                {searchResults.map((result, idx) => (
                  <Card key={idx} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-bold rounded-full">
                              Solution {idx + 1}
                            </span>
                            <span className={`px-3 py-1 text-sm font-semibold rounded-full border ${getProbabilityColor(result.successProbability)}`}>
                              <div className="flex items-center gap-1">
                                <TrendingUp className="w-4 h-4" />
                                {result.successProbability}% - {getProbabilityLabel(result.successProbability)}
                              </div>
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p><strong>Code :</strong> {result.codeFound}</p>
                            <p><strong>Voiture :</strong> {result.modelVoiture}</p>
                            <p><strong>Symptôme :</strong> {result.sujet}</p>
                            <p className="text-xs text-gray-500">Ligne {result.rowNumber}</p>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="text-xs font-semibold text-gray-600 mb-2 uppercase">
                            Échanges effectués
                          </div>
                          <div className="text-gray-800 prose prose-sm max-w-none">
                            <Streamdown>{result.solutionQ}</Streamdown>
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="text-xs font-semibold text-gray-600 mb-2 uppercase">
                            Dernier échange garage
                          </div>
                          <div className="text-gray-800 prose prose-sm max-w-none">
                            <Streamdown>{result.solutionS}</Streamdown>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* AI Summary */}
                {aiSummary && (
                  <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-emerald-50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="w-5 h-5" />
                        Résumé Technique IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-gray-800 prose prose-sm max-w-none leading-relaxed">
                        <Streamdown>{aiSummary}</Streamdown>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Empty State */}
            {!fileLoaded && !error && (
              <Card className="border-dashed">
                <CardContent className="pt-8 pb-8 text-center">
                  <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">
                    Commencez par charger un fichier Excel pour démarrer
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Guide d'utilisation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">1. Charger le fichier</h4>
                  <p className="text-gray-600">
                    Téléchargez votre fichier Excel contenant les codes défauts et solutions.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">2. Entrer le code</h4>
                  <p className="text-gray-600">
                    Tapez le code défaut (ex: P20EE) et optionnellement le symptôme.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">3. Consulter les résultats</h4>
                  <p className="text-gray-600">
                    Les résultats sont triés par probabilité de réussite. Consultez le modèle de voiture et les solutions.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Probabilité de réussite</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>80%+ : Très probable</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>60-79% : Probable</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>40-59% : Possible</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span>&lt;40% : À explorer</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">
                    <strong>Format :</strong> Excel (.xls, .xlsx)
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">
                    <strong>Colonnes utilisées :</strong>
                  </p>
                  <ul className="text-gray-600 ml-4 mt-1 space-y-1">
                    <li>• E : Symptôme de panne</li>
                    <li>• H : Modèle de voiture</li>
                    <li>• I : Description ticket (codes défauts)</li>
                    <li>• Q : Échanges (solutions)</li>
                    <li>• S : Dernier échange garage</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
