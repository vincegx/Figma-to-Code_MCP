import { useState, useCallback } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface AlertOptions {
  title: string
  description: string
  confirmText?: string
  variant?: 'default' | 'destructive'
}

export function useAlert() {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<AlertOptions>({
    title: '',
    description: '',
    confirmText: 'OK',
    variant: 'default'
  })

  const alert = useCallback((opts: AlertOptions) => {
    setOptions({
      confirmText: 'OK',
      variant: 'default',
      ...opts
    })
    setIsOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  const AlertDialogComponent = useCallback(() => (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {options.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={handleClose}
            className={options.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {options.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ), [isOpen, options, handleClose])

  return { alert, AlertDialogComponent }
}
