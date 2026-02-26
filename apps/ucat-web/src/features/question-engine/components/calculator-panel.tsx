import { Calculator, Sigma } from 'lucide-react'
import { useEffect } from 'react'
import { UcatFloatingPanel } from '@altitutor/ui'
import { useUcatCalculator } from '@/features/question-engine/hooks/use-ucat-calculator'
import { useDraggablePanel } from '@/features/question-engine/hooks/use-draggable-panel'

const ROWS_1_4: string[][] = [
  ['+/-', 'sqrt', '%', '÷'],
  ['MRC', 'M-', 'M+', '×'],
  ['7', '8', '9', '-'],
  ['4', '5', '6', '+'],
]
const ROW_5_LEFT = ['1', '2', '3']
const ROW_6_LEFT = ['ON/C', '0', '.']

const BUTTON_BASE =
  'flex min-h-[36px] w-full items-center justify-center rounded-[4px] border border-[#414042] text-center font-semibold shadow-[0_1px_0_rgba(0,0,0,0.4)]'

function CalcButton({
  label,
  onKey,
}: {
  label: string
  onKey: (label: string) => void
}) {
  const isNumberOrDot = /^[0-9.]$/.test(label)
  const variant = isNumberOrDot
    ? 'bg-[#F5F5F5] text-black text-[12pt]'
    : 'bg-[#DE1F2A] text-white text-[10pt]'
  return (
    <button
      type="button"
      onClick={() => onKey(label)}
      className={`${BUTTON_BASE} ${variant}`}
    >
      {label === 'sqrt' ? '√' : label}
    </button>
  )
}

export function CalculatorPanel({ onClose }: { onClose: () => void }) {
  const { display, onKey } = useUcatCalculator()
  const { position, handleMouseDown } = useDraggablePanel()

  // Allow typing directly into the calculator when it is open
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || event.ctrlKey) {
        return
      }

      let label: string | null = null

      if (/^[0-9]$/.test(event.key)) {
        label = event.key
      } else {
        switch (event.key) {
          case '.':
            label = '.'
            break
          case '+':
            label = '+'
            break
          case '-':
            label = '-'
            break
          case '*':
          case 'x':
          case 'X':
            label = '×'
            break
          case '/':
            label = '÷'
            break
          case 'Enter':
          case '=':
            label = '='
            break
          default:
            break
        }
      }

      if (!label) {
        return
      }

      event.preventDefault()
      onKey(label)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onKey])

  return (
    <div
      className="pointer-events-auto fixed right-4 top-24 z-40"
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
    >
      <UcatFloatingPanel
        title="Calculator"
        titleIcon={<Calculator className="h-5 w-5" />}
        onClose={onClose}
        onDragMouseDown={handleMouseDown}
        className="w-[280px]"
      >
        <div className="rounded-[12px] border border-black/60 bg-[#507ABD] px-3 pb-4 pt-5 shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
          <div className="mb-3 rounded-[3px] border border-[#E4E5E6] bg-[#C5CEBD] px-2 pt-1 text-right font-mono text-[20px] leading-none text-black shadow-inner">
            {display}
          </div>
          <div className="mb-3 flex items-center justify-center gap-1 text-[9px] font-semibold tracking-wide text-white">
            <Sigma className="h-3 w-3" />
            <span>Texas Instruments TI-108</span>
          </div>
          <div
            className="grid grid-cols-4 gap-1.5 text-[12pt]"
            style={{ gridAutoRows: 'minmax(36px, 1fr)' }}
          >
            {ROWS_1_4.flat().map((label) => (
              <CalcButton key={label} label={label} onKey={onKey} />
            ))}
            {ROW_5_LEFT.map((label) => (
              <CalcButton key={label} label={label} onKey={onKey} />
            ))}
            <button
              type="button"
              onClick={() => onKey('=')}
              className={`col-start-4 row-start-5 row-span-2 min-h-0 ${BUTTON_BASE} bg-[#DE1F2A] text-[10pt] font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.4)]`}
            >
              =
            </button>
            {ROW_6_LEFT.map((label) => (
              <CalcButton key={label} label={label} onKey={onKey} />
            ))}
          </div>
        </div>
      </UcatFloatingPanel>
    </div>
  )
}
