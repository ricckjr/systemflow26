import React, { useEffect, useMemo, useRef } from 'react'

type Props = React.HTMLAttributes<HTMLDivElement> & {
  lockHorizontalWheel?: boolean
}

function normalizeWheelDelta(delta: number, deltaMode: number, target: HTMLElement) {
  if (deltaMode === 1) return delta * 16
  if (deltaMode === 2) return delta * target.clientHeight
  return delta
}

function findVerticalScrollTarget(from: HTMLElement): HTMLElement | null {
  const canScroll = (el: HTMLElement) => {
    if (el.scrollHeight <= el.clientHeight + 1) return false
    const style = window.getComputedStyle(el)
    const overflowY = style.overflowY
    return overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
  }

  let node: HTMLElement | null = from.parentElement
  while (node) {
    if (canScroll(node)) return node
    node = node.parentElement
  }
  return (document.scrollingElement as HTMLElement | null) || null
}

export function HorizontalScrollArea({
  lockHorizontalWheel = true,
  className,
  style,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null)

  const mergedStyle = useMemo<React.CSSProperties>(() => {
    return { scrollbarGutter: 'stable', ...style }
  }, [style])

  useEffect(() => {
    const el = ref.current
    if (!el || !lockHorizontalWheel) return

    const onWheel = (e: WheelEvent) => {
      if (e.defaultPrevented) return
      if (e.ctrlKey) return

      const hasHorizontalIntent = e.shiftKey || e.deltaX !== 0
      if (!hasHorizontalIntent) return

      const deltaForY = e.shiftKey && e.deltaY === 0 ? e.deltaX : e.deltaY
      e.preventDefault()

      const target = findVerticalScrollTarget(el) || el
      target.scrollTop += normalizeWheelDelta(deltaForY, e.deltaMode, target)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [lockHorizontalWheel])

  return <div ref={ref} className={className} style={mergedStyle} {...rest} />
}

