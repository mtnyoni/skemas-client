import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import { CodeBracketIcon, ShareIcon, TableCellsIcon } from '@heroicons/react/24/outline'

interface MyRouterContext {
    queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
    head: () => ({
        meta: [
            {
                charSet: 'utf-8',
            },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1',
            },
            {
                title: 'TanStack Start Starter',
            },
        ],
        links: [
            {
                rel: 'stylesheet',
                href: appCss,
            },
        ],
    }),
    shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <HeadContent />
            </head>
            <body>
                <main className="flex min-h-screen">
                    <aside className="w-20 shrink-0 border-r p-3">
                        <nav aria-label="Database tools" className="space-y-1">
                            <button
                                type="button"
                                aria-current="page"
                                className="flex tex-xs font-medium flex-col w-full items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm"
                            >
                                <TableCellsIcon className="size-4" aria-hidden="true" />
                                Tables
                            </button>
                            <button
                                type="button"
                                className="flex tex-xs font-medium flex-col w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                                <ShareIcon className="size-4" aria-hidden="true" />
                                Diagrams
                            </button>
                            <button
                                type="button"
                                className="flex tex-xs font-medium flex-col w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                                <CodeBracketIcon className="size-4" aria-hidden="true" />
                                Queries
                            </button>
                        </nav>
                    </aside>
                    <section className="min-w-0 flex-1">{children}</section>
                </main>
                <TanStackDevtools
                    config={{
                        position: 'bottom-right',
                    }}
                    plugins={[
                        {
                            name: 'Tanstack Router',
                            render: <TanStackRouterDevtoolsPanel />,
                        },
                        TanStackQueryDevtools,
                    ]}
                />
                <Scripts />
            </body>
        </html>
    )
}
