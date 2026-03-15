import { sanitizeChave } from '@/components/PhotoSession'
import { supabase } from './supabase'

export async function syncAlunos(alunos: any[]): Promise<Record<string, string>> {
  const alunoMap: Record<string, string> = {} // matricula|cpf → id

  

  for (const aluno of alunos) {
    const nome = aluno['ALUNO']
    if (!nome) continue // ignora linhas sem nome

    const matricula = aluno['Nº Matric'] || null
    const cpf = aluno['CPF'] || null
    const chaveOriginal = matricula || cpf
    if (!chaveOriginal) continue

    const chave = sanitizeChave(chaveOriginal)

    // Trata data de nascimento
    let dataNasc = aluno['Data Nasc']
    if (typeof dataNasc === 'number') {
      const date = new Date(Math.round((dataNasc - 25569) * 86400 * 1000))
      dataNasc = date.toISOString().split('T')[0] // formato YYYY-MM-DD
    } else if (typeof dataNasc === 'string' && dataNasc.includes('/')) {
      const [d, m, y] = dataNasc.split('/')
      dataNasc = `${y}-${m}-${d}`
    }

    const payload = {
      matricula: aluno['Nº Matric'] || null,
      nome: nome,
      rg: aluno['RG aluno'] || null,
      cpf: aluno['CPF'] || null,
      data_nascimento: dataNasc || null,
      responsavel: aluno['Responsavel'] || null,
      categoria: aluno['Categoria'] || null,
    }

    // Upsert usando matricula ou cpf como conflito
    const conflictCol = aluno['Nº Matric'] ? 'matricula' : 'cpf'

    const { data, error } = await supabase
      .from('alunos')
      .upsert(payload, { onConflict: conflictCol })
      .select('id')
      .single()

    if (error) {
      console.error(`❌ Erro ao sincronizar ${nome}:`, error.message)
      continue
    }

    alunoMap[chave] = data.id
    console.log(`✅ ${nome} | chave: ${chave} | ID: ${data.id}`)
  }

  console.log(`👥 Total sincronizado: ${Object.keys(alunoMap).length} alunos`)
  return alunoMap
}

export async function uploadPhoto(
  chave: string,
  blob: Blob,
  alunoId: string,
  cpf?: string
): Promise<string> {
  const chaveSegura = chave
    .replace(/\//g, '-')
    .replace(/\s/g, '_')
    .trim()

  // ← Versão com timestamp no nome para forçar novo arquivo
  const path = `${chaveSegura}.jpg`
  const pathVersao = `${chaveSegura}_v${Date.now()}.jpg`

  // Deleta a versão anterior se existir
  await supabase.storage
    .from('fotos-carteirinhas')
    .remove([path, `${chaveSegura}_v*.jpg`])
    .catch(() => {}) // ignora erro se não existir

  const { error: uploadError } = await supabase.storage
    .from('fotos-carteirinhas')
    .upload(pathVersao, blob, { contentType: 'image/jpeg', upsert: true })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('fotos-carteirinhas')
    .getPublicUrl(pathVersao)

  const { error: dbError } = await supabase
    .from('carteirinha_fotos')
    .upsert({
      matricula: chaveSegura,
      aluno_id: alunoId,
      storage_path: pathVersao,
      public_url: data.publicUrl,
      cpf: cpf || null
    }, { onConflict: 'matricula' })

  if (dbError) throw dbError

  console.log(`📸 Upload OK | ${chaveSegura} → ${data.publicUrl}`)
  return data.publicUrl
}




export async function getPhotos(
  alunos: { matricula?: string; cpf?: string }[]
): Promise<Record<string, string>> {
  // Monta lista de chaves únicas (matricula ou cpf)
  const chaves = alunos
    .map(a => a.matricula || a.cpf)
    .filter(Boolean) as string[]

  const { data, error } = await supabase
    .from('carteirinha_fotos')
    .select('matricula, public_url')
    .in('matricula', chaves)

  if (error) {
    console.error('❌ Erro ao buscar fotos:', error.message)
    return {}
  }

  return Object.fromEntries(data.map(r => [r.matricula, r.public_url]))
}

export async function getAlunos(): Promise<any[]> {
  const { data, error } = await supabase
    .from("alunos")
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    console.error("Erro ao buscar alunos:", error);
    return [];
  }

  // Mapeia colunas do banco → chaves que o front espera
  return (data ?? []).map((row: any) => ({
    ALUNO: row.nome ?? "",
    "RG aluno": row.rg ?? "",
    CPF: row.cpf ?? "",
    "Data Nasc": row.data_nascimento
      ? new Date(row.data_nascimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : "",
    Responsavel: row.responsavel ?? "",
    "Nº Matric": row.matricula ?? "",
    Categoria: row.categoria ?? "",
  }));
}

export async function deleteAllAlunos(): Promise<void> {
  // Deleta todas as fotos do storage
  const { data: files } = await supabase.storage
    .from("fotos-carteirinhas") // ← ajuste para o nome do seu bucket
    .list();

  if (files && files.length > 0) {
    const paths = files.map((f) => f.name);
    await supabase.storage.from("fotos-carteirinhas").remove(paths);
  }

  // Deleta todos os alunos da tabela
  await supabase.from("alunos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}




