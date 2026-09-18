import type { ComponentProps } from 'react'

import { cn } from '#/lib/utils'

export function SpinningLoader({ className, ...props }: Readonly<ComponentProps<'div'>>) {
    return (
        <div
            className={cn(
                'size-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500',
                className,
            )}
            {...props}
        />
    )
}
