import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const debounce = <TArgs extends object>(
  callback: (args: TArgs) => void,
  wait: number,
) => {
  let timeoutId: number | undefined

  const debounced = (args: TArgs) => {
    window.clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => {
      callback(args)
    }, wait)
  }

  debounced.cancel = () => {
    window.clearTimeout(timeoutId)
  }

  return debounced
}
