import React, { useState, useRef } from 'react'
import { UploadCloud } from 'lucide-react'

export interface DroppedFileInfo {
  path?: string
  name: string
  size: number
  file?: File
  arrayBuffer?: ArrayBuffer
}

interface FileDropzoneProps {
  onFilesSelected: (files: DroppedFileInfo[]) => void
  onClickBrowse?: () => void
  acceptText?: string
  title?: string
  subtitle?: string
  allowMultiple?: boolean
  disabled?: boolean
  className?: string
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFilesSelected,
  onClickBrowse,
  acceptText = 'PDF, Images, Office (Word, Excel, PPT), or Text',
  title = 'Drag & drop file(s) here, or click to browse',
  subtitle = 'Files are safely stored in your offline vault without touching the original',
  allowMultiple = true,
  disabled = false,
  className = ''
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled) return

    const dropped = Array.from(e.dataTransfer.files)
    if (dropped.length === 0) return

    const filesToProcess = allowMultiple ? dropped : [dropped[0]!]
    
    // Add a small delay to allow UI to show loading state if it was triggered
    await new Promise((resolve) => setTimeout(resolve, 50))

    const fileInfos: DroppedFileInfo[] = await Promise.all(
      filesToProcess.map(async (f) => {
        let arrayBuffer: ArrayBuffer | undefined
        try {
          // Add a timeout for reading the file
          const readPromise = f.arrayBuffer()
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('File reading timeout')), 5000)
          )
          
          arrayBuffer = await Promise.race([readPromise, timeoutPromise]) as ArrayBuffer
        } catch (err) {
          console.warn('[FileDropzone] Failed to read file as ArrayBuffer:', f.name, err)
        }
        return {
          path: (f as any).path || '',
          name: f.name,
          size: f.size,
          file: f,
          arrayBuffer
        }
      })
    )

    onFilesSelected(fileInfos)
  }

  const handleClick = () => {
    if (disabled) return
    if (onClickBrowse) {
      onClickBrowse()
    } else {
      fileInputRef.current?.click()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : []
    if (selected.length === 0) return

    const fileInfos: DroppedFileInfo[] = selected.map((f) => ({
      path: (f as any).path || '',
      name: f.name,
      size: f.size,
      file: f
    }))

    onFilesSelected(fileInfos)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
        disabled
          ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
          : isDragging
          ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 shadow-inner scale-[1.01]'
          : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-slate-800/40'
      } ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple={allowMultiple}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-200 ${
            isDragging
              ? 'bg-indigo-600 text-white scale-110 shadow-md'
              : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 group-hover:scale-105'
          }`}
        >
          <UploadCloud className="w-5 h-5" />
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {isDragging ? 'Release to drop files here' : title}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 max-w-sm mx-auto">
            {subtitle}
          </p>
        </div>

        <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60">
          Supports {acceptText}
        </span>
      </div>
    </div>
  )
}
