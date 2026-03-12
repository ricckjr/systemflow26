import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '@/utils/comercial/format'
import { ArrowRight, ChevronRight, Filter } from 'lucide-react'

export interface FunnelStageData {
  id: string
  label: string
  count: number
  value: number
  color: string
  hideValue?: boolean
}

interface FunnelVendasProps {
  data: FunnelStageData[]
  className?: string
  onStageClick?: (stageId: string) => void
}

const FunnelVendas: React.FC<FunnelVendasProps> = ({ data, className = '', onStageClick }) => {
  const navigate = useNavigate()

  // Calculate conversion rates (relative to previous stage)
  const enrichedData = useMemo(() => {
    return data.map((stage, index) => {
      const prevStage = index > 0 ? data[index - 1] : null
      const conversionRate = prevStage && prevStage.count > 0 
        ? (stage.count / prevStage.count) * 100 
        : index === 0 ? 100 : 0 

      return {
        ...stage,
        conversionRate
      }
    })
  }, [data])

  const handleStageClick = (stageId: string) => {
    if (onStageClick) {
      onStageClick(stageId)
    } else {
      navigate(`/app/crm/oportunidades?fase=${stageId.toLowerCase()}`)
    }
  }

  // Mobile View Component (List with Progress Bars)
  const MobileView = () => (
    <div className="flex flex-col gap-4 md:hidden w-full">
      {enrichedData.map((stage, index) => {
        const percent = enrichedData[0].count > 0 ? (stage.count / enrichedData[0].count) * 100 : 0
        
        return (
          <div 
            key={stage.id}
            onClick={() => handleStageClick(stage.id)}
            className="bg-[var(--bg-panel)] border border-[var(--border)] rounded-xl p-4 cursor-pointer active:scale-95 transition-transform"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-[var(--text-main)] flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                {stage.label}
              </span>
              <ChevronRight size={16} className="text-[var(--text-muted)]" />
            </div>
            
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-[var(--text-main)]">{stage.count} ops</span>
              {!stage.hideValue && (
                <span className="font-bold text-[var(--text-main)]">{formatCurrency(stage.value)}</span>
              )}
            </div>
            
            <div className="w-full h-2 bg-[var(--bg-body)] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, percent)}%`, backgroundColor: stage.color }}
              />
            </div>
            
            {index > 0 && (
              <div className="mt-2 text-xs text-[var(--text-muted)] text-right">
                {stage.conversionRate.toFixed(0)}% conversão
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  // Desktop View Component (SVG Funnel)
  const DesktopView = () => (
    <div className="hidden md:flex flex-col items-center justify-center w-full max-w-5xl mx-auto py-6">
      <div className="w-full flex flex-col gap-1.5 relative">
        {enrichedData.map((stage, index) => {
          // Calculate width for funnel effect
          // Start wide (100%), end narrow (40%)
          // 5 stages: 100%, 85%, 70%, 55%, 40%
          const topWidth = 100 - (index * 15)
          const bottomWidth = 100 - ((index + 1) * 15)
          
          return (
            <div 
              key={stage.id} 
              className="relative group h-20 w-full flex items-center justify-center cursor-pointer transition-transform hover:scale-[1.01] z-10 hover:z-20"
              onClick={() => handleStageClick(stage.id)}
            >
              {/* Funnel Layer Shape (CSS Clip Path for Trapezoid) */}
              <div 
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 shadow-lg transition-all duration-300 group-hover:shadow-xl group-hover:brightness-110 flex items-center justify-center"
                style={{
                  width: `${Math.max(30, topWidth)}%`,
                  backgroundColor: stage.color,
                  clipPath: `polygon(
                    0% 0%, 
                    100% 0%, 
                    ${100 - ((topWidth - bottomWidth) / (2 * topWidth)) * 100}% 100%, 
                    ${((topWidth - bottomWidth) / (2 * topWidth)) * 100}% 100%
                  )`,
                  // Note: Clip-path percentages are relative to the element's box.
                  // Since we change the width of the container, a simpler clip path works better:
                  // Top corners (0,0) and (100,0)
                  // Bottom corners are inset to create the trapezoid relative to the width.
                  // Actually, strictly stacking divs with decreasing widths is easier and cleaner for text centering.
                  // Let's retry the style strategy below for simpler CSS.
                }}
              />
              
              {/* Alternative Strategy: Just a centered div with decreasing width and perspective transform or simple borders?
                 The prompt asks for a "funnel shape". 
                 Let's use a standard div with tapered sides via clip-path.
              */}
              
              <div 
                className="absolute inset-0 flex items-center justify-center z-0"
              >
                 <div 
                    className="h-full shadow-lg transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(0,0,0,0.2)] group-hover:brightness-105"
                    style={{
                        width: `${Math.max(40, 90 - (index * 12))}%`, // decreasing width
                        backgroundColor: stage.color,
                        clipPath: 'polygon(2% 0%, 98% 0%, 90% 100%, 10% 100%)', // Symmetrical trapezoid
                        borderRadius: '0px'
                    }}
                 />
              </div>

              {/* Content */}
              <div className="relative z-10 flex flex-col items-center justify-center text-white drop-shadow-md pointer-events-none">
                <span className="text-sm md:text-base font-bold uppercase tracking-wide opacity-95">
                  {stage.label}
                </span>
                <div className="flex items-center gap-3 mt-0.5">
                   <span className="text-xs md:text-sm font-medium bg-black/20 px-2 py-0.5 rounded backdrop-blur-sm">
                     {stage.count} <span className="opacity-70 text-[10px]">ops</span>
                   </span>
                   {!stage.hideValue && (
                     <span className="text-xs md:text-sm font-bold bg-black/20 px-2 py-0.5 rounded backdrop-blur-sm">
                       {formatCurrency(stage.value)}
                     </span>
                   )}
                </div>
              </div>

              {/* Right Arrow / Conversion - Positioned absolutely to the right of the funnel shape */}
              <div className="absolute right-[5%] top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                {/* Connecting Line */}
                <div className="h-[2px] w-8 md:w-16 lg:w-24 bg-gradient-to-r from-gray-400/50 to-gray-400" />
                
                {/* Arrow Head */}
                <div 
                  className="px-3 py-1.5 rounded relative flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: stage.color }}
                >
                  {/* Triangle for arrow tip */}
                  <div 
                    className="absolute -right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px]"
                    style={{ borderLeftColor: stage.color }}
                  />
                  
                  <span className="text-xs font-bold text-white whitespace-nowrap">
                    {index === 0 ? 'Início' : `${stage.conversionRate.toFixed(0)}% Conv.`}
                  </span>
                </div>
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className={`w-full ${className}`}>
      <MobileView />
      <DesktopView />
    </div>
  )
}

export default FunnelVendas
