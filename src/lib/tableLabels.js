// On a phone, every table row is shown as a small card ("Person: Suresh", "Principal: ₹50,000", ...).
// The card needs to know which column each cell belongs to, so this adds a data-label (the column heading) to
// every cell, and marks the rows that hold an opened panel (colspan) so they join the card above them.
// It only sets attributes, so React is never disturbed. It runs again whenever the page changes.
import { useEffect } from 'react'

export function headerLabels(table) {
  return Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
}

export function labelTables(root) {
  for (const table of root.querySelectorAll('table')) {
    const labels = headerLabels(table)
    for (const tr of table.querySelectorAll('tbody tr')) {
      const cells = Array.from(tr.children)
      if (cells.length === 1 && (cells[0].colSpan || 1) > 1) {
        if (tr.getAttribute('data-expansion') !== 'true') tr.setAttribute('data-expansion', 'true')
        continue
      }
      cells.forEach((cell, i) => {
        const label = labels[i] ?? ''
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label)
      })
    }
  }
}

export function useTableLabels() {
  useEffect(() => {
    const root = document.getElementById('root') || document.body
    let frame = 0
    const run = () => {
      frame = 0
      labelTables(root)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run)
    }
    run()
    const observer = new MutationObserver(schedule)
    observer.observe(root, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
}
