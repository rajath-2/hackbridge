"use client"

import * as React from "react"
import { useState, useRef, useCallback } from "react"
import { Button } from "./button"
import { api } from "@/lib/api"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { FileUp, FileText, CheckCircle, AlertCircle, RefreshCw } from "lucide-react"

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface ResumeAnalysis {
  expertise_tags?: string[]
  domain?: string
  bio?: string
}

export interface ResumeUploadProps {
  role: "mentor" | "judge"
  eventId?: string
  onUploadComplete?: (analysis: ResumeAnalysis) => void
  existingProfile?: {
    expertise_tags?: string[]
    bio?: string
    domain?: string
    resume_raw?: string
  }
  className?: string
}

type UploadState = "idle" | "dragging" | "uploading" | "success" | "error"

export function ResumeUpload({ role, eventId, onUploadComplete, existingProfile, className }: ResumeUploadProps) {
  const [state, setState] = useState<UploadState>(existingProfile?.resume_raw ? "success" : "idle")
  const [fileName, setFileName] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(
    existingProfile?.expertise_tags || existingProfile?.domain
      ? {
          expertise_tags: existingProfile.expertise_tags,
          domain: existingProfile.domain,
          bio: existingProfile.bio,
        }
      : null
  )
  const [errorMessage, setErrorMessage] = useState("")
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") {
      setState("error")
      setErrorMessage("Only PDF files are supported")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setState("error")
      setErrorMessage("File size must be under 10MB")
      return
    }

    setFileName(file.name)
    setState("uploading")
    setErrorMessage("")
    setProgress(0)

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return 90
        }
        return prev + Math.random() * 15
      })
    }, 400)

    try {
      const url = `/users/resume${eventId ? `?event_id=${eventId}` : ""}`
      const result = await api.uploadFile(url, file)
      clearInterval(progressInterval)
      setProgress(100)

      const analysisData = result.analysis as ResumeAnalysis
      setAnalysis(analysisData)
      setState("success")
      onUploadComplete?.(analysisData)
    } catch (err: any) {
      clearInterval(progressInterval)
      setState("error")
      setErrorMessage(err.message || "Upload failed. Please try again.")
    }
  }, [onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setState("idle")

    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setState("dragging")
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setState(prev => prev === "dragging" ? "idle" : prev)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const handleReupload = () => {
    setState("idle")
    setAnalysis(null)
    setFileName(null)
    setErrorMessage("")
    setProgress(0)
  }

  const signalColor = role === "mentor" ? "var(--signal-alert)" : "var(--signal-ping)"

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between">
        <div className="t-micro uppercase opacity-50 tracking-widest">
          Credential_Stream
        </div>
        {state === "success" && (
          <span className="t-micro px-1.5 py-0.5 bg-[var(--signal-live)]/10 text-[var(--signal-live)] border border-[var(--signal-live)]/30 rounded-[2px] uppercase font-bold">
            Analyzed
          </span>
        )}
      </div>

      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] overflow-hidden">
        {/* Upload Zone */}
        {(state === "idle" || state === "dragging" || state === "error") && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center py-10 px-6 cursor-pointer transition-all duration-200 border-2 border-dashed m-2",
              state === "dragging"
                ? "border-[var(--signal-info)] bg-[var(--signal-info)]/5"
                : "border-[var(--border)] hover:border-[var(--signal-info)] hover:bg-white/5",
              state === "error" && "border-[var(--signal-alert)] bg-[var(--signal-alert)]/5"
            )}
          >
            <div className="mb-4 text-[var(--text-muted)] group-hover:text-[var(--signal-info)] transition-colors">
              <FileUp size={32} strokeWidth={1.5} />
            </div>

            <div className="t-section uppercase mb-1">
              {state === "dragging" ? "Release to Scan" : "Upload Credentials"}
            </div>
            <div className="t-micro uppercase opacity-30 text-center max-w-[240px]">
              Drag & Drop PDF or Click to Select <br /> (Max 10MB Protocol)
            </div>

            {state === "error" && (
              <div className="mt-4 flex items-center gap-2 text-[var(--signal-alert)] t-micro uppercase font-bold">
                <AlertCircle size={12} />
                {errorMessage}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* Uploading State */}
        {state === "uploading" && (
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="relative w-16 h-16 mb-6">
              <svg className="animate-spin -rotate-90" width="64" height="64" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle
                  cx="32" cy="32" r="28" fill="none"
                  stroke={signalColor}
                  strokeWidth="4"
                  strokeDasharray="176"
                  strokeDashoffset={176 - (176 * progress) / 100}
                  strokeLinecap="square"
                  style={{ transition: "stroke-dashoffset 0.3s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center t-code text-[12px]">
                {Math.round(progress)}%
              </div>
            </div>

            <div className="t-section uppercase mb-1">Scanning Node...</div>
            <div className="t-micro uppercase opacity-30">
              {fileName} · Extracting Entities
            </div>

            <div className="w-full max-w-[280px] h-[2px] bg-white/5 mt-6 overflow-hidden">
              <div
                className="h-full bg-[var(--signal-info)] transition-all duration-300 ease-out shadow-[0_0_8px_var(--signal-info)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Success State - Analysis Results */}
        {state === "success" && analysis && (
          <div className="p-6 flex flex-col gap-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/5 border border-[var(--border)] flex items-center justify-center">
                  <FileText size={20} className="text-[var(--signal-live)]" />
                </div>
                <div>
                  <div className="t-section uppercase text-[var(--text-primary)]">
                    {fileName || "Identity_Verified"}
                  </div>
                  <div className="t-micro uppercase opacity-30">
                    Llama3 · 70B Entity Extraction
                  </div>
                </div>
              </div>
              <Button onClick={handleReupload} className="h-8 bg-white/5 border border-[var(--border)] t-micro uppercase hover:bg-white/10 px-3">
                <RefreshCw size={12} className="mr-2" />
                Rescan
              </Button>
            </div>

            {/* Expertise Tags */}
            {analysis.expertise_tags && analysis.expertise_tags.length > 0 && (
              <div className="space-y-3">
                <div className="t-micro uppercase opacity-30 tracking-[0.2em]">Expertise_Vectors</div>
                <div className="flex flex-wrap gap-2">
                  {analysis.expertise_tags.map((tag, i) => (
                    <span key={i} className="t-micro px-2 py-1 bg-white/5 border border-[var(--border)] uppercase font-bold tracking-wider">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bio */}
            {analysis.bio && (
              <div className="space-y-3">
                <div className="t-micro uppercase opacity-30 tracking-[0.2em]">AI_Profile_Summary</div>
                <div className="p-4 bg-[var(--surface-2)] border-l-2 border-[var(--signal-info)] font-body text-[13px] leading-relaxed italic text-[var(--text-secondary)]">
                  &ldquo;{analysis.bio}&rdquo;
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2 t-micro uppercase text-[var(--signal-live)] font-bold">
              <CheckCircle size={14} />
              Operational History Validated
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
