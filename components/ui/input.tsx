import * as React from 'react'
import { cn } from '@/lib/utils'

const field =
  'w-full rounded-lg border border-surface-border bg-surface px-3 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, 'h-10', className)} {...props} />
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, 'h-10', className)} {...props} />
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, 'py-2', className)} {...props} />
}
