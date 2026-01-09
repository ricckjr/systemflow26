import { describe, it, expect } from 'vitest'
import { parseValorProposta, formatCurrency } from '../../utils/comercial/format'

describe('Format Utils', () => {
  describe('parseValorProposta', () => {
    it('should parse currency string correctly', () => {
      expect(parseValorProposta('R$ 1.234,56')).toBe(1234.56)
      expect(parseValorProposta('1.234,56')).toBe(1234.56)
      expect(parseValorProposta('1234,56')).toBe(1234.56)
    })

    it('should return 0 for invalid or empty input', () => {
      expect(parseValorProposta('')).toBe(0)
      expect(parseValorProposta(null)).toBe(0)
    })
  })

  describe('formatCurrency', () => {
    it('should format number to BRL currency', () => {
      // Note: non-breaking space might be used by Intl, so we check loose match or strip
      const formatted = formatCurrency(1234.56)
      expect(formatted).toContain('1.234,56')
      expect(formatted).toMatch(/R\$\s?1\.234,56/)
    })
  })
})
