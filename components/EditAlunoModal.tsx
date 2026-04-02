"use client";

import { useState } from "react";
import styled from "styled-components";
// Importe a função de criar aluno que você deve ter no seu lib
import { updateAluno, createAluno, deleteAluno } from "../lib/alunos";

type Props = {
  aluno: any;
  alunoId: string; // No cadastro novo, isso virá como ""
  onClose: () => void;
  onSave: (updated: any) => void;
};

export default function EditAlunoModal({
  aluno,
  alunoId,
  onClose,
  onSave,
}: Props) {
  // Se não tem alunoId, é um cadastro novo
  const isNew = !alunoId;
  const temMatricula = !!aluno["Nº Matric"];

  const [form, setForm] = useState({
    matricula: aluno["Nº Matric"] || "",
    nome: aluno["ALUNO"] || "",
    rg: aluno["RG aluno"] || "",
    cpf: aluno["CPF"] || "",
    data_nascimento: aluno["Data Nasc"] || "",
    responsavel: aluno["Responsavel"] || "",
    categoria: aluno["Categoria"] || "",
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  async function handleDelete() {
    const confirmado = confirm(
      `Tem certeza que deseja excluir o aluno ${form.nome}? Esta ação não pode ser desfeita.`,
    );
    if (!confirmado) return;

    setSaving(true);
    try {
      await deleteAluno(alunoId);
      // Chamamos o onSave passando null ou um sinalizador de exclusão
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
      data_nascimento: form.data_nascimento || null,
    };

    let result;

    if (isNew) {
      result = await createAluno(payload);
    } else {
      result = await updateAluno(alunoId, payload);
    }

    // CRUCIAL: Garantir que o objeto retornado tenha as chaves em MAIÚSCULO 
    // para bater com o que o seu Preview e Lista esperam
    const alunoFormatado = {
      ...aluno, // mantém fotos e outros metadados
      id: isNew ? result.id : alunoId,
      "ALUNO": form.nome,
      "Nº Matric": form.matricula,
      "RG aluno": form.rg,
      "CPF": form.cpf,
      "Data Nasc": form.data_nascimento,
      "Responsavel": form.responsavel,
      "Categoria": form.categoria,
    };

    onSave(alunoFormatado);
    onClose();
  } catch (err: any) {
    // Se o erro for apenas visual mas o aluno salvou, onClose() resolveria,
    // mas vamos tratar para não exibir "null"
    setError(err?.message || "Ocorreu um erro ao salvar.");
  } finally {
    setSaving(false);
  }
}

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        {/* Título Dinâmico corrigido (agora dentro do ModalTitle para respeitar o estilo) */}
        <ModalTitle>
          {isNew ? "➕ Cadastrar Aluno" : "✏️ Editar Aluno"}
        </ModalTitle>

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
          <div style={{ flex: 1 }} /> {/* Espaçador */}
          <CancelBtn onClick={onClose}>Cancelar</CancelBtn>
          <SaveBtn onClick={handleSave} disabled={saving}>
            {saving ? "Processando..." : "💾 Salvar"}
          </SaveBtn>
        </ModalActions>
      </Modal>
    </Overlay>
  );
}

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
  &:disabled { opacity: 0.5; }
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
