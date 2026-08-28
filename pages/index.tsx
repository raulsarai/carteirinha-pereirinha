import {
  aplicarTimestampEmLote,
  deleteAllAlunos,
  getAlunos,
  getPhotos,
  migrarNomesParaMatricula,
  repadronizarFotosComTimestamp,
  syncAlunos,
} from "@/lib/photos";
import { toCanvas, toJpeg, toPng } from "html-to-image";
import dynamic from "next/dynamic";
import QRCode from "qrcode";
import React, { useEffect, useRef, useState } from "react";
import styled, { css } from "styled-components";
import * as XLSX from "xlsx";
import EditAlunoModal from "../components/EditAlunoModal";
import PhotoSession, { sanitizeChave } from "../components/PhotoSession";
import JSZip from "jszip";
import { uploadPhoto } from "@/lib/photos"; // Certifique-se que esta função existe na sua lib

const PdfDownloadButton = dynamic(
  () => import("../components/PdfDownloadButton"),
  {
    ssr: false,
    loading: () => (
      <span
        style={{
          display: "block",
          padding: "14px 24px",
          background: "#6c757d",
          color: "#fff",
          borderRadius: "8px",
          fontWeight: "bold",
          fontSize: "14px",
          textAlign: "center",
        }}
      >
        ⏳ Carregando gerador de PDF...
      </span>
    ),
  },
);

const NotifierManager = {
  error: (msg: string) => alert(`Erro: ${msg}`),
  success: (msg: string) => alert(`Sucesso: ${msg}`),
};

const toString = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  return String(val).trim();
};

const MOCK_STUDENT = {
  ALUNO: "",
  "RG aluno": "",
  CPF: "",
  "Data Nasc": "",
  Responsavel: "",
  "Nº Matric": "",
  Categoria: "",
};

// ─── CARD PREVIEW ─────────────────────────────────────────────────────────────

const CardPreview = React.forwardRef<
  HTMLDivElement,
  {
    student: any;
    photoUrl?: string;
    cardAno: number;
    cardValorPerda: string;
    isExporting?: boolean;
  }
>(({ student, photoUrl, cardAno, cardValorPerda, isExporting }, ref) => {
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    // 1. Unimos a Matrícula (ou CPF) com o Ano de Vigência
    const identificador = student["Nº Matric"] || student["CPF"] || "000";
    const qrData = `${identificador}/${cardAno}`;

    // 2. Geramos o QR Code com o novo dado
    QRCode.toDataURL(qrData, {
      margin: 1,
      width: 200,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    }).then(setQrUrl);
  }, [student, cardAno]); // IMPORTANTE: cardAno adicionado aqui!

  return (
    <PreviewCardContainer ref={ref} $isExporting={isExporting}>
      <HeaderArea>
        <HeaderLeft>
          <Shield src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQrIjfyECBfinxjfTrBPgWRTRGsBitqvYWY3A&s" />
          <TitleGroup>
            <SmallTitle>Grêmio Recreativo</SmallTitle>
            <MainTitle>PROJETO PEREIRINHA</MainTitle>
          </TitleGroup>
        </HeaderLeft>
        {qrUrl && <PreviewQrCode src={qrUrl} />}
      </HeaderArea>

      <Content>
        {photoUrl ? (
          <PhotoBoxImg src={photoUrl} alt="Foto do atleta" />
        ) : (
          <PhotoBox />
        )}
        <Fields>
          <Field>
            {!isExporting && <Label>Nome:</Label>}
            <Value
              style={{
                marginLeft: isExporting ? "0" : "5px",
                fontSize: isExporting ? "8px" : "10px", // Redução de 2px na exportação
              }}
            >
              {student["ALUNO"]}
            </Value>
          </Field>
          <Row>
            <Field style={{ flex: 1 }}>
              <Label>RG:</Label>
              <Value>{student["RG aluno"] || "—"}</Value>
            </Field>
            <Field style={{ flex: 1 }}>
              <Label>CPF:</Label>
              <Value>{student["CPF"] || "—"}</Value>
            </Field>
          </Row>
          <Row>
            <Field style={{ flex: 1 }}>
              <Label>Nasc:</Label>
              <Value>{student["Data Nasc"] || "—"}</Value>
            </Field>
            <Field style={{ flex: 1 }}>
              <Label>Mat:</Label>
              <Value>{student["Nº Matric"] || "—"}</Value>
            </Field>
          </Row>
          <Row>
            <Field style={{ flex: 1 }}>
              <Label>Cat:</Label>
              <Value>{student["Categoria"] || "—"}</Value>
            </Field>
          </Row>
          <Row>
            <Field style={{ flex: 1 }}>
              <Label>Resp:</Label>
              <Value>{student["Responsavel"] || "—"}</Value>
            </Field>
          </Row>
        </Fields>
      </Content>

      <PreviewFooter>
        VALIDADE: {cardAno} — EM CASO DE PERDA: R$ {cardValorPerda}
      </PreviewFooter>
    </PreviewCardContainer>
  );
});

CardPreview.displayName = "CardPreview";

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function CarteirinhaGenerator() {
  const [data, setData] = useState<any[]>([]);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [sessionPhotos, setSessionPhotos] = useState<Record<string, string>>(
    {},
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPhotoSession, setShowPhotoSession] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingAluno, setEditingAluno] = useState<{
    student: any;
    id: string;
  } | null>(null);
  const [searchAlunos, setSearchAlunos] = useState("");
  const [selectedAlunos, setSelectedAlunos] = useState<string[]>([]);

  const [sortBy, setSortBy] = useState<"nome" | "matricula">("nome");

  const [searchPreview, setSearchPreview] = useState("");
  const [previewStudent, setPreviewStudent] = useState<any | null>(null);
  const [showPreviewDropdown, setShowPreviewDropdown] = useState(false);
  const [downloadingJpg, setDownloadingJpg] = useState(false);

  const previewCardRef = useRef<HTMLDivElement>(null);

  const [cardAno, setCardAno] = useState<number>(new Date().getFullYear());
  const [cardValorPerda, setCardValorPerda] = useState("50,00");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const [isExporting, setIsExporting] = useState(false);
  const [exportingBatch, setExportingBatch] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const getAlunoSelectionKey = (student: any) =>
    sanitizeChave(
      student?.["Nº Matric"] || student?.["CPF"] || student?.id || "",
    );

  const toggleAlunoSelection = (student: any) => {
    const key = getAlunoSelectionKey(student);
    if (!key) return;

    setSelectedAlunos((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const clearAlunoSelection = () => setSelectedAlunos([]);

  const selectedStudentsData = data.filter((student) =>
    selectedAlunos.includes(getAlunoSelectionKey(student)),
  );

  const pdfData = selectedStudentsData.length > 0 ? selectedStudentsData : data;

  const handleExportZipGrafica = async () => {
    if (data.length === 0 || !previewCardRef.current) return;

    const confirmado = confirm(
      `Gerar imagens para gráfica (${data.length} alunos) com 10% de sangria?`,
    );
    if (!confirmado) return;

    setExportingBatch(true);
    setIsExporting(true); // Ativa modo de exportação para mudar o layout do card

    const zip = new JSZip();
    const folder = zip.folder(`LOTE_GRAFICA_${cardAno}`);

    try {
      for (let i = 0; i < data.length; i++) {
        const student = data[i];
        if (!student) continue;

        setExportProgress(Math.round(((i + 1) / data.length) * 100));

        // 1. Atualiza o preview e aguarda renderização (QR Code e Foto)
        setPreviewStudent(student);
        await new Promise((res) => setTimeout(res, 400));

        // 2. Captura o card que está na tela como Canvas
        const cardCanvas = await toCanvas(previewCardRef.current, {
          pixelRatio: 3,
        });

        // 3. Criamos o Canvas Final (SANGRE) com 10% de aumento
        const finalCanvas = document.createElement("canvas");
        finalCanvas.width = cardCanvas.width * 1.1;
        finalCanvas.height = cardCanvas.height * 1.1;

        const ctx = finalCanvas.getContext("2d")!;

        // 4. Desenha o fundo (Sangria) manualmente para garantir integridade
        const gradient = ctx.createLinearGradient(
          0,
          0,
          finalCanvas.width,
          finalCanvas.height,
        );
        gradient.addColorStop(0, "#000000");
        gradient.addColorStop(0.55, "#919191");
        gradient.addColorStop(1, "#000000");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

        // 5. Centraliza o card capturado dentro da área maior
        const x = (finalCanvas.width - cardCanvas.width) / 2;
        const y = (finalCanvas.height - cardCanvas.height) / 2;
        ctx.drawImage(cardCanvas, x, y);

        // 6. Rotação Paisagem (Landscape) para o formato da gráfica
        const landscape = document.createElement("canvas");
        landscape.width = finalCanvas.height;
        landscape.height = finalCanvas.width;
        const lCtx = landscape.getContext("2d")!;

        lCtx.translate(landscape.width / 2, landscape.height / 2);
        lCtx.rotate((90 * Math.PI) / 180);
        lCtx.drawImage(
          finalCanvas,
          -finalCanvas.width / 2,
          -finalCanvas.height / 2,
        );

        // 7. Salva no ZIP como JPG de alta qualidade
        const imgData = landscape.toDataURL("image/jpeg", 0.98).split(",")[1];
        const nomeLimpo = (student["ALUNO"] || `aluno_${i}`)
          .trim()
          .replace(/[/\\?%*:|"<Point>]/g, "-");
        folder?.file(`${nomeLimpo}.jpg`, imgData, { base64: true });
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `LOTE_GRAFICA_PEREIRINHA_${cardAno}.zip`;
      link.click();

      NotifierManager.success("Lote gerado com sucesso!");
    } catch (err) {
      console.error("Erro no lote:", err);
      NotifierManager.error("Erro ao gerar arquivos.");
    } finally {
      setExportingBatch(false);
      setIsExporting(false);
      setPreviewStudent(null);
    }
  };

  useEffect(() => {
    const savedData = localStorage.getItem("pereirinha_data");
    const savedQrCodes = localStorage.getItem("pereirinha_qrcodes");
    const savedPhotos = localStorage.getItem("pereirinha_photos");
    const savedAno = localStorage.getItem("card_ano");
    const savedValor = localStorage.getItem("card_valor");

    if (savedData) setData(JSON.parse(savedData));
    if (savedQrCodes) setQrCodes(JSON.parse(savedQrCodes));
    if (savedPhotos) setSessionPhotos(JSON.parse(savedPhotos));
    if (savedAno) setCardAno(Number(savedAno));
    if (savedValor) setCardValorPerda(savedValor);
  }, []);

  // Dentro do CarteirinhaGenerator
  useEffect(() => {
    if (data.length > 0) {
      const atualizarLoteQRCodes = async () => {
        const novoQrMap: Record<string, string> = {};
        for (const student of data) {
          const chave = sanitizeChave(student["Nº Matric"] || student["CPF"]);
          const id = student["Nº Matric"] || student["CPF"] || "sem-id";
          const qrData = `${id}/${cardAno}`;
          novoQrMap[chave] = await QRCode.toDataURL(qrData);
        }
        setQrCodes(novoQrMap);
        localStorage.setItem("pereirinha_qrcodes", JSON.stringify(novoQrMap));
      };

      atualizarLoteQRCodes();
    }
  }, [cardAno]); // Sempre que o ano mudar, regera todos os QRs do lote

  useEffect(() => {
    // Filtra o array para garantir que não existam itens nulos antes de processar
    const validData = data.filter((s) => s !== null && s !== undefined);
    if (validData.length === 0) return;

    const syncFotos = async () => {
      const alunosRef = validData.map((s: any) => ({
        matricula: s["Nº Matric"] || null,
        cpf: s["CPF"] || null,
      }));
      const fotos = await getPhotos(alunosRef);
      setSessionPhotos(fotos);
      localStorage.setItem("pereirinha_photos", JSON.stringify(fotos));
    };
    syncFotos();
  }, [data]);

  const previewResults = data
    .filter((s) => {
      const term = searchPreview.toLowerCase().trim();
      if (!term || term.length < 2) return false;
      const nome = String(s["ALUNO"] || "").toLowerCase();
      const matricula = String(s["Nº Matric"] || "").toLowerCase();
      const cpf = String(s["CPF"] || "").toLowerCase();
      return (
        nome.includes(term) || matricula.includes(term) || cpf.includes(term)
      );
    })
    .slice(0, 6);

  const filteredAlunos = data
    .filter((s) => {
      if (!s) return false;

      const term = searchAlunos.toLowerCase().trim();
      if (!term) return true;

      const nome = String(s["ALUNO"] || "").toLowerCase();
      const matricula = String(s["Nº Matric"] || "").toLowerCase();
      const cpf = String(s["CPF"] || "").toLowerCase();

      return (
        nome.includes(term) || matricula.includes(term) || cpf.includes(term)
      );
    })
    .sort((a, b) => {
      if (sortBy === "matricula") {
        const matA = String(a?.["Nº Matric"] || "").trim();
        const matB = String(b?.["Nº Matric"] || "").trim();

        if (!matA && matB) return 1;
        if (matA && !matB) return -1;

        return matA.localeCompare(matB, "pt-BR", { numeric: true });
      }

      const nomeA = String(a?.["ALUNO"] || "").toLowerCase();
      const nomeB = String(b?.["ALUNO"] || "").toLowerCase();

      return nomeA.localeCompare(nomeB, "pt-BR");
    });

  const previewPhotoUrl = previewStudent
    ? sessionPhotos[
        sanitizeChave(previewStudent["Nº Matric"] || previewStudent["CPF"])
      ]
    : undefined;

  // ─── DOWNLOAD JPG LANDSCAPE ───────────────────────────────────────────────

  const normalizeMatricula = (val: unknown): string =>
    String(val ?? "")
      .trim()
      .replace(/\//g, "-")
      .replace(/\s+/g, "")
      .toUpperCase();

  const normalizeCpf = (val: unknown): string =>
    String(val ?? "").replace(/\D/g, "");

  const handleAddManual = () => {
    // Criamos um objeto vazio seguindo a estrutura da sua planilha
    const novoAluno = {
      ALUNO: "Novo Aluno",
      "RG aluno": "",
      CPF: "",
      "Data Nasc": "",
      Responsavel: "",
      "Nº Matric": "",
      Categoria: "",
    };

    // Abrimos o modal passando um ID nulo ou flag de 'novo'
    setEditingAluno({ student: novoAluno, id: "" });
  };

  const handleRefreshFromDB = async () => {
    setIsRefreshing(true);
    try {
      const alunosDB = await getAlunos();

      if (alunosDB.length === 0) {
        NotifierManager.error("Nenhum aluno encontrado no banco de dados.");
        return;
      }

      const alunoIds: Record<string, string> = {};
      for (const aluno of alunosDB) {
        const id = aluno.id;
        if (!id) continue;

        const matriculaKey = normalizeMatricula(aluno["Nº Matric"]);
        const cpfKey = normalizeCpf(aluno["CPF"]);

        if (matriculaKey) alunoIds[matriculaKey] = id;
        if (cpfKey) alunoIds[cpfKey] = id;
      }

      const alunosRef = alunosDB.map((s: any) => ({
        matricula: s["Nº Matric"] || null,
        cpf: s["CPF"] || null,
      }));
      const fotosAtualizadas = await getPhotos(alunosRef);

      const qrMap: Record<string, string> = {};
      for (const student of alunosDB) {
        const chave = sanitizeChave(student["Nº Matric"] || student["CPF"]);
        const qrInput =
          student["Nº Matric"] ||
          student["CPF"] ||
          student["ALUNO"] ||
          chave ||
          "sem-id";

        if (!qrInput || String(qrInput).trim() === "") continue;

        qrMap[chave] = await QRCode.toDataURL(String(qrInput));
      }

      localStorage.setItem("pereirinha_data", JSON.stringify(alunosDB));
      localStorage.setItem("pereirinha_qrcodes", JSON.stringify(qrMap));
      localStorage.setItem(
        "pereirinha_photos",
        JSON.stringify(fotosAtualizadas),
      );
      localStorage.setItem("alunoIds", JSON.stringify(alunoIds));

      setData(alunosDB);
      setQrCodes(qrMap);
      setSessionPhotos(fotosAtualizadas);

      const totalFotos = Object.keys(fotosAtualizadas).length;
      NotifierManager.success(
        `${alunosDB.length} alunos carregados do banco · ${totalFotos} foto(s).`,
      );
    } catch (err) {
      console.error("Erro ao buscar do banco:", err);
      NotifierManager.error("Falha ao buscar dados do banco.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteAll = async () => {
    const confirmado = confirm(
      "⚠️ ATENÇÃO: Isso vai apagar TODOS os alunos e fotos do banco permanentemente.\n\nTem certeza absoluta?",
    );
    if (!confirmado) return;

    const confirmado2 = confirm(
      "🔴 Segunda confirmação: essa ação NÃO pode ser desfeita. Confirmar exclusão total?",
    );
    if (!confirmado2) return;

    setIsDeletingAll(true);
    try {
      await deleteAllAlunos();

      // Limpa cache local também
      localStorage.removeItem("pereirinha_data");
      localStorage.removeItem("pereirinha_qrcodes");
      localStorage.removeItem("pereirinha_photos");
      localStorage.removeItem("alunoIds");

      setData([]);
      setQrCodes({});
      setSessionPhotos({});
      setPreviewStudent(null);
      setSearchPreview("");

      NotifierManager.success(
        "Todos os dados foram apagados do banco e do cache local.",
      );
    } catch (err) {
      console.error("Erro ao deletar dados:", err);
      NotifierManager.error("Falha ao apagar os dados do banco.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleDownloadPng = async () => {
    // Mudamos para PNG para evitar o fundo preto nos cantos
    if (!previewCardRef.current || !previewStudent) return;

    setDownloadingJpg(true);

    // 1. Ativa o modo de exportação (remove a sombra)
    setIsExporting(true);
    setDownloadingJpg(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));

      const dataUrl = await toPng(previewCardRef.current, {
        // Alterado para toPng
        quality: 1,
        pixelRatio: 3,
        // Não definir backgroundColor aqui permite que os cantos fiquem transparentes
      });

      const img = new Image();
      img.src = dataUrl;
      await new Promise((res) => (img.onload = res));

      const landscape = document.createElement("canvas");
      // Invertemos largura e altura para a rotação
      landscape.width = img.height;
      landscape.height = img.width;

      const ctx = landscape.getContext("2d")!;

      // Garante que o canvas comece totalmente transparente
      ctx.clearRect(0, 0, landscape.width, landscape.height);

      ctx.save();
      ctx.translate(landscape.width / 2, landscape.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      // Desenha a imagem centralizada
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      const link = document.createElement("a");
      link.download = `carteirinha_${previewStudent["ALUNO"] || "aluno"}.png`;
      link.href = landscape.toDataURL("image/png"); // Exporta como PNG
      link.click();
    } catch (err) {
      console.error("Erro ao gerar imagem:", err);
    } finally {
      // 2. Volta a sombra para a tela do usuário
      setIsExporting(false);
      setDownloadingJpg(false);
    }
  };

  // ─── UPLOAD PLANILHA ──────────────────────────────────────────────────────

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawJson.length === 0) throw new Error("O arquivo está vazio.");

        const json = rawJson.map((student) => {
          let dataNasc = student["Data Nasc"];
          if (typeof dataNasc === "number") {
            const date = new Date(
              Math.round((dataNasc - 25569) * 86400 * 1000),
            );
            dataNasc = date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
          }
          return { ...student, "Data Nasc": dataNasc };
        });

        setIsSyncing(true);
        const alunoIds = await syncAlunos(json);
        console.log("📌 retorno syncAlunos:", alunoIds);
        localStorage.setItem("alunoIds", JSON.stringify(alunoIds));
        console.log(
          "📌 lido do localStorage:",
          JSON.parse(localStorage.getItem("alunoIds") || "{}"),
        );

        const qrMap: Record<string, string> = {};
        for (const student of json) {
          const chave = sanitizeChave(
            toString(student["Nº Matric"]) || toString(student["CPF"]),
          );
          const qrInput =
            toString(student["Nº Matric"]) ||
            toString(student["CPF"]) ||
            toString(student["ALUNO"]) ||
            chave ||
            "sem-id";

          if (!qrInput || qrInput.trim() === "") continue;

          qrMap[chave] = await QRCode.toDataURL(qrInput);
        }

        const alunosRef = json.map((s: any) => ({
          matricula: s["Nº Matric"] || null,
          cpf: s["CPF"] || null,
        }));
        const fotosExistentes = await getPhotos(alunosRef);

        localStorage.setItem("pereirinha_data", JSON.stringify(json));
        localStorage.setItem("pereirinha_qrcodes", JSON.stringify(qrMap));
        localStorage.setItem(
          "pereirinha_photos",
          JSON.stringify(fotosExistentes),
        );

        setData(json);
        setQrCodes(qrMap);
        setSessionPhotos(fotosExistentes);
        NotifierManager.success(
          `${json.length} alunos importados com sucesso!`,
        );
      } catch (err) {
        console.error("❌ ERRO:", err);
        NotifierManager.error("Falha ao processar o arquivo Excel.");
      } finally {
        setIsProcessing(false);
        setIsSyncing(false);
      }
    };

    reader.onerror = () => {
      NotifierManager.error("Erro na leitura do arquivo.");
      setIsProcessing(false);
    };

    reader.readAsBinaryString(file);
  };

  const handleClearData = () => {
    if (
      !confirm(
        "Limpar todos os dados em cache? Será necessário reimportar a planilha.",
      )
    )
      return;
    localStorage.removeItem("pereirinha_data");
    localStorage.removeItem("pereirinha_qrcodes");
    localStorage.removeItem("pereirinha_photos");
    localStorage.removeItem("alunoIds");
    setData([]);
    setQrCodes({});
    setSessionPhotos({});
    setPreviewStudent(null);
    setSearchPreview("");
  };

  // Adicione no topo do arquivo

  const handleBatchWithImages = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allFiles = Array.from(files);
    const excelFile = allFiles.find(
      (f) =>
        f.name.endsWith(".xlsx") ||
        f.name.endsWith(".xls") ||
        f.name.endsWith(".csv"),
    );
    const imageFiles = allFiles.filter((f) => f.type.startsWith("image/"));

    if (!excelFile) {
      NotifierManager.error("Selecione a planilha Excel junto com as fotos.");
      return;
    }

    setIsProcessing(true);
    setIsSyncing(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawJson.length === 0) throw new Error("Planilha vazia.");

        // 1. Sincroniza e CAPTURA o mapa de IDs retornado
        const alunoIdsMap = await syncAlunos(rawJson);

        let fotosVinculadas = 0;

        // 2. Vincula as imagens baseadas na Matrícula
        for (const student of rawJson) {
          const matricula = String(student["Nº Matric"] || "").trim();
          if (!matricula) continue;

          const fotoCorrespondente = imageFiles.find((f) => {
            const nomeArquivo = f.name.split(".").slice(0, -1).join(".");
            return nomeArquivo === matricula;
          });

          if (fotoCorrespondente) {
            const cpf = student["CPF"] || null;

            // Normaliza a chave para buscar no mapa
            const matKey = normalizeMatricula(matricula);
            const alunoId = alunoIdsMap[matKey]; // Usa a variável capturada acima

            if (alunoId) {
              // Ordem correta dos parâmetros conforme photos.ts
              // chave, blob, alunoId, cpf
              await uploadPhoto(
                matricula,
                fotoCorrespondente,
                alunoId,
                cpf || undefined,
              );
              fotosVinculadas++;
            }
          }
        }

        await handleRefreshFromDB();
        NotifierManager.success(
          `Sucesso: ${rawJson.length} alunos processados e ${fotosVinculadas} fotos vinculadas.`,
        );
      } catch (err: any) {
        console.error("Erro no processamento em lote:", err);
        NotifierManager.error("Falha ao processar lote: " + err.message);
      } finally {
        setIsProcessing(false);
        setIsSyncing(false);
        e.target.value = "";
      }
    };

    reader.readAsBinaryString(excelFile);
  };

  const handleExportPlanilha = () => {
    if (data.length === 0) {
      NotifierManager.error("Não há dados para exportar.");
      return;
    }

    // Prepara os dados removendo campos internos como 'id' se desejar uma planilha limpa
    const dadosParaExportar = data.map(({ id, ...resto }) => resto);

    const worksheet = XLSX.utils.json_to_sheet(dadosParaExportar);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alunos");

    // Gera o arquivo e dispara o download
    XLSX.writeFile(
      workbook,
      `base_alunos_pereirinha_${new Date().getFullYear()}.xlsx`,
    );
    NotifierManager.success("Planilha exportada com sucesso!");
  };

  const handleBatchUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

        if (rawJson.length === 0) throw new Error("O arquivo está vazio.");

        setIsSyncing(true);

        // Utiliza sua função de sincronização existente que lida com o banco de dados
        const alunoIds = await syncAlunos(rawJson);
        localStorage.setItem("alunoIds", JSON.stringify(alunoIds));

        // Atualiza a tela com os novos dados vindos da planilha
        setData(rawJson);
        localStorage.setItem("pereirinha_data", JSON.stringify(rawJson));

        NotifierManager.success(
          `Lote processado! ${rawJson.length} registros atualizados no banco.`,
        );
      } catch (err) {
        console.error("❌ Erro no lote:", err);
        NotifierManager.error("Falha ao atualizar dados em lote.");
      } finally {
        setIsProcessing(false);
        setIsSyncing(false);
        // Limpa o input para permitir subir o mesmo arquivo se necessário
        e.target.value = "";
      }
    };

    reader.readAsBinaryString(file);
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <Container>
      <Title>Gerador de Carteirinhas - Projeto Pereirinha</Title>

      {/* PRÉ-VISUALIZAÇÃO */}
      <section style={{ marginBottom: "32px" }}>
        <SectionTitle>Pré-visualização</SectionTitle>

        <PreviewWrapper>
          <CardPreview
            ref={previewCardRef}
            student={previewStudent ?? MOCK_STUDENT}
            photoUrl={previewPhotoUrl}
            cardAno={cardAno}
            cardValorPerda={cardValorPerda}
            isExporting={isExporting}
          />
        </PreviewWrapper>

        {/* SEARCH PREVIEW */}
        {data.length > 0 && (
          <PreviewSearchArea>
            <PreviewSearchWrapper>
              <SearchIcon>🔍</SearchIcon>
              <SearchInput
                type="text"
                placeholder="Buscar atleta para visualizar a carteirinha..."
                value={searchPreview}
                onChange={(e) => {
                  setSearchPreview(e.target.value);
                  setShowPreviewDropdown(true);
                  if (!e.target.value) setPreviewStudent(null);
                }}
                onFocus={() => setShowPreviewDropdown(true)}
                onBlur={() =>
                  setTimeout(() => setShowPreviewDropdown(false), 150)
                }
              />
              {searchPreview && (
                <ClearSearch
                  onClick={() => {
                    setSearchPreview("");
                    setPreviewStudent(null);
                    setShowPreviewDropdown(false);
                  }}
                >
                  ✕
                </ClearSearch>
              )}

              {showPreviewDropdown && previewResults.length > 0 && (
                <PreviewDropdown>
                  {previewResults.map((s, i) => {
                    const chave = sanitizeChave(s["Nº Matric"] || s["CPF"]);
                    const temFoto = !!sessionPhotos[chave];
                    return (
                      <PreviewDropdownItem
                        key={i}
                        onMouseDown={() => {
                          setPreviewStudent(s);
                          setSearchPreview(s["ALUNO"]);
                          setShowPreviewDropdown(false);
                        }}
                      >
                        <DropdownName>{s["ALUNO"]}</DropdownName>
                        <DropdownMeta>
                          {s["Nº Matric"]
                            ? `Mat: ${s["Nº Matric"]}`
                            : `CPF: ${s["CPF"] || "—"}`}
                          {" · "}
                          <span style={{ color: temFoto ? "#28a745" : "#aaa" }}>
                            {temFoto ? "✅ foto" : "⬜ sem foto"}
                          </span>
                        </DropdownMeta>
                      </PreviewDropdownItem>
                    );
                  })}
                </PreviewDropdown>
              )}
            </PreviewSearchWrapper>

            {previewStudent && (
              <PreviewLabelArea>
                <PreviewLabel>
                  Visualizando: <strong>{previewStudent["ALUNO"]}</strong>
                  {previewPhotoUrl ? " · ✅ com foto" : " · ⬜ sem foto"}
                </PreviewLabel>
                <ActionButtons>
                  <DownloadJpgBtn
                    onClick={handleDownloadPng}
                    disabled={downloadingJpg}
                  >
                    {downloadingJpg ? "⏳ Gerando..." : "💾 Baixar como JPG"}
                  </DownloadJpgBtn>
                  <ResetPreview
                    onClick={() => {
                      setPreviewStudent(null);
                      setSearchPreview("");
                    }}
                  >
                    ✕ Layout padrão
                  </ResetPreview>
                </ActionButtons>
              </PreviewLabelArea>
            )}
          </PreviewSearchArea>
        )}
      </section>

      {/* CONFIGURAÇÕES */}
      <ConfigPanel>
        <ConfigTitle>⚙️ Configurações da Carteirinha</ConfigTitle>
        <ConfigRow>
          <ConfigField>
            <label>Ano de Vigência</label>
            <ConfigInput
              type="number"
              value={cardAno}
              onChange={(e) => {
                setCardAno(Number(e.target.value));
                localStorage.setItem("card_ano", e.target.value);
              }}
            />
          </ConfigField>
          <ConfigField>
            <label>Valor em caso de perda (R$)</label>
            <ConfigInput
              value={cardValorPerda}
              onChange={(e) => {
                setCardValorPerda(e.target.value);
                localStorage.setItem("card_valor", e.target.value);
              }}
              placeholder="50,00"
            />
          </ConfigField>
        </ConfigRow>
        {/* <div style={{ marginTop: "10px" }}>
          <button
            onClick={() => {
              if (
                confirm(
                  "Deseja padronizar todos os nomes de arquivos do Storage pela Matrícula?",
                )
              ) {
                // aplicarTimestampEmLote();
                // migrarNomesParaMatricula()
                repadronizarFotosComTimestamp()
              }
            }}
            style={{
              padding: "8px 16px",
              background: "#e74c3c",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            ⚠️ Padronizar Nomes das Fotos Antigas
          </button>
          <p style={{ fontSize: "10px", color: "#888", marginTop: "5px" }}>
            Use isso apenas uma vez para renomear fotos que não seguem o padrão
            "000-000.jpg".
          </p>
        </div> */}
        <ConfigField />
      </ConfigPanel>

      {/* UPLOAD / AÇÕES */}
      <UploadBox>
        {data.length > 0 && (
          <CacheBar>
            <CacheInfo>
              <strong>✅ {data.length} alunos</strong>
              <span>dados carregados no sistema</span>
            </CacheInfo>

            <CacheActions>
              <ClearButton onClick={handleClearData}>
                🗑 Limpar cache local
              </ClearButton>

              <DeleteAllButton
                onClick={handleDeleteAll}
                disabled={isDeletingAll}
              >
                {isDeletingAll ? "⏳ Apagando..." : "☠️ Apagar tudo do banco"}
              </DeleteAllButton>
            </CacheActions>
          </CacheBar>
        )}

        <ActionSection>
          <SectionLabel>Ações principais</SectionLabel>

          <PrimaryGrid>
            <ActionCardButton onClick={handleExportPlanilha} $variant="neutral">
              <ActionTitle>📊 Exportar Planilha Atual</ActionTitle>
              <ActionDescription>
                Baixa os dados atuais exibidos na tela.
              </ActionDescription>
            </ActionCardButton>

            <ActionCardLabel $variant="warning">
              <ActionTitle>📥 Atualizar em Lote</ActionTitle>
              <ActionDescription>
                Envie uma planilha Excel para atualizar registros.
              </ActionDescription>
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleBatchUpdate}
                hidden
              />
            </ActionCardLabel>

            <ActionCardLabel $variant="purple">
              <ActionTitle>🚀 Upload Completo</ActionTitle>
              <ActionDescription>
                Envie Excel e fotos juntos para processamento completo.
              </ActionDescription>
              <input
                type="file"
                multiple
                onChange={handleBatchWithImages}
                hidden
              />
            </ActionCardLabel>

            <ActionCardButton onClick={handleAddManual} $variant="success">
              <ActionTitle>➕ Cadastrar Aluno</ActionTitle>
              <ActionDescription>
                Adicione um aluno manualmente sem importar planilha.
              </ActionDescription>
            </ActionCardButton>
          </PrimaryGrid>

          {data.length === 0 && (
            <>
              <SectionLabel style={{ marginTop: 18 }}>
                Primeira carga
              </SectionLabel>

              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                id="file-upload"
                hidden
                disabled={isProcessing}
              />
              <ImportCard htmlFor="file-upload" data-disabled={isProcessing}>
                <ActionTitle>
                  {isProcessing
                    ? "⏳ Processando Arquivo..."
                    : "📂 Importar Planilha (Excel/CSV)"}
                </ActionTitle>
                <ActionDescription>
                  Use esta opção quando ainda não houver dados carregados.
                </ActionDescription>
              </ImportCard>
            </>
          )}
        </ActionSection>

        <SecondarySection>
          <SectionLabel>Operações</SectionLabel>

          <SecondaryGrid>
            <RefreshButton
              onClick={handleRefreshFromDB}
              disabled={isRefreshing}
            >
              {isRefreshing ? "⏳ Atualizando..." : "🔄 Atualizar Dados"}
            </RefreshButton>

            {data.length > 0 && (
              <>
                <PhotoButton onClick={() => setShowPhotoSession(true)}>
                  📷 Iniciar Sessão de Fotos ({data.length} alunos)
                  {Object.keys(sessionPhotos).length > 0 && (
                    <PhotoBadge>
                      {Object.keys(sessionPhotos).length} foto(s)
                    </PhotoBadge>
                  )}
                </PhotoButton>

                <PdfDownloadButton
                  data={pdfData}
                  qrCodes={qrCodes}
                  sessionPhotos={sessionPhotos}
                  cardAno={cardAno}
                  cardValorPerda={cardValorPerda}
                />
              </>
            )}
          </SecondaryGrid>
        </SecondarySection>

        {isSyncing && (
          <SyncStatus>⏳ Sincronizando alunos com o banco...</SyncStatus>
        )}
      </UploadBox>

      {/* LISTA DE ALUNOS */}
      {data.length > 0 && (
        <AlunosSection>
          <SectionTitle>👥 Alunos Cadastrados</SectionTitle>

          <SearchWrapper>
            <SearchIcon>🔍</SearchIcon>
            <SearchInput
              type="text"
              placeholder="Buscar por nome, matrícula ou CPF..."
              value={searchAlunos}
              onChange={(e) => setSearchAlunos(e.target.value)}
            />
            {searchAlunos && (
              <ClearSearch onClick={() => setSearchAlunos("")}>✕</ClearSearch>
            )}
          </SearchWrapper>

          {searchAlunos && (
            <SearchCount>
              {filteredAlunos.length} resultado(s) para "{searchAlunos}"
            </SearchCount>
          )}
          <SortBar>
            <span>Ordenar por:</span>
            <SortButton
              $active={sortBy === "nome"}
              onClick={() => setSortBy("nome")}
              type="button"
            >
              🔤 Nome
            </SortButton>
            <SortButton
              $active={sortBy === "matricula"}
              onClick={() => setSortBy("matricula")}
              type="button"
            >
              🔢 Matrícula
            </SortButton>
          </SortBar>

          <SelectionBar>
            <span>
              {selectedStudentsData.length > 0
                ? `${selectedStudentsData.length} selecionado(s) para o PDF`
                : "Nenhum aluno selecionado — PDF sairá completo"}
            </span>

            <SelectionActions>
              <SmallActionButton type="button" onClick={clearAlunoSelection}>
                Limpar seleção
              </SmallActionButton>
            </SelectionActions>
          </SelectionBar>

          <AlunosList>
            {filteredAlunos.map((student, i) => {
              if (!student) return null;

              const alunoIds = JSON.parse(
                localStorage.getItem("alunoIds") || "{}",
              );

              const matricula = student?.["Nº Matric"] || "";
              const cpf = student?.["CPF"] || "";
              const nome = student?.["ALUNO"] || "Sem Nome";
              const categoria = student?.["Categoria"] || "—";

              const chave = sanitizeChave(matricula || cpf);
              const alunoId = student?.id || alunoIds[chave] || "";
              const fotoUrl = sessionPhotos[chave];
              const temFoto = !!fotoUrl;

              const selectionKey = getAlunoSelectionKey(student);
              const isSelected = selectedAlunos.includes(selectionKey);

              return (
                <AlunoRow key={`${chave}-${i}`}>
                  <AlunoLeft>
                    <AlunoCheckbox
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAlunoSelection(student)}
                    />

                    <AlunoContent>
                      <AlunoAvatar src={fotoUrl} />

                      <AlunoInfo>
                        <AlunoNome>{nome}</AlunoNome>
                        <AlunoSub>
                          {matricula
                            ? `Mat: ${matricula}`
                            : cpf
                            ? `CPF: ${cpf}`
                            : "Sem doc"}
                          {" · "}
                          {categoria}
                          {" · "}
                          <span
                            style={{
                              color: temFoto ? "#28a745" : "#dc3545",
                              fontWeight: temFoto ? "bold" : "normal",
                            }}
                          >
                            {temFoto ? "✅ Com Foto" : "❌ Sem Foto"}
                          </span>
                        </AlunoSub>
                      </AlunoInfo>
                    </AlunoContent>
                  </AlunoLeft>

                  <EditBtn
                    onClick={() => {
                      const studentComFoto = {
                        ...student,
                        id: alunoId,
                        photoUrl: fotoUrl || null,
                      };

                      setEditingAluno({
                        student: studentComFoto,
                        id: alunoId,
                      });
                    }}
                    title="Editar ou Excluir aluno"
                  >
                    ✏️
                  </EditBtn>
                </AlunoRow>
              );
            })}
          </AlunosList>
        </AlunosSection>
      )}

      {/* MODAL DE EDIÇÃO */}
      {editingAluno && (
        <EditAlunoModal
          aluno={editingAluno.student}
          alunoId={editingAluno.id}
          onClose={() => setEditingAluno(null)}
          onSave={(updated) => {
            if (!updated) {
              setData((prev) =>
                prev.filter((s) => s && s.id !== editingAluno?.id),
              );
            } else {
              if (!editingAluno?.id) {
                if (updated?.id) {
                  const alunoIds = JSON.parse(
                    localStorage.getItem("alunoIds") || "{}",
                  );
                  const matKey = normalizeMatricula(updated["Nº Matric"]);
                  const cpfKey = normalizeCpf(updated["CPF"]);

                  if (matKey) alunoIds[matKey] = updated.id;
                  if (cpfKey) alunoIds[cpfKey] = updated.id;

                  localStorage.setItem("alunoIds", JSON.stringify(alunoIds));
                }

                setData((prev) => [updated, ...prev]);
              } else {
                setData((prev) =>
                  prev.map((s) =>
                    s && s.id === editingAluno.id ? updated : s,
                  ),
                );
              }
            }

            setEditingAluno(null);
          }}
        />
      )}

      {/* SESSÃO DE FOTOS */}
      {showPhotoSession && (
        <PhotoSession
          students={data}
          initialPhotos={sessionPhotos}
          onComplete={(photos) => {
            setSessionPhotos(photos);
            localStorage.setItem("pereirinha_photos", JSON.stringify(photos));
            setShowPhotoSession(false);
          }}
          onClose={() => setShowPhotoSession(false)}
        />
      )}
    </Container>
  );
}

// ─── STYLED COMPONENTS ────────────────────────────────────────────────────────

const SortBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 12px;
  color: #666;
  flex-wrap: wrap;
`;

const SortButton = styled.button<{ $active?: boolean }>`
  padding: 6px 10px;
  border: 1px solid ${(p) => (p.$active ? "#0070f3" : "#d0d7e2")};
  border-radius: 8px;
  background: ${(p) => (p.$active ? "#0070f3" : "#fff")};
  color: ${(p) => (p.$active ? "#fff" : "#333")};
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  &:hover {
    opacity: 0.9;
  }
`;

const AlunoLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
`;

const AlunoCheckbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #0070f3;
  flex-shrink: 0;
`;

const SelectionBar = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
  padding: 10px 12px;
  background: #f8f9fb;
  border: 1px solid #e7eaf0;
  border-radius: 10px;
  font-size: 13px;
  color: #555;
  flex-wrap: wrap;
`;

const SelectionActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-start;
`;

const SmallActionButton = styled.button`
  padding: 6px 10px;
  border: 1px solid #d0d7e2;
  border-radius: 8px;
  background: #fff;
  color: #333;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #f1f4f8;
  }
`;

const AlunoAvatar = styled.div<{ src?: string }>`
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background-color: #f0f0f0;
  background-image: ${(props) => (props.src ? `url(${props.src})` : "none")};
  background-size: cover;
  background-position: center;
  border: 2px solid ${(props) => (props.src ? "#28a745" : "#ddd")};
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #ccc;
  overflow: hidden;

  &::after {
    content: "${(props) => (props.src ? "" : "👤")}";
  }
`;

const AlunoContent = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
`;

const UploadBox = styled.div`
  background: #fff;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  margin-bottom: 20px;
`;

const CacheBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  background: #f0fff4;
  border: 1px solid #7acb8a;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 20px;
`;

const CacheInfo = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  color: #1f5f2f;

  strong {
    font-size: 15px;
  }

  span {
    font-size: 12px;
    color: #4e7b59;
  }
`;

const CacheActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const SectionLabel = styled.div`
  font-size: 13px;
  font-weight: 800;
  color: #555;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

const ActionSection = styled.div`
  margin-bottom: 18px;
`;

const SecondarySection = styled.div`
  margin-top: 6px;
`;

const PrimaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`;

const SecondaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 700px) {
    grid-template-columns: 1fr;
  }
`;

const cardVariants = {
  neutral: {
    bg: "#6c757d",
    hover: "#5c636a",
  },
  warning: {
    bg: "#f39c12",
    hover: "#d68910",
  },
  purple: {
    bg: "#8e44ad",
    hover: "#7d3c98",
  },
  success: {
    bg: "#28a745",
    hover: "#218838",
  },
};

const ActionCardBase = css<{ $variant: keyof typeof cardVariants }>`
  border-radius: 14px;
  padding: 16px;
  min-height: 92px;
  color: #fff;
  background: ${({ $variant }) => cardVariants[$variant].bg};
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);

  &:hover {
    transform: translateY(-1px);
    background: ${({ $variant }) => cardVariants[$variant].hover};
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
  }
`;

const ActionCardButton = styled.button<{ $variant: keyof typeof cardVariants }>`
  ${ActionCardBase};
  border: none;
  text-align: left;
  width: 100%;
  cursor: pointer;
`;

const ActionCardLabel = styled.label<{ $variant: keyof typeof cardVariants }>`
  ${ActionCardBase};
  display: block;
  text-align: left;
  cursor: pointer;
`;

const ImportCard = styled.label`
  display: block;
  width: 100%;
  background: #1a1a1a;
  color: #fff;
  border-radius: 14px;
  padding: 16px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;

  &:hover {
    background: #111;
  }

  &[data-disabled="true"] {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const ActionTitle = styled.div`
  font-size: 15px;
  font-weight: 800;
  margin-bottom: 6px;
`;

const ActionDescription = styled.div`
  font-size: 12px;
  line-height: 1.4;
  opacity: 0.92;
`;

const ClearButton = styled.button`
  background: #fff;
  border: 1px solid #d9d9d9;
  color: #444;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 700;

  &:hover {
    background: #f5f5f5;
  }
`;

const DeleteAllButton = styled.button`
  background: #fff5f5;
  border: 1px solid #dc3545;
  color: #c62828;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 700;

  &:hover:not(:disabled) {
    background: #dc3545;
    color: #fff;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const RefreshButton = styled.button`
  padding: 14px 18px;
  background: #fff;
  color: #1a1a1a;
  border: 2px solid #1a1a1a;
  border-radius: 12px;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: #1a1a1a;
    color: #fff;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PhotoButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 18px;
  background: #111;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-weight: 800;
  font-size: 14px;
  cursor: pointer;
  width: 100%;

  &:hover {
    opacity: 0.9;
  }
`;

const PhotoBadge = styled.span`
  background: #fff;
  color: #111;
  font-size: 11px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 999px;
`;

const SyncStatus = styled.div`
  margin-top: 16px;
  font-size: 13px;
  color: #666;
  text-align: center;
  background: #f8f9fa;
  border-radius: 10px;
  padding: 10px 12px;
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
  width: 100%;
  margin: 15px 0;
`;

const SecondaryActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
  padding-top: 15px;
  border-top: 1px dashed #ddd;
`;

const StatusChip = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8f9fa;
  padding: 10px 15px;
  border-radius: 10px;
  border: 1px solid #e9ecef;
  margin-bottom: 15px;
  font-size: 14px;
  font-weight: 600;
`;

const OffscreenExportContainer = styled.div`
  position: absolute;
  left: -9999px;
  top: -9999px;
`;

// Card específico para a gráfica (sem bordas arredondadas visíveis e com sangria)
const GraficaCardStyle = styled.div`
  width: 259.6pt; /* 85.6mm + 6mm sangria */
  height: 170pt; /* 54mm + 6mm sangria */
  position: relative;
  background: linear-gradient(135deg, #000000 0%, #919191 55%, #000000 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const PreviewCardContainer = styled.div<{ $isExporting?: boolean }>`
  width: 500px;
  height: 310px; /* Altura fixa para manter proporção de cartão */
  /* Remove arredondamento na exportação para a gráfica */
  border-radius: ${(props) => (props.$isExporting ? "0" : "28px")};
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #000000 0%, #919191 55%, #000000 100%);
  font-family: Arial, sans-serif;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  /* Remove sombra na exportação para evitar manchas pretas */
  box-shadow: ${(props) =>
    props.$isExporting ? "none" : "0 7px 10px rgba(0, 0, 0, 0.4)"};

  @media (max-width: 540px) {
    width: 100%;
    height: auto;
  }
`;

const HeaderArea = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px 24px;
`;
const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;
const Shield = styled.img`
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: #fff;
`;
const PreviewQrCode = styled.img`
  width: 70px;
  height: 70px;
  background: #fff;
  padding: 4px;
  border-radius: 8px;
`;
const TitleGroup = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: start;
  align-items: start;
`;
const SmallTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: #e0e0e0;
  text-transform: uppercase;
  margin-bottom: 2px;
  text-align: left;
`;
const MainTitle = styled.div`
  font-size: 20px;
  font-weight: 900;
  color: #fff;
  text-align: left;
`;
const Content = styled.div`
  display: flex;
  padding: 0 24px 16px 24px;
  gap: 16px;
`;
const PhotoBox = styled.div`
  width: 120px;
  height: 128px;
  background: #fff;
  border-radius: 10px;
  flex-shrink: 0;
`;
const PhotoBoxImg = styled.img`
  width: 120px;
  height: 128px;
  border-radius: 10px;
  flex-shrink: 0;
  object-fit: cover;
`;
const Fields = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
const Row = styled.div`
  display: flex;
  gap: 8px;
  max-height: 18px;
`;
const Field = styled.div`
  background: #fff;
  border-radius: 8px;
  padding: 6px 6px;
  display: flex;
  flex-direction: row;
  justify-content: start;
  align-items: center;
`;
const Label = styled.span`
  font-size: 10px;
  color: #979797;
  font-weight: 800;
  text-transform: uppercase;
  @media (max-width: 600px) {
    font-size: 8px;
  }
`;
const Value = styled.span`
  font-size: 10px;
  color: #000;
  font-weight: 800;
  text-transform: uppercase;
  margin-left: 5px;
  @media (max-width: 600px) {
    font-size: 8px;
  }
`;
const PreviewFooter = styled.div`
  background: rgba(0, 0, 0, 0.6);
  color: #ccc;
  font-size: 10px;
  text-align: center;
  padding: 6px 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;
const PreviewSearchArea = styled.div`
  margin-top: 16px;
  width: 100%;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
`;
const PreviewSearchWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;
const PreviewDropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 100;
  overflow: hidden;
`;
const PreviewDropdownItem = styled.div`
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: #f5f5f5;
  }
`;
const DropdownName = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
`;
const DropdownMeta = styled.div`
  font-size: 12px;
  color: #888;
  margin-top: 2px;
`;
const PreviewLabelArea = styled.div`
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
`;
const PreviewLabel = styled.div`
  font-size: 13px;
  color: #555;
`;
const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;
const DownloadJpgBtn = styled.button`
  background: #28a745;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    background: #218838;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
const ResetPreview = styled.button`
  background: none;
  border: 1px solid #ddd;
  color: #666;
  font-size: 12px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 6px;
  &:hover {
    background: #f0f0f0;
  }
`;
const Container = styled.div`
  padding: 24px 16px;
  text-align: center;
  background: #f0f2f5;
  min-height: 100vh;
  @media (max-width: 600px) {
    padding: 16px 12px;
  }
`;
const Title = styled.h1`
  color: #1a1a1a;
  margin-bottom: 24px;
  font-size: 24px;
  @media (max-width: 600px) {
    font-size: 18px;
  }
`;
const SectionTitle = styled.h2`
  font-size: 16px;
  margin-bottom: 12px;
  color: #333;
`;
const PreviewWrapper = styled.div`
  display: flex;
  justify-content: center;
  overflow-x: auto;
`;
const ConfigPanel = styled.div`
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
  text-align: left;
`;
const ConfigTitle = styled.div`
  font-size: 13px;
  font-weight: 700;
  color: #555;
  margin-bottom: 12px;
`;
const ConfigRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  @media (max-width: 500px) {
    grid-template-columns: 1fr;
  }
`;
const ConfigField = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  label {
    font-size: 12px;
    color: #666;
    font-weight: 600;
  }
`;
const ConfigInput = styled.input`
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  &:focus {
    border-color: #0070f3;
  }
`;

const ActionsRow = styled.div`
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const LabelButton = styled.label<{ disabled?: boolean }>`
  cursor: ${(p) => (p.disabled ? "not-allowed" : "pointer")};
  padding: 14px 24px;
  background: ${(p) => (p.disabled ? "#ccc" : "#1a1a1a")};
  color: #fff;
  border-radius: 8px;
  font-weight: bold;
  display: flex;
  width: "100%";
`;

const AlunosSection = styled.div`
  text-align: left;
  margin-top: 8px;
`;
const SearchWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 8px;
`;
const SearchIcon = styled.span`
  position: absolute;
  left: 10px;
  font-size: 14px;
  pointer-events: none;
`;
const SearchInput = styled.input`
  width: 100%;
  padding: 10px 36px 10px 32px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  color: #1a1a1a;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  &::placeholder {
    color: #aaa;
  }
  &:focus {
    border-color: #0070f3;
  }
`;
const ClearSearch = styled.button`
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  &:hover {
    color: #333;
  }
`;
const SearchCount = styled.div`
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
  padding-left: 2px;
`;
const AlunosList = styled.div`
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  max-height: 400px;
  overflow-y: auto;
`;
const AlunoRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #f0f0f0;
  &:last-child {
    border-bottom: none;
  }
  &:hover {
    background: #fafafa;
  }
`;
const AlunoInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;
const AlunoNome = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
`;
const AlunoSub = styled.span`
  font-size: 12px;
  color: #888;
`;
const EditBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 6px;
  border-radius: 8px;
  flex-shrink: 0;
  &:hover {
    background: #eee;
  }
`;
const EmptySearch = styled.div`
  text-align: center;
  color: #aaa;
  font-size: 13px;
  padding: 24px;
`;

const ImportRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
`;

