import {
  deleteAllAlunos,
  getAlunos,
  getPhotos,
  syncAlunos,
} from "@/lib/photos";
import { toJpeg, toPng } from "html-to-image";
import dynamic from "next/dynamic";
import QRCode from "qrcode";
import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import * as XLSX from "xlsx";
import EditAlunoModal from "../components/EditAlunoModal";
import PhotoSession, { sanitizeChave } from "../components/PhotoSession";

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
>(({ student, photoUrl, cardAno, cardValorPerda,isExporting }, ref) => {
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    QRCode.toDataURL(student["Nº Matric"] || student["CPF"] || "000").then(
      setQrUrl,
    );
  }, [student]);

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
            <Label>Nome:</Label>
            <Value>{student["ALUNO"]}</Value>
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

  useEffect(() => {
    if (data.length === 0) return;
    const syncFotos = async () => {
      const alunosRef = data.map((s: any) => ({
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

  const filteredAlunos = data.filter((s) => {
    const term = searchAlunos.toLowerCase().trim();
    if (!term) return true;
    const nome = String(s["ALUNO"] || "").toLowerCase();
    const matricula = String(s["Nº Matric"] || "").toLowerCase();
    const cpf = String(s["CPF"] || "").toLowerCase();
    return (
      nome.includes(term) || matricula.includes(term) || cpf.includes(term)
    );
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

      await new Promise(resolve => setTimeout(resolve, 100));

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
      </ConfigPanel>

      {/* UPLOAD / AÇÕES */}
      <UploadBox>
        {data.length > 0 && (
          <CacheBar>
            <span>✅ {data.length} alunos</span>
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

        <ImportRow>
          {/* IMPORTAR PLANILHA — só aparece se não há dados */}
          {data.length === 0 && (
            <>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                id="file-upload"
                hidden
                disabled={isProcessing}
              />
              <LabelButton htmlFor="file-upload" disabled={isProcessing}>
                {isProcessing
                  ? "Processando Arquivo..."
                  : "📂 Importar Planilha (Excel/CSV)"}
              </LabelButton>
            </>
          )}

          {/* ATUALIZAR DADOS — sempre visível */}
          <RefreshButton onClick={handleRefreshFromDB} disabled={isRefreshing}>
            {isRefreshing ? <>⏳ Atualizando...</> : <>🔄 Atualizar Dados</>}
          </RefreshButton>
        </ImportRow>

        {isSyncing && (
          <SyncStatus>⏳ Sincronizando alunos com o banco...</SyncStatus>
        )}

        {data.length > 0 && (
          <ActionsRow>
            <PhotoButton onClick={() => setShowPhotoSession(true)}>
              📷 Iniciar Sessão de Fotos ({data.length} alunos)
              {Object.keys(sessionPhotos).length > 0 && (
                <PhotoBadge>
                  {Object.keys(sessionPhotos).length} foto(s)
                </PhotoBadge>
              )}
            </PhotoButton>

            {/* PDF — roda só no client via dynamic import */}
            <PdfDownloadButton
              data={data}
              qrCodes={qrCodes}
              sessionPhotos={sessionPhotos}
              cardAno={cardAno}
              cardValorPerda={cardValorPerda}
            />
          </ActionsRow>
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

          <AlunosList>
            {filteredAlunos.map((student, i) => {
              const alunoIds = JSON.parse(
                localStorage.getItem("alunoIds") || "{}",
              );
              const chave = sanitizeChave(
                student["Nº Matric"] || student["CPF"],
              );
              const alunoId = alunoIds[chave];
              const temFoto = !!sessionPhotos[chave];
              return (
                <AlunoRow key={i}>
                  <AlunoInfo>
                    <AlunoNome>{student["ALUNO"]}</AlunoNome>
                    <AlunoSub>
                      {student["Nº Matric"]
                        ? `Mat: ${student["Nº Matric"]}`
                        : `CPF: ${student["CPF"] || "—"}`}
                      {" · "}
                      {student["Categoria"] || "—"}
                      {" · "}
                      <span style={{ color: temFoto ? "#28a745" : "#aaa" }}>
                        {temFoto ? "✅ com foto" : "⬜ sem foto"}
                      </span>
                    </AlunoSub>
                  </AlunoInfo>
                  <EditBtn
                    onClick={() => setEditingAluno({ student, id: alunoId })}
                    title="Editar aluno"
                  >
                    ✏️
                  </EditBtn>
                </AlunoRow>
              );
            })}
            {filteredAlunos.length === 0 && (
              <EmptySearch>
                Nenhum aluno encontrado para "{searchAlunos}"
              </EmptySearch>
            )}
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
            const newData = data.map((s) =>
              s["ALUNO"] === editingAluno.student["ALUNO"] ? updated : s,
            );
            setData(newData);
            localStorage.setItem("pereirinha_data", JSON.stringify(newData));
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

const PreviewCardContainer = styled.div<{ $isExporting?: boolean }>`
  width: 500px;
  border-radius: 28px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #000000 0%, #919191 55%, #000000 100%);
  font-family: Arial, sans-serif;
  margin-bottom: 16px;

  /* Aplica a sombra apenas se NÃO estiver exportando */
  box-shadow: ${(props) =>
    props.$isExporting ? "none" : "0 7px 10px rgba(0, 0, 0, 0.4)"};

  @media (max-width: 540px) {
    width: 100%;
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
const UploadBox = styled.div`
  background: #fff;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  margin-bottom: 20px;
`;
const ActionsRow = styled.div`
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;
const PhotoButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  background: #1a1a1a;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  font-size: 14px;
  cursor: pointer;
  &:hover {
    opacity: 0.85;
  }
`;
const PhotoBadge = styled.span`
  background: #fff;
  color: #1a1a1a;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 99px;
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
const CacheBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f0fff4;
  border: 1px solid #28a745;
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 600;
  color: #1a5c2a;
  flex-wrap: wrap;
  gap: 8px;
`;
const ClearButton = styled.button`
  background: none;
  border: 1px solid #dc3545;
  color: #dc3545;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
  &:hover {
    background: #dc3545;
    color: #fff;
  }
`;
const SyncStatus = styled.div`
  margin-top: 12px;
  font-size: 13px;
  color: #888;
  text-align: center;
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

const RefreshButton = styled.button`
  padding: 14px 20px;
  background: #fff;
  color: #1a1a1a;
  border: 2px solid #1a1a1a;
  border-radius: 8px;
  font-weight: bold;
  font-size: 14px;
  cursor: pointer;
  width: 100%;
  transition: all 0.2s;
  &:hover:not(:disabled) {
    background: #1a1a1a;
    color: #fff;
  }
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const CacheActions = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const DeleteAllButton = styled.button`
  background: none;
  border: 1px solid #dc3545;
  color: #dc3545;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
  &:hover:not(:disabled) {
    background: #dc3545;
    color: #fff;
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
