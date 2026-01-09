export function totalPages(total: number, pageSize: number) {
  if (pageSize <= 0) return 0
  return Math.max(1, Math.ceil(total / pageSize))
}

export function clampPage(page: number, total: number, pageSize: number) {
  const tp = totalPages(total, pageSize)
  return Math.min(tp, Math.max(1, page))
}

export function canPrev(page: number) {
  return page > 1
}

export function canNext(page: number, total: number, pageSize: number) {
  const tp = totalPages(total, pageSize)
  return page < tp
}
