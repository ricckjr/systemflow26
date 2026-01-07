export const parseValorProposta = (val: string | null) => {
  if (!val) return 0
  const clean = val.replace(/[R$\.\s]/g, '').replace(',', '.')
  return parseFloat(clean) || 0
}

export const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
