import { supabase } from './supabase'

// Adicione esta função ao seu arquivo de biblioteca
export async function createAluno(payload: {
  matricula?: string | null
  nome: string
  rg?: string | null
  cpf?: string | null
  data_nascimento?: string | null
  responsavel?: string | null
  categoria?: string | null
}) {
  const { data, error } = await supabase
    .from('alunos')
    .insert([payload])
    .select() // Importante para retornar o ID gerado pelo banco
    .single()

  if (error) throw error
  return data
}

// Sua função de update permanece igual
export async function updateAluno(id: string, payload: {
  matricula?: string | null
  nome?: string
  rg?: string | null
  cpf?: string | null
  data_nascimento?: string | null
  responsavel?: string | null
  categoria?: string | null
}): Promise<void> {
  const { error } = await supabase
    .from('alunos')
    .update(payload)
    .eq('id', id)
  if (error) throw error
}

export async function deleteAluno(id: string): Promise<void> {
  const { error } = await supabase
    .from('alunos')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
