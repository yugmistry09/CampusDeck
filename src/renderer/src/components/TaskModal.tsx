import React, { useState, useEffect } from 'react'
import { X, Calendar, AlertCircle, Paperclip, FileText, Tag, Plus, Trash2 } from 'lucide-react'
import type {
  TaskRow,
  TaskWithSubject,
  TaskType,
  TaskPriority,
  TaskStatus,
  SubjectRow,
  TaskCreateInput,
  TaskUpdateInput,
  TaskDocumentRole
} from '@shared/types'
import { FileDropzone, type DroppedFileInfo } from './FileDropzone'

interface TaskModalProps {
  isOpen: boolean
  task?: TaskRow | TaskWithSubject | null
  defaultSubjectId?: string | null
  onClose: () => void
  onSaved: (task: TaskRow) => void
}

const TASK_TYPES: { value: TaskType; label: string; isAcademic: boolean }[] = [
  { value: 'assignment', label: 'Assignment', isAcademic: true },
  { value: 'lab_manual', label: 'Lab Manual', isAcademic: true },
  { value: 'practical', label: 'Practical', isAcademic: true },
  { value: 'project', label: 'Project', isAcademic: true },
  { value: 'exam_prep', label: 'Exam Prep', isAcademic: true },
  { value: 'general', label: 'General Task', isAcademic: false },
  { value: 'other', label: 'Other', isAcademic: false }
]

const PRIORITIES: { value: TaskPriority; label: string; badgeClass: string }[] = [
  { value: 'low', label: 'Low', badgeClass: 'text-slate-600 bg-slate-100 dark:bg-slate-800' },
  { value: 'medium', label: 'Medium', badgeClass: 'text-amber-700 bg-amber-50 dark:bg-amber-950/50' },
  { value: 'high', label: 'High', badgeClass: 'text-rose-700 bg-rose-50 dark:bg-rose-950/50' }
]

const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' }
]

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  task,
  defaultSubjectId,
  onClose,
  onSaved
}) => {
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [title, setTitle] = useState('')
  const [type, setType] = useState<TaskType>('assignment')
  const [subjectId, setSubjectId] = useState<string>('')
  const [dueDate, setDueDate] = useState<string>('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [description, setDescription] = useState('')

  interface StagedFile {
    id: string
    filePath: string
    fileName: string
    fileSize?: number
    role: TaskDocumentRole
    variantLabel?: string
    // For drag-and-dropped files that don't have a native file path
    file?: File
    arrayBuffer?: ArrayBuffer
  }

  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load subject list for dropdown
  useEffect(() => {
    if (isOpen && window.campusDeckAPI?.subjects?.list) {
      window.campusDeckAPI.subjects
        .list()
        .then(setSubjects)
        .catch(console.error)
    }
  }, [isOpen])

  // Reset or fill form when task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setType(task.type)
      setSubjectId(task.subject_id ?? '')
      setDueDate(task.due_date ?? '')
      setPriority(task.priority)
      setStatus(task.status)
      setDescription(task.description || '')
    } else {
      setTitle('')
      setType('assignment')
      setSubjectId(defaultSubjectId ?? '')
      setDueDate('')
      setPriority('medium')
      setStatus('todo')
      setDescription('')
    }
    setStagedFiles([])
    setError(null)
  }, [task, defaultSubjectId, isOpen])

  const handleFilesAdded = (files: DroppedFileInfo[]) => {
    const defaultRole: TaskDocumentRole =
      type === 'assignment' || type === 'lab_manual' ? 'assignment_file' : 'reference'

    // Accept files from both the native file dialog (have a path) and drag-and-drop
    // (have a File object / arrayBuffer but no path). Drag-dropped files will be
    // imported via blob when the task is saved.
    const newStaged: StagedFile[] = files
      .filter((f) => f.path || f.file || f.arrayBuffer)
      .map((f) => ({
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        filePath: f.path || '',
        fileName: f.name,
        fileSize: f.size,
        role: defaultRole,
        variantLabel: '',
        file: f.file,
        arrayBuffer: f.arrayBuffer
      }))

    if (newStaged.length > 0) {
      setStagedFiles((prev) => [...prev, ...newStaged])
    } else {
      setError('Could not process dropped files. Please ensure they are local files.')
    }
  }

  const handlePickFilesToStage = async () => {
    try {
      const res = await window.campusDeckAPI.files.pickFiles({
        allowMultiple: true,
        title: 'Select File(s) to Attach to Task'
      })
      if (!res.canceled && res.files) {
        handleFilesAdded(
          res.files.map((f) => ({
            path: f.filePath,
            name: f.fileName,
            size: f.fileSize
          }))
        )
      }
    } catch (err) {
      console.error('Failed to pick files:', err)
    }
  }

  const handleRemoveStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const importStagedFile = async (taskId: string, file: StagedFile) => {
    const variantLabel =
      file.role === 'solution' && file.variantLabel?.trim()
        ? file.variantLabel.trim()
        : null

    // Drag-and-dropped files have no native path; import them via blob.
    if (file.arrayBuffer) {
      await window.campusDeckAPI.taskDocs.importFromBlob({
        taskId,
        role: file.role,
        variantLabel,
        customDisplayName: file.fileName,
        files: [{
          name: file.fileName,
          mimeType: file.file?.type || '',
          arrayBuffer: file.arrayBuffer
        }]
      })
    } else if (file.filePath) {
      await window.campusDeckAPI.taskDocs.selectAndImport({
        taskId,
        filePaths: [file.filePath],
        role: file.role,
        variantLabel,
        customDisplayName: file.fileName
      })
    } else {
      throw new Error(`Cannot import "${file.fileName}": no file path or data available.`)
    }
  }

  const handleUpdateStagedRole = (id: string, newRole: TaskDocumentRole) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, role: newRole } : f))
    )
  }

  const handleUpdateStagedVariant = (id: string, variant: string) => {
    setStagedFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, variantLabel: variant } : f))
    )
  }

  if (!isOpen) return null

  const isEditing = Boolean(task)
  const currentTypeConfig = TASK_TYPES.find((t) => t.value === type)
  const showAcademicSubjectNotice = currentTypeConfig?.isAcademic && !subjectId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Task title is required.')
      return
    }

    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      setError('Due date must be in YYYY-MM-DD format.')
      return
    }

    setIsSubmitting(true)

    try {
      if (isEditing && task) {
        const updateInput: TaskUpdateInput = {
          id: task.id,
          title: trimmedTitle,
          type,
          subject_id: subjectId || null,
          due_date: dueDate || null,
          priority,
          status,
          description: description.trim()
        }
        const updated = await window.campusDeckAPI.tasks.update(updateInput)
        if (updated) {
          if (stagedFiles.length > 0) {
            for (const file of stagedFiles) {
              try {
                await importStagedFile(updated.id, file)
              } catch (importErr) {
                console.error('Failed to attach file to updated task:', importErr)
              }
            }
          }
          onSaved(updated)
          onClose()
        }
      } else {
        const createInput: TaskCreateInput = {
          title: trimmedTitle,
          type,
          subject_id: subjectId || null,
          due_date: dueDate || null,
          priority,
          status,
          description: description.trim()
        }
        const created = await window.campusDeckAPI.tasks.create(createInput)
        if (created && stagedFiles.length > 0) {
          for (const file of stagedFiles) {
            try {
              await importStagedFile(created.id, file)
            } catch (importErr) {
              console.error('Failed to attach file to newly created task:', importErr)
            }
          }
        }
        onSaved(created)
        onClose()
      }
    } catch (err) {
      console.error('Failed to save task:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while saving the task.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {isEditing ? 'Edit Task' : 'New Academic Task'}
            </h3>
            <p className="text-xs text-slate-500">
              {isEditing
                ? 'Update task status, due date, or coursework details'
                : 'Unified single-source record in your SQLite vault'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Task Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Problem Set 3, Chemistry Lab 4 Report"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Type & Subject in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Work Item Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as TaskType)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Associated Subject
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">(No Subject / General)</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code ? `${sub.code} - ${sub.name}` : sub.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Academic type advisory note */}
          {showAcademicSubjectNotice && (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Academic items like <strong>{currentTypeConfig?.label}</strong> are typically
                linked to a subject. You can still save without one if this is independent study.
              </span>
            </div>
          )}

          {/* Due Date & Priority in 2 columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Due Date (Optional)</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label} Priority
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status (shown for both create and edit) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Status
            </label>
            <div className="grid grid-cols-3 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    status === s.value
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Notes
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Requirements, problem numbers, or submission instructions..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Attachments & Coursework Files (Optional) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                <span>Coursework Files & Attachments</span>
                {stagedFiles.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                    {stagedFiles.length}
                  </span>
                )}
              </label>

              <button
                type="button"
                onClick={handlePickFilesToStage}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-1 border border-indigo-200 dark:border-indigo-800/60"
              >
                <Plus className="w-3 h-3" />
                <span>Attach File</span>
              </button>
            </div>

            {/* Staged files list */}
            {stagedFiles.length > 0 && (
              <div className="space-y-2">
                {stagedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate" title={file.fileName}>
                          {file.fileName}
                        </span>
                        {file.fileSize ? (
                          <span className="text-[10px] text-slate-400 shrink-0">
                            ({(file.fileSize / 1024).toFixed(0)} KB)
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveStagedFile(file.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-[10px] text-slate-500 font-medium">Role:</span>
                      <select
                        value={file.role}
                        onChange={(e) => handleUpdateStagedRole(file.id, e.target.value as TaskDocumentRole)}
                        className="px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="assignment_file">Assignment / Prompt</option>
                        <option value="solution">Solution Variant</option>
                        <option value="reference">Reference Material</option>
                        <option value="other">Other</option>
                      </select>

                      {file.role === 'solution' && (
                        <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                          <Tag className="w-3 h-3 text-emerald-500 shrink-0" />
                          <input
                            type="text"
                            value={file.variantLabel || ''}
                            onChange={(e) => handleUpdateStagedVariant(file.id, e.target.value)}
                            placeholder="Variant label (e.g. Draft 1)"
                            className="w-full px-2 py-0.5 rounded text-[11px] border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dropzone area (dashed box, also clickable) */}
            <FileDropzone
              title="Drag & drop coursework files here, or click to attach"
              subtitle="Assignments, question sheets, lab guides, or solutions"
              allowMultiple={true}
              onClickBrowse={handlePickFilesToStage}
              onFilesSelected={handleFilesAdded}
              className="py-4"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
