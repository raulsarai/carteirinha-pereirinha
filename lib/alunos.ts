import { supabase } from './supabase'

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

export async function getAlunoByChave(chave: string) {
  const { data, error } = await supabase
    .from('alunos')
    .select('*')
    .or(`matricula.eq.${chave},cpf.eq.${chave}`)
    .single()
  if (error) return null
  return data
}
