import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { uploadPhoto } from "../lib/photos";

type Student = {
  ALUNO: string;
  "Nº Matric": string;
  [key: string]: any;
};

type Props = {
  students: Student[];
  initialPhotos?: Record<string, string>; // ← fotos já existentes
  onComplete: (photos: Record<string, string>) => void;
  onClose: () => void;
};

export const sanitizeChave = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  return String(val)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "");
};

const normalizeMatricula = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  return String(val)
    .trim()
    .replace(/\//g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
};

const normalizeCpf = (val: unknown): string => {
  if (val === null || val === undefined) return "";
  return String(val).replace(/\D/g, "");
};

export default function PhotoSession({
  students,
  initialPhotos = {},
  onComplete,
  onClose,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  // ← Inicializa com fotos já existentes (do Supabase)
  const [photos, setPhotos] = useState<Record<string, string>>(initialPhotos);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "error"
  >("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);

  const currentStudent = students[currentIndex];
  const isLast = currentIndex === students.length - 1;
  const totalDone = Object.keys(photos).length;

  const [cameraMode, setCameraMode] = useState<"user" | "environment">("user");

  const [search, setSearch] = useState("");

  // Lista filtrada por nome, matrícula ou CPF
  const filteredStudents = students.filter((s) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    const nome = String(s["ALUNO"] || "").toLowerCase();
    const matricula = String(s["Nº Matric"] || "").toLowerCase();
    const cpf = String(s["CPF"] || "").toLowerCase();
    return (
      nome.includes(term) || matricula.includes(term) || cpf.includes(term)
    );
  });

  const getChaveAluno = (student: Student) =>
    sanitizeChave(student["Nº Matric"] || student["CPF"]);

  const getIdentificador = (student: Student) => {
    if (student["Nº Matric"])
      return `Matrícula: ${String(student["Nº Matric"])}`;
    if (student["CPF"]) return `CPF: ${String(student["CPF"])}`;
    return "";
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  async function startCamera(mode: "user" | "environment" = cameraMode) {
    try {
      setCameraError(null);

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }

      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 720 },
            height: { ideal: 960 },
          },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
          } catch (err) {
            console.error("❌ Erro ao iniciar play da câmera:", err);
          }
        };
      }
    } catch (err: any) {
      console.error("❌ Erro câmera:", err);
      if (err.name === "NotAllowedError") {
        setCameraError(
          "Permissão de câmera negada. Acesse as configurações do navegador e permita o uso da câmera.",
        );
      } else if (err.name === "NotFoundError") {
        setCameraError("Nenhuma câmera encontrada neste dispositivo.");
      } else {
        setCameraError("Não foi possível acessar a câmera: " + err.message);
      }
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function restartCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    await new Promise((r) => setTimeout(r, 300));
    await startCamera();
  }

  async function toggleCamera() {
    const nextMode = cameraMode === "user" ? "environment" : "user";
    setCameraMode(nextMode);
    setCapturedImage(null);
    await startCamera(nextMode);
  }

  function dataURLtoBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (cameraMode === "user") {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    setCapturedImage(canvas.toDataURL("image/jpeg", 0.9));
  }

  function retakePhoto() {
    setCapturedImage(null);
    restartCamera();
  }

  function selectStudent(index: number) {
    setCapturedImage(null);
    setCurrentIndex(index);
  }

  async function confirmPhoto() {
    if (!capturedImage || !currentStudent) return;
    setUploadStatus("uploading");

    try {
      const blob = dataURLtoBlob(capturedImage);

      if (blob.size === 0) {
        console.error("❌ Blob vazio!");
        setUploadStatus("error");
        return;
      }

      const matricula = currentStudent["Nº Matric"] || null;
      const cpf = currentStudent["CPF"] || null;
      const chave = getChaveAluno(currentStudent);

      if (!chave) {
        setUploadStatus("error");
        return;
      }

      const alunoIds = JSON.parse(localStorage.getItem("alunoIds") || "{}");

      const matriculaKey = normalizeMatricula(matricula);
      const cpfKey = normalizeCpf(cpf);
      const chaveSanitizada = sanitizeChave(matricula || cpf);

      const alunoId =
        (matriculaKey && alunoIds[matriculaKey]) ||
        (cpfKey && alunoIds[cpfKey]) ||
        (chaveSanitizada && alunoIds[chaveSanitizada]) ||
        null;

      if (!alunoId) {
        console.error("❌ alunoId não encontrado", {
          matriculaOriginal: matricula,
          cpfOriginal: cpf,
          matriculaKey,
          cpfKey,
          chaveSanitizada,
          alunoIds,
        });
        setUploadStatus("error");
        return;
      }

      const publicUrl = await uploadPhoto(
        chave,
        blob,
        alunoId,
        cpf ?? undefined,
      );
      const updatedPhotos = { ...photos, [chave]: publicUrl };
      setPhotos(updatedPhotos);
      setUploadStatus("idle");
      setCapturedImage(null);
      await restartCamera();

      // ← Avança para o próximo SEM foto automaticamente
      const nextIndex = findNextWithoutPhoto(updatedPhotos, currentIndex);
      if (nextIndex !== null) {
        setCurrentIndex(nextIndex);
      } else {
        // Todos têm foto
        stopCamera();
        onComplete(updatedPhotos);
      }
    } catch (err) {
      console.error("❌ Erro no upload:", err);
      setUploadStatus("error");
    }
  }

  // Encontra o próximo aluno sem foto a partir de um índice
  function findNextWithoutPhoto(
    currentPhotos: Record<string, string>,
    fromIndex: number,
  ) {
    // Tenta a partir do próximo
    for (let i = fromIndex + 1; i < students.length; i++) {
      if (!currentPhotos[getChaveAluno(students[i])]) return i;
    }
    // Se não achar, tenta desde o início
    for (let i = 0; i < fromIndex; i++) {
      if (!currentPhotos[getChaveAluno(students[i])]) return i;
    }
    return null; // todos têm foto
  }

  function skipStudent() {
    setCapturedImage(null);
    const nextIndex = findNextWithoutPhoto(photos, currentIndex);
    if (nextIndex !== null) {
      setCurrentIndex(nextIndex);
    } else {
      stopCamera();
      onComplete(photos);
    }
  }

  return (
    <Overlay>
      <Modal>
        {/* HEADER */}
        <ModalHeader>
          <HeaderInfo>
            <Progress>
              {currentIndex + 1} / {students.length}
            </Progress>
            <StudentName>{currentStudent?.ALUNO}</StudentName>
            {/* ← Mostra matrícula OU cpf */}
            <Matricula>{getIdentificador(currentStudent)}</Matricula>
          </HeaderInfo>
          <ProgressBar>
            <ProgressFill
              style={{ width: `${(totalDone / students.length) * 100}%` }}
            />
          </ProgressBar>
        </ModalHeader>

        {/* CÂMERA / PREVIEW */}
        <CameraArea>
          {cameraError ? (
            <ErrorBox>
              <span>📷</span>
              <p>{cameraError}</p>
              <RetryButton onClick={() => startCamera()}>Tentar novamente</RetryButton>

            </ErrorBox>
          ) : capturedImage ? (
            <PreviewWrapper>
              <CapturedPreview
                src={capturedImage}
                alt="Foto capturada"
                $mirrored={cameraMode === "user"}
              />

              <GuideOverlay>
                <GuideFrame>
                  <HeadGuide />
                  <ShoulderGuide />
                  <GuideText>Posicione o rosto dentro da moldura</GuideText>
                </GuideFrame>
              </GuideOverlay>
            </PreviewWrapper>
          ) : (
            <PreviewWrapper>
              <Video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                $mirrored={cameraMode === "user"}
                // @ts-ignore
                webkit-playsinline="true"
              />

              <GuideOverlay>
                <GuideFrame>
                  <HeadGuide />
                  <ShoulderGuide />
                  <GuideText>Posicione o rosto dentro da moldura</GuideText>
                </GuideFrame>
              </GuideOverlay>
            </PreviewWrapper>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </CameraArea>

        {uploadStatus === "uploading" && (
          <StatusBar $type="loading">⏳ Enviando foto...</StatusBar>
        )}
        {uploadStatus === "error" && (
          <StatusBar $type="error">
            ❌ Erro no upload. Tente novamente.
          </StatusBar>
        )}
        <CameraToolbar>
          <CameraModeButton
            type="button"
            onClick={toggleCamera}
            disabled={uploadStatus === "uploading"}
          >
            {cameraMode === "user"
              ? "🔄 Usar câmera traseira"
              : "🔄 Usar câmera frontal"}
          </CameraModeButton>
        </CameraToolbar>

        {/* AÇÕES */}
        <Actions>
          {!capturedImage ? (
            <ActionButton
              $variant="primary"
              onClick={capturePhoto}
              disabled={!!cameraError}
            >
              📷 Tirar Foto
            </ActionButton>
          ) : (
            <>
              <ActionButton
                $variant="success"
                onClick={confirmPhoto}
                disabled={uploadStatus === "uploading"}
              >
                ✅ Confirmar
              </ActionButton>
              <ActionButton
                $variant="ghost"
                onClick={retakePhoto}
                disabled={uploadStatus === "uploading"}
              >
                🔄 Refazer
              </ActionButton>
            </>
          )}
          <ActionButton
            $variant="danger"
            onClick={() => {
              stopCamera();
              onClose();
            }}
          >
            ✕ Fechar
          </ActionButton>
        </Actions>

        {/* SEARCHBAR */}
        <SearchWrapper>
          <SearchIcon>🔍</SearchIcon>
          <SearchInput
            type="text"
            placeholder="Buscar por nome, matrícula ou CPF..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <ClearSearch onClick={() => setSearch("")}>✕</ClearSearch>}
        </SearchWrapper>

        <ListHeader>
          <span>
            {search
              ? `${filteredStudents.length} resultado(s) para "${search}"`
              : `${students.length} alunos`}
          </span>
        </ListHeader>
        <StudentList>
          {filteredStudents.map((s) => {
            const idx = students.indexOf(s); // índice real no array original
            const chave = getChaveAluno(s);
            const done = !!photos[chave];
            const active = idx === currentIndex;
            return (
              <StudentItem
                key={chave || idx}
                $active={active}
                $done={done}
                onClick={() => selectStudent(idx)}
              >
                <StatusIcon>{done ? "✅" : active ? "👤" : "⬜"}</StatusIcon>
                <StudentInfo>
                  <span>{s["ALUNO"]}</span>
                  <StudentId>{getIdentificador(s)}</StudentId>
                </StudentInfo>
              </StudentItem>
            );
          })}
          {filteredStudents.length === 0 && (
            <EmptySearch>Nenhum aluno encontrado para "{search}"</EmptySearch>
          )}
        </StudentList>
      </Modal>
    </Overlay>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;
const Modal = styled.div`
  background: #1a1a1a;
  border-radius: 16px;
  width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #fff;
`;
const ModalHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;
const HeaderInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;
const Progress = styled.span`
  font-size: 12px;
  color: #aaa;
`;
const StudentName = styled.h2`
  font-size: 18px;
  font-weight: 800;
  margin: 0;
`;
const Matricula = styled.span`
  font-size: 13px;
  color: #aaa;
`;
const ProgressBar = styled.div`
  height: 6px;
  background: #333;
  border-radius: 99px;
  overflow: hidden;
`;
const ProgressFill = styled.div`
  height: 100%;
  background: #28a745;
  border-radius: 99px;
  transition: width 0.4s ease;
`;
const ErrorBox = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #ff6b6b;
  padding: 24px;
  text-align: center;
  span {
    font-size: 48px;
  }
`;
const RetryButton = styled.button`
  padding: 8px 16px;
  background: #333;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
`;
const StatusBar = styled.div<{ $type: "loading" | "error" }>`
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  background: ${(p) => (p.$type === "loading" ? "#2a2a00" : "#2a0000")};
  color: ${(p) => (p.$type === "loading" ? "#ffd700" : "#ff6b6b")};
`;
const Actions = styled.div`
  display: flex;
  gap: 8px;
`;
const ActionButton = styled.button<{
  $variant: "primary" | "success" | "ghost" | "danger";
}>`
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  background: ${(p) =>
    ({
      primary: "#0070f3",
      success: "#28a745",
      ghost: "#333",
      danger: "#c0392b",
    }[p.$variant])};
  color: #fff;
`;
const ListHeader = styled.div`
  font-size: 12px;
  color: #aaa;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;
const StudentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
  padding-right: 4px;
`;
const StudentItem = styled.div<{ $active: boolean; $done: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer; /* ← clicável */
  background: ${(p) => (p.$active ? "#0070f3" : p.$done ? "#1a2e1a" : "#222")};
  color: ${(p) => (p.$done ? "#7dff7d" : "#fff")};
  font-weight: ${(p) => (p.$active ? "700" : "400")};
  transition: opacity 0.15s;
  &:hover {
    opacity: 0.85;
  }
`;
const StatusIcon = styled.span`
  font-size: 14px;
  flex-shrink: 0;
`;
const StudentInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
`;
const StudentId = styled.span`
  font-size: 11px;
  opacity: 0.7;
`;

const SearchWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;
const SearchIcon = styled.span`
  position: absolute;
  left: 10px;
  font-size: 14px;
  pointer-events: none;
`;
const SearchInput = styled.input`
  width: 100%;
  padding: 9px 36px 9px 32px;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  &::placeholder {
    color: #666;
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
  font-size: 12px;
  padding: 0;
  &:hover {
    color: #fff;
  }
`;
const EmptySearch = styled.div`
  text-align: center;
  color: #666;
  font-size: 13px;
  padding: 16px;
`;

const CameraArea = styled.div`
  width: min(100%, 340px);
  aspect-ratio: 3 / 4;
  background: #000;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  position: relative;
  border: 2px solid #2f2f2f;
`;

const PreviewWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
`;
const Video = styled.video<{ $mirrored: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: ${(p) => (p.$mirrored ? "scaleX(-1)" : "none")};
`;

const CapturedPreview = styled.img<{ $mirrored: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: ${(p) => (p.$mirrored ? "scaleX(-1)" : "none")};
`;

const GuideOverlay = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.18),
    rgba(0, 0, 0, 0.1)
  );
`;

const GuideFrame = styled.div`
  position: relative;
  width: 78%;
  height: 82%;
  border: 2px solid rgba(255, 255, 255, 0.95);
  border-radius: 18px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.22),
    inset 0 0 0 1px rgba(255, 255, 255, 0.15);
`;

const HeadGuide = styled.div`
  position: absolute;
  top: 12%;
  left: 50%;
  transform: translateX(-50%);
  width: 46%;
  height: 30%;
  border: 2px dashed rgba(255, 255, 255, 0.75);
  border-radius: 999px;
`;

const ShoulderGuide = styled.div`
  position: absolute;
  left: 50%;
  bottom: 16%;
  transform: translateX(-50%);
  width: 72%;
  height: 22%;
  border: 2px dashed rgba(255, 255, 255, 0.55);
  border-top-left-radius: 999px;
  border-top-right-radius: 999px;
  border-bottom-left-radius: 24px;
  border-bottom-right-radius: 24px;
`;

const GuideText = styled.div`
  position: absolute;
  left: 50%;
  bottom: 6%;
  transform: translateX(-50%);
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 6px 10px;
  border-radius: 999px;
  white-space: nowrap;
`;

const CameraToolbar = styled.div`
  display: flex;
  justify-content: center;
  margin-top: -6px;
`;

const CameraModeButton = styled.button`
  border: none;
  border-radius: 999px;
  padding: 10px 14px;
  background: #2b2b2b;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s, background 0.2s;

  &:hover {
    background: #3a3a3a;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
