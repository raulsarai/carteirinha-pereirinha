import { sanitizeChave } from '@/components/PhotoSession'
import { supabase } from './supabase'


const toStr = (val: unknown): string => String(val ?? '').trim()

const normalizeMatricula = (val: unknown): string =>
  toStr(val)
    .replace(/\//g, '-')
    .replace(/\s+/g, '')
    .toUpperCase()

const normalizeCpf = (val: unknown): string =>
  toStr(val).replace(/\D/g, '')

const makeComboKey = (matricula: unknown, cpf: unknown): string =>
  `${normalizeMatricula(matricula)}|${normalizeCpf(cpf)}`

export async function syncAlunos(alunos: any[]): Promise<Record<string, string>> {
  const alunoMap: Record<string, string> = {}

  for (const aluno of alunos) {
    const nome = toStr(aluno['ALUNO'])
    if (!nome) continue

    const matricula = toStr(aluno['Nº Matric']) || null
    const cpf = toStr(aluno['CPF']) || null

    if (!matricula && !cpf) continue

    let dataNasc = aluno['Data Nasc']
    if (typeof dataNasc === 'number') {
      const date = new Date(Math.round((dataNasc - 25569) * 86400 * 1000))
      dataNasc = date.toISOString().split('T')[0]
    } else if (typeof dataNasc === 'string' && dataNasc.includes('/')) {
      const [d, m, y] = dataNasc.split('/')
      dataNasc = `${y}-${m}-${d}`
    }

    const payload = {
      matricula: matricula || null,
      nome,
      rg: toStr(aluno['RG aluno']) || null,
      cpf: cpf || null,
      data_nascimento: dataNasc || null,
      responsavel: toStr(aluno['Responsavel']) || null,
      categoria: toStr(aluno['Categoria']) || null,
    }

    const conflictCol = matricula ? 'matricula' : 'cpf'

    const { data, error } = await supabase
      .from('alunos')
      .upsert(payload, { onConflict: conflictCol })
      .select('id')
      .single()

    if (error) {
      console.error(`❌ Erro ao sincronizar ${nome}:`, error.message)
      continue
    }

    const matKey = normalizeMatricula(matricula)
    const cpfKey = normalizeCpf(cpf)
    const comboKey = makeComboKey(matricula, cpf)

    if (matKey) alunoMap[matKey] = data.id
    if (cpfKey) alunoMap[cpfKey] = data.id
    if (matKey || cpfKey) alunoMap[comboKey] = data.id

    console.log(`✅ ${nome} | matKey: ${matKey} | cpfKey: ${cpfKey} | ID: ${data.id}`)
  }

  console.log(`👥 Total sincronizado: ${Object.keys(alunoMap).length} chaves`)
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

  return (data ?? []).map((row: any) => ({
    id: row.id,
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




