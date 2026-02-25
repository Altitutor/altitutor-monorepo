'use client'

import { useMemo, useState } from 'react'

type Operator = '+' | '-' | '×' | '÷'

function safeEval(a: number, b: number, operator: Operator): number {
  if (operator === '+') return a + b
  if (operator === '-') return a - b
  if (operator === '×') return a * b
  if (operator === '÷') return b === 0 ? 0 : a / b
  return b
}

function formatDisplay(value: string) {
  if (value.length <= 14) {
    return value
  }
  return Number(value).toPrecision(8)
}

export function useUcatCalculator() {
  const [display, setDisplay] = useState('0.')
  const [current, setCurrent] = useState('0')
  const [previous, setPrevious] = useState<number | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [memory, setMemory] = useState(0)
  const [fresh, setFresh] = useState(true)

  const renderedDisplay = useMemo(() => formatDisplay(display), [display])

  function setFromNumber(value: number) {
    const next = Number.isFinite(value) ? String(value) : '0'
    setCurrent(next)
    setDisplay(`${next}.`)
    setFresh(true)
  }

  function pushDigit(value: string) {
    if (fresh) {
      const next = value === '.' ? '0.' : value
      setCurrent(next)
      setDisplay(next)
      setFresh(false)
      return
    }

    if (value === '.' && current.includes('.')) {
      return
    }

    const next = `${current}${value}`
    setCurrent(next)
    setDisplay(next)
  }

  function onBinary(nextOperator: Operator) {
    const numericCurrent = Number(current)

    if (previous == null || operator == null) {
      setPrevious(numericCurrent)
    } else if (!fresh) {
      setPrevious(safeEval(previous, numericCurrent, operator))
      setCurrent(String(safeEval(previous, numericCurrent, operator)))
      setDisplay(`${safeEval(previous, numericCurrent, operator)}.`)
    }

    setOperator(nextOperator)
    setFresh(true)
  }

  function onEquals() {
    if (operator == null || previous == null) {
      return
    }

    const result = safeEval(previous, Number(current), operator)
    setFromNumber(result)
    setPrevious(null)
    setOperator(null)
  }

  function onSqrt() {
    setFromNumber(Math.sqrt(Math.max(Number(current), 0)))
  }

  function onPercent() {
    setFromNumber(Number(current) / 100)
  }

  function onSignToggle() {
    setFromNumber(Number(current) * -1)
  }

  function onClear() {
    setDisplay('0.')
    setCurrent('0')
    setPrevious(null)
    setOperator(null)
    setFresh(true)
  }

  function onMemoryAdd() {
    setMemory((value) => value + Number(current))
    setFresh(true)
  }

  function onMemorySubtract() {
    setMemory((value) => value - Number(current))
    setFresh(true)
  }

  function onMemoryRecallClear() {
    if (memory === 0) {
      return
    }

    setFromNumber(memory)
    setMemory(0)
  }

  function onKey(label: string) {
    if (/^[0-9]$/.test(label) || label === '.') {
      pushDigit(label)
      return
    }

    if (label === 'ON/C') {
      onClear()
      return
    }

    if (label === '+/-') {
      onSignToggle()
      return
    }

    if (label === 'sqrt') {
      onSqrt()
      return
    }

    if (label === '%') {
      onPercent()
      return
    }

    if (label === 'M+') {
      onMemoryAdd()
      return
    }

    if (label === 'M-') {
      onMemorySubtract()
      return
    }

    if (label === 'MRC') {
      onMemoryRecallClear()
      return
    }

    if (label === '=') {
      onEquals()
      return
    }

    if (label === '+' || label === '-' || label === '×' || label === '÷') {
      onBinary(label)
    }
  }

  return {
    display: renderedDisplay,
    onKey,
  }
}
