import { Calculator, Sigma, X } from 'lucide-react'
import { UcatFloatingPanel } from '@altitutor/ui'
import { useUcatCalculator } from '@/features/question-engine/hooks/use-ucat-calculator'

const calculatorKeys = [
  ['+/-', 'sqrt', '%', '÷'],
  ['MRC', 'M-', 'M+', '×'],
  ['7', '8', '9', '-'],
  ['4', '5', '6', '+'],
  ['1', '2', '3', '='],
  ['ON/C', '0', '.'],
]

export function CalculatorPanel({ onClose }: { onClose: () => void }) {
  const { display, onKey } = useUcatCalculator()

  return (
    <UcatFloatingPanel
      title="Calculator"
      titleIcon={<Calculator className="h-5 w-5" />}
      onClose={onClose}
      className="w-full max-w-sm"
    >
      <div className="space-y-3 rounded border-2 border-[#2b4d78] bg-[#5a84bf] p-3">
        <div className="rounded border border-[#5d6c82] bg-[#efefef] p-3 text-right font-mono text-2xl text-black">{display}</div>
        <div className="flex items-center justify-center gap-2 text-lg text-white">
          <Sigma className="h-4 w-4" />
          <span>Texas Instruments TI-108</span>
        </div>
        <div className="space-y-2">
          {calculatorKeys.map((row) => (
            <div key={row.join('-')} className="grid grid-cols-4 gap-2">
              {row.map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => onKey(label)}
                  className={
                    label.match(/^[0-9.]$/)
                      ? 'rounded bg-[#ececec] px-2 py-2 text-lg text-black'
                      : 'rounded bg-[#e31f2f] px-2 py-2 text-lg text-white'
                  }
                >
                  {label === 'sqrt' ? '√' : label}
                </button>
              ))}
              {row.length === 3 ? (
                <button
                  type="button"
                  className="rounded border border-[#1e3d64] bg-[#3a6ca8] px-2 py-2 text-lg text-white"
                  onClick={onClose}
                >
                  <X className="mx-auto h-5 w-5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </UcatFloatingPanel>
  )
}
