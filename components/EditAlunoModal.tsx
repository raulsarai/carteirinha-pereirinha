"use client";

import { useState, useRef } from "react";
import styled from "styled-components";
import { updateAluno, createAluno, deleteAluno } from "../lib/alunos";
import { uploadPhoto } from "../lib/photos";
import { sanitizeChave } from "./PhotoSession";

const brToIsoDate = (value: string) => {
  if (!value) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
};

const isoToBrDate = (value: string) => {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, yyyy, mm, dd] = match;
  return `${dd}/${mm}/${yyyy}`;
};

type Props = {
  aluno: any;
  alunoId: string;
  onClose: () => void;
  onSave: (updated: any, photoUrl?: string | null) => void;
};

export default function EditAlunoModal({
  aluno,
  alunoId,
  onClose,
  onSave,
}: Props) {
  const effectiveAlunoId = alunoId || aluno?.id || "";
  const isNew = !effectiveAlunoId;
  const temMatricula = !!aluno["Nº Matric"];

  const [form, setForm] = useState({
    matricula: aluno["Nº Matric"] || "",
    nome: aluno["ALUNO"] || "",
    rg: aluno["RG aluno"] || "",
    cpf: aluno["CPF"] || "",
    data_nascimento: isoToBrDate(
      aluno.data_nascimento || aluno["Data Nasc"] || "",
    ),
    responsavel: aluno["Responsavel"] || "",
    categoria: aluno["Categoria"] || "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── NOVO: estado da foto ───────────────────────────────
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    aluno.fotoUrl || aluno.photoUrl || null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido.");
      return;
    }

    setPhotoFile(file);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemovePhotoPreview = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  async function handleDelete() {
    const confirmado = confirm(
      `Tem certeza que deseja excluir o aluno ${form.nome}? Esta ação não pode ser desfeita.`,
    );
    if (!confirmado) return;

    setSaving(true);
    try {
      await deleteAluno(alunoId);
      onSave(null);
      onClose();
    } catch (err: any) {
      setError("Erro ao excluir: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      setError("O nome do atleta é obrigatório.");
      return;
    }

    // Se tem foto pra enviar, precisa de matrícula OU cpf pra nomear o arquivo
    if (photoFile && !form.matricula.trim() && !form.cpf.trim()) {
      setError("Informe a matrícula ou CPF antes de enviar a foto.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        matricula: form.matricula || null,
        nome: form.nome,
        rg: form.rg || null,
        cpf: form.cpf || null,
        responsavel: form.responsavel || null,
        categoria: form.categoria || null,
        data_nascimento: brToIsoDate(form.data_nascimento),
      };

      let result;
      let finalAlunoId = alunoId;

      if (isNew) {
        result = await createAluno(payload);
      } else {
        result = await updateAluno(effectiveAlunoId, payload);
      }

      // ─── NOVO: upload da foto usando a matrícula como nome do arquivo ───
      let uploadedPhotoUrl: string | null = null;
      if (photoFile) {
        const chaveArquivo = form.matricula || form.cpf; // uploadPhoto sanitiza internamente
        uploadedPhotoUrl = await uploadPhoto(
          chaveArquivo,
          photoFile,
          finalAlunoId,
          form.cpf || undefined,
        );
      }

      const alunoFormatado = {
        ...aluno,
        id: isNew ? result.id : effectiveAlunoId,
        ALUNO: form.nome,
        "Nº Matric": form.matricula,
        "RG aluno": form.rg,
        CPF: form.cpf,
        "Data Nasc": form.data_nascimento,
        Responsavel: form.responsavel,
        Categoria: form.categoria,
        data_nascimento: brToIsoDate(form.data_nascimento),
        photoUrl: aluno.photoUrl || null,
      };

      onSave(alunoFormatado, uploadedPhotoUrl);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Ocorreu um erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalTitle>
          {isNew ? "➕ Cadastrar Aluno" : "✏️ Editar Aluno"}
        </ModalTitle>

        {/* ─── NOVO: bloco de upload de foto ─── */}
        <PhotoUploadArea>
          <PhotoPreviewBox onClick={() => fileInputRef.current?.click()}>
            {photoPreview ? (
              <PreviewImg src={photoPreview} alt="Foto do aluno" />
            ) : (
              <PhotoPlaceholder>📷 Adicionar foto</PhotoPlaceholder>
            )}
          </PhotoPreviewBox>
          <PhotoActions>
            <PhotoBtn
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? "Trocar foto" : "Selecionar foto"}
            </PhotoBtn>
          </PhotoActions>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            hidden
          />
        </PhotoUploadArea>

        <Field>
          <Label>Nome</Label>
          <Input
            value={form.nome}
            onChange={(e) => handleChange("nome", e.target.value)}
            placeholder="Nome completo do atleta"
          />
        </Field>

        <Row>
          <Field>
            <Label>
              Matrícula{" "}
              {!isNew && temMatricula && <Locked>🔒 bloqueado</Locked>}
            </Label>
            <Input
              value={form.matricula}
              onChange={(e) => handleChange("matricula", e.target.value)}
              disabled={!isNew && temMatricula}
              $locked={!isNew && temMatricula}
              placeholder="Ex: 2024001"
            />
          </Field>
          <Field>
            <Label>Categoria</Label>
            <Input
              value={form.categoria}
              onChange={(e) => handleChange("categoria", e.target.value)}
              placeholder="Ex: Sub-11"
            />
          </Field>
        </Row>

        <Row>
          <Field>
            <Label>RG</Label>
            <Input
              value={form.rg}
              onChange={(e) => handleChange("rg", e.target.value)}
            />
          </Field>
          <Field>
            <Label>CPF</Label>
            <Input
              value={form.cpf}
              onChange={(e) => handleChange("cpf", e.target.value)}
            />
          </Field>
        </Row>

        <Row>
          <Field>
            <Label>Data de Nasc.</Label>
            <Input
              value={form.data_nascimento}
              onChange={(e) => handleChange("data_nascimento", e.target.value)}
              placeholder="00/00/0000"
            />
          </Field>
          <Field>
            <Label>Responsável</Label>
            <Input
              value={form.responsavel}
              onChange={(e) => handleChange("responsavel", e.target.value)}
            />
          </Field>
        </Row>

        {error && <ErrorMsg>❌ {error}</ErrorMsg>}

        <ModalActions>
          {!isNew && (
            <DeleteBtn type="button" onClick={handleDelete} disabled={saving}>
              🗑️ Excluir
            </DeleteBtn>
          )}
          <div style={{ flex: 1 }} />
          <CancelBtn onClick={onClose}>Cancelar</CancelBtn>
          <SaveBtn onClick={handleSave} disabled={saving}>
            {saving ? "Processando..." : "💾 Salvar"}
          </SaveBtn>
        </ModalActions>
      </Modal>
    </Overlay>
  );
}

// ─── NOVOS ESTILOS DA FOTO ──────────────────────────────
const PhotoUploadArea = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
`;
const PhotoPreviewBox = styled.div`
  width: 72px;
  height: 72px;
  border-radius: 12px;
  background: #2a2a2a;
  border: 1px dashed #555;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
`;
const PreviewImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;
const PhotoPlaceholder = styled.span`
  font-size: 10px;
  color: #888;
  text-align: center;
  padding: 4px;
`;
const PhotoActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;
const PhotoBtn = styled.button`
  padding: 6px 12px;
  background: #0070f3;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
`;
const PhotoRemoveBtn = styled.button`
  padding: 6px 12px;
  background: none;
  color: #ff6b6b;
  border: 1px solid #ff6b6b;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
`;

const DeleteBtn = styled.button`
  padding: 10px 16px;
  background: none;
  color: #ff4d4d;
  border: 1px solid #ff4d4d;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  transition: all 0.2s;
  &:hover {
    background: #ff4d4d;
    color: #fff;
  }
  &:disabled {
    opacity: 0.5;
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
`;
const Modal = styled.div`
  background: #1a1a1a;
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  color: #fff;
  max-height: 90vh;
  overflow-y: auto;
`;
const ModalTitle = styled.h2`
  font-size: 18px;
  font-weight: 800;
  margin: 0;
`;
const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  @media (max-width: 400px) {
    grid-template-columns: 1fr;
  }
`;
const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const Label = styled.label`
  font-size: 11px;
  color: #aaa;
  text-transform: uppercase;
  display: flex;
  gap: 6px;
  align-items: center;
`;
const Locked = styled.span`
  font-size: 10px;
  color: #f90;
  background: #2a2000;
  padding: 2px 6px;
  border-radius: 4px;
`;
const Input = styled.input<{ $locked?: boolean }>`
  padding: 8px 10px;
  background: ${(p) => (p.$locked ? "#111" : "#2a2a2a")};
  border: 1px solid ${(p) => (p.$locked ? "#333" : "#444")};
  border-radius: 8px;
  color: ${(p) => (p.$locked ? "#555" : "#fff")};
  font-size: 14px;
  outline: none;
  &:focus {
    border-color: #0070f3;
  }
`;
const ErrorMsg = styled.div`
  color: #ff6b6b;
  font-size: 13px;
`;
const ModalActions = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 4px;
`;
const CancelBtn = styled.button`
  flex: 1;
  padding: 10px;
  background: #333;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
`;
const SaveBtn = styled.button`
  flex: 2;
  padding: 10px;
  background: #0070f3;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  &:disabled {
    opacity: 0.5;
  }
`;
