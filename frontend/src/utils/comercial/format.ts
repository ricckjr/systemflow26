export const parseValorProposta = (val: string | null) => {
  if (!val) return 0
  
  // 1. Remove pontos de milhar (ex: 1.000,00 -> 1000,00)
  // 2. Substitui vírgula decimal por ponto (ex: 1000,00 -> 1000.00)
  // 3. Remove qualquer caractere que não seja número, ponto ou sinal de menos (ex: R$ 1000.00 -> 1000.00)
  const clean = val
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '')
    
  return parseFloat(clean) || 0
}

export const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

export const parseDate = (raw?: string | null): Date | null => {
  if (!raw) return null
  
  // Tenta formato MM-YYYY (ex: 05-2025) - Prioritário conforme dados do banco
  if (/^\d{2}-\d{4}$/.test(raw)) {
    const [m, y] = raw.split('-')
    return new Date(parseInt(y), parseInt(m) - 1, 1)
  }

  // Tenta formato YYYY-MM-DD explícito
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-')
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  }

  // Tenta formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split('/')
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  // Fallback para construtor padrão (ISO)
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}
