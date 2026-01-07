import React from 'react'
import { totalPages, clampPage, canPrev, canNext } from '../../utils/pagination'

export default function Tests() {
  const results: { name: string, pass: boolean }[] = []
  const assert = (name: string, cond: boolean) => results.push({ name, pass: !!cond })
  assert('totalPages basic', totalPages(100, 25) === 4)
  assert('clampPage min', clampPage(0, 50, 10) === 1)
  assert('clampPage max', clampPage(10, 50, 10) === 5)
  assert('canPrev false at 1', canPrev(1) === false)
  assert('canNext true mid', canNext(2, 50, 10) === true)
  assert('canNext false end', canNext(5, 50, 10) === false)
  return (
    <div className="p-6 text-sm">
      <h2 className="font-black mb-4">Teste de Paginação</h2>
      <ul className="space-y-2">
        {results.map((r, i) => (
          <li key={i} className={r.pass ? 'text-emerald-500' : 'text-rose-500'}>
            {r.pass ? 'OK' : 'FAIL'} — {r.name}
          </li>
        ))}
      </ul>
    </div>
  )
}
