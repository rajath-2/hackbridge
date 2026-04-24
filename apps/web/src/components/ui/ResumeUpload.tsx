"use client"

import * as React from "react"
import { useState, useRef, useCallback } from "react"
import { Card } from "./card"
import { Badge } from "./badge"
import { Button } from "./button"
import { api } from "@/lib/api"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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

export function ResumeUpload({ role, onUploadComplete, existingProfile, className }: ResumeUploadProps) {
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

    // Simulate progress while waiting for response
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
      const result = await api.uploadFile("/users/resume", file)
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

  const accentColor = role === "mentor" ? "var(--hb-amber)" : "var(--hb-cyan)"
  const accentDim = role === "mentor" ? "rgba(232,160,32,0.08)" : "rgba(56,189,248,0.08)"
  const accentGlow = role === "mentor" ? "rgba(232,160,32,0.25)" : "rgba(56,189,248,0.25)"

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em]">
          Resume / Profile
        </div>
        {state === "success" && (
          <Badge variant={role === "mentor" ? "amber" : "cyan"}>
            AI Analyzed
          </Badge>
        )}
      </div>

      <Card variant="base" className="p-0 overflow-hidden">
        {/* Upload Zone */}
        {(state === "idle" || state === "dragging" || state === "error") && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center py-8 px-4 cursor-pointer transition-all duration-200 border-2 border-dashed rounded-[10px] m-1",
              state === "dragging"
                ? "border-[color:var(--accent)] bg-[color:var(--accentDim)]"
                : "border-[var(--hb-border2)] hover:border-[color:var(--accent)] hover:bg-[color:var(--accentDim)]",
              state === "error" && "border-[var(--hb-red)]"
            )}
            style={{
              "--accent": accentColor,
              "--accentDim": accentDim,
            } as React.CSSProperties}
          >
            {/* Upload Icon */}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-3 transition-transform duration-200"
              style={{
                background: accentDim,
                border: `1.5px solid ${accentGlow}`,
                transform: state === "dragging" ? "scale(1.1)" : "scale(1)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>

            <div className="text-[12px] font-medium text-[var(--hb-text)] mb-1">
              {state === "dragging" ? "Drop your PDF here" : "Upload your resume"}
            </div>
            <div className="text-[10px] text-[var(--hb-muted)] mb-3">
              Drag & drop a PDF or click to browse · Max 10MB
            </div>

            <Button
              variant={role === "mentor" ? "ghost" : "secondary"}
              size="sm"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              className="text-[11px]"
            >
              Choose PDF
            </Button>

            {state === "error" && (
              <div className="mt-3 text-[11px] text-[var(--hb-red)] font-medium animate-notif-in">
                ✕ {errorMessage}
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
          <div className="flex flex-col items-center justify-center py-8 px-4">
            {/* Animated spinner */}
            <div className="relative w-12 h-12 mb-4">
              <svg className="animate-spin" width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="var(--hb-border2)" strokeWidth="3" />
                <circle
                  cx="24" cy="24" r="20" fill="none"
                  stroke={accentColor}
                  strokeWidth="3"
                  strokeDasharray="126"
                  strokeDashoffset={126 - (126 * progress) / 100}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.3s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono" style={{ color: accentColor }}>
                {Math.round(progress)}%
              </div>
            </div>

            <div className="text-[12px] font-medium text-[var(--hb-text)] mb-1">
              Analyzing resume...
            </div>
            <div className="text-[10px] text-[var(--hb-muted)]">
              {fileName} · Extracting expertise via Groq AI
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-[240px] h-[3px] bg-[var(--hb-surface3)] rounded-full mt-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${accentColor}, ${role === "mentor" ? "#F0C060" : "#7DD3F8"})`,
                }}
              />
            </div>
          </div>
        )}

        {/* Success State - Analysis Results */}
        {state === "success" && analysis && (
          <div className="p-4 flex flex-col gap-4 animate-notif-in">
            {/* Header with file info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center"
                  style={{ background: accentDim, border: `1px solid ${accentGlow}` }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div>
                  <div className="text-[11px] font-medium text-[var(--hb-text)]">
                    {fileName || "Resume uploaded"}
                  </div>
                  <div className="text-[9px] text-[var(--hb-muted)]">
                    Processed by Groq · llama3-70b
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleReupload} className="text-[10px]">
                Re-upload
              </Button>
            </div>

            {/* Expertise Tags */}
            {analysis.expertise_tags && analysis.expertise_tags.length > 0 && (
              <div>
                <div className="text-[9px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1.5">
                  Expertise Tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.expertise_tags.map((tag, i) => (
                    <Badge key={i} variant={role === "mentor" ? "amber" : "cyan"} className="text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Domain */}
            {analysis.domain && (
              <div>
                <div className="text-[9px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1">
                  Domain
                </div>
                <div className="text-[11px] text-[var(--hb-text)] font-medium">
                  {analysis.domain}
                </div>
              </div>
            )}

            {/* Bio */}
            {analysis.bio && (
              <Card variant="ai">
                <div className="text-[10px] not-italic text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1">
                  AI-Generated Bio
                </div>
                {analysis.bio}
              </Card>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
