'use client'

import { useState } from 'react'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  Layers,
  ArrowRight,
  Loader2,
  Download,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface ImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete?: (count: number) => void
}

export function ImportModal({ open, onOpenChange, onImportComplete }: ImportModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [leadSource, setLeadSource] = useState('CSV Bulk Import')
  const [distributionStrategy, setDistributionStrategy] = useState<'round-robin' | 'unassigned' | 'specific'>('round-robin')
  const [importing, setImporting] = useState(false)
  const [previewCount, setPreviewCount] = useState(145)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx')) {
        setFile(droppedFile)
        setPreviewCount(Math.floor(Math.random() * 200) + 50)
      } else {
        toast.error('Please upload a .csv or .xlsx file')
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      setPreviewCount(Math.floor(Math.random() * 200) + 50)
    }
  }

  const handleStartImport = () => {
    setImporting(true)
    setTimeout(() => {
      setImporting(false)
      setStep(3)
      if (onImportComplete) {
        onImportComplete(previewCount)
      }
      toast.success(`${previewCount} contacts imported successfully!`)
    }, 1500)
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => {
      setStep(1)
      setFile(null)
    }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-lg">Import Contacts & CSV</DialogTitle>
              <DialogDescription>
                Bulk upload lead records and auto-distribute to telecallers
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* STEP 1: Upload File */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : file
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-border hover:border-primary/40 bg-muted/20'
              }`}
            >
              {file ? (
                <div className="space-y-2">
                  <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mx-auto">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <p className="font-semibold text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB • Detected ~{previewCount} rows
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFile(null)}
                    className="mt-2 text-xs"
                  >
                    Change File
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
                    <Upload className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Drag and drop your spreadsheet here
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Supports .CSV, .XLSX (up to 50,000 leads per batch)
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors text-foreground">
                    Browse Files
                    <input
                      type="file"
                      accept=".csv, .xlsx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <span className="text-muted-foreground">
                Need a pre-formatted template with standard CRM columns?
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary hover:text-primary gap-1 text-xs"
                onClick={() => {
                  toast.info('Sample TeleCRM import template downloaded')
                }}
              >
                <Download className="size-3.5" /> Download Template
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Column Mapping & Distribution */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="source" className="text-xs">Lead Source Tag</Label>
                <Input
                  id="source"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  placeholder="e.g. Facebook Campaign, Housing Portal"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Distribution Strategy</Label>
                <select
                  value={distributionStrategy}
                  onChange={(e) => setDistributionStrategy(e.target.value as any)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs outline-none focus:border-primary"
                >
                  <option value="round-robin">Round-Robin (Auto distribute evenly)</option>
                  <option value="unassigned">Unassigned Pool (Agents pick from queue)</option>
                  <option value="specific">Assign to Inbound Calling Team</option>
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold text-foreground">Detected Column Mapping:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground block">Name</span>
                  <span className="font-medium text-emerald-500 font-mono">Column A ✓</span>
                </div>
                <div className="p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground block">Phone</span>
                  <span className="font-medium text-emerald-500 font-mono">Column B ✓</span>
                </div>
                <div className="p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground block">Email</span>
                  <span className="font-medium text-emerald-500 font-mono">Column C ✓</span>
                </div>
                <div className="p-2 rounded bg-background border border-border">
                  <span className="text-muted-foreground block">City / State</span>
                  <span className="font-medium text-emerald-500 font-mono">Column D ✓</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Complete Screen */}
        {step === 3 && (
          <div className="py-6 text-center space-y-3">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mx-auto">
              <CheckCircle2 className="size-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Import Completed!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-bold text-foreground">{previewCount} leads</span> have been processed, deduplicated, and queued in the CRM dialer.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Badge variant="secondary">Source: {leadSource}</Badge>
              <Badge variant="secondary">Strategy: {distributionStrategy}</Badge>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === 1 && (
            <Button
              disabled={!file}
              onClick={() => setStep(2)}
              className="gap-1.5"
            >
              Continue to Mapping <ArrowRight className="size-3.5" />
            </Button>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={handleStartImport} disabled={importing} className="gap-1.5">
                {importing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Importing...
                  </>
                ) : (
                  <>Start Import ({previewCount} Leads)</>
                )}
              </Button>
            </>
          )}

          {step === 3 && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
