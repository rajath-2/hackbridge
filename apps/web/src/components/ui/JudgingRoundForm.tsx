"use client"

import * as React from "react"
import { Input } from "./input"
import { Button } from "./button"
import { Plus, Trash2, Calendar, Award } from "lucide-react"

export interface RubricCriterion {
  name: string
  description: string
  weight: number
}

export interface JudgingRound {
  round: number
  start?: string
  end?: string
  criteria: RubricCriterion[]
}

interface JudgingRoundFormProps {
  data: JudgingRound
  onChange: (data: JudgingRound) => void
  onRemove: () => void
}

export function JudgingRoundForm({ data, onChange, onRemove }: JudgingRoundFormProps) {
  const addCriterion = () => {
    onChange({
      ...data,
      criteria: [...data.criteria, { name: "", description: "", weight: 1.0 }]
    })
  }

  const removeCriterion = (index: number) => {
    const newCriteria = [...data.criteria]
    newCriteria.splice(index, 1)
    onChange({ ...data, criteria: newCriteria })
  }

  const updateCriterion = (index: number, field: keyof RubricCriterion, value: string | number) => {
    const newCriteria = [...data.criteria]
    newCriteria[index] = { ...newCriteria[index], [field]: value }
    onChange({ ...data, criteria: newCriteria })
  }

  return (
    <div className="bg-[var(--hb-surface2)] border border-[var(--hb-border2)] rounded-[12px] p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[var(--hb-indigo-dim)] flex items-center justify-center text-[11px] font-bold text-[var(--hb-indigo-bright)]">
            {data.round}
          </div>
          <h3 className="text-[13px] font-semibold text-[var(--hb-text)]">Judging Round {data.round}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove} className="text-[var(--hb-red)] hover:bg-[var(--hb-red-dim)] hover:text-[#F9A0A0]">
          <Trash2 size={14} />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div>
          <label className="block text-[10px] text-[var(--hb-muted)] uppercase mb-1 tracking-wider">Start Time (Optional)</label>
          <div className="relative">
            <Input 
              type="datetime-local" 
              value={data.start || ""} 
              onChange={(e) => onChange({ ...data, start: e.target.value })}
              className="pl-8"
            />
            <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--hb-dim)]" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-[var(--hb-muted)] uppercase mb-1 tracking-wider">End Time (Optional)</label>
          <div className="relative">
            <Input 
              type="datetime-local" 
              value={data.end || ""} 
              onChange={(e) => onChange({ ...data, end: e.target.value })}
              className="pl-8"
            />
            <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--hb-dim)]" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <div className="text-[10px] text-[var(--hb-muted)] uppercase tracking-wider flex items-center gap-1.5">
            <Award size={12} />
            Judging Rubric
          </div>
          <Button variant="secondary" size="sm" onClick={addCriterion} className="h-6 py-0 text-[10px]">
            <Plus size={12} /> Add Criterion
          </Button>
        </div>

        {data.criteria.map((criterion, idx) => (
          <div key={idx} className="bg-[var(--hb-surface3)] border border-[var(--hb-border2)] rounded-[8px] p-3 relative group">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-8">
                <Input 
                  placeholder="Criterion Name (e.g. Technical Complexity)" 
                  value={criterion.name}
                  onChange={(e) => updateCriterion(idx, "name", e.target.value)}
                  className="mb-2"
                />
                <Input 
                  placeholder="Brief description of what judges should look for..." 
                  value={criterion.description}
                  onChange={(e) => updateCriterion(idx, "description", e.target.value)}
                  className="text-[11px] bg-transparent border-dashed"
                />
              </div>
              <div className="col-span-3">
                <label className="block text-[9px] text-[var(--hb-dim)] uppercase mb-1">Weight</label>
                <Input 
                  type="number" 
                  step="0.1"
                  value={criterion.weight}
                  onChange={(e) => updateCriterion(idx, "weight", parseFloat(e.target.value))}
                />
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <button 
                  onClick={() => removeCriterion(idx)}
                  className="text-[var(--hb-muted)] hover:text-[var(--hb-red)] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {data.criteria.length === 0 && (
          <div className="text-center py-4 border-2 border-dashed border-[var(--hb-border2)] rounded-[8px] text-[11px] text-[var(--hb-muted)]">
            No criteria added yet.
          </div>
        )}
      </div>
    </div>
  )
}

function X({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  )
}
