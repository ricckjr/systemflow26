import { describe, it, expect } from 'vitest'
import { normalizeSearchText } from '@/utils/search'

describe('Search Utils', () => {
  it('normaliza acentos e caixa', () => {
    expect(normalizeSearchText('Válvula')).toBe('valvula')
    expect(normalizeSearchText('calibração')).toBe('calibracao')
    expect(normalizeSearchText('  Medidor Ultrassônico 2"  ')).toBe('medidor ultrassonico 2"')
  })

  it('permite busca por trecho no meio/fim', () => {
    const txt = normalizeSearchText('Medidor Ultrassônico 2"')
    expect(txt.includes(normalizeSearchText('ultra'))).toBe(true)
    expect(txt.includes(normalizeSearchText('sonico'))).toBe(true)
    expect(txt.includes(normalizeSearchText('2"'))).toBe(true)
    expect(txt.includes(normalizeSearchText('dor'))).toBe(true)
  })
})

