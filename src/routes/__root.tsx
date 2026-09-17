import { HeadContent, Link, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
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
                title: 'Skemas',
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
                <main className="flex overflow-hidden h-screen bg-mist-100">
                    <Sidebar />
                    <section className="min-w-0 rounded-l-lg my-auto h-[calc(100dvh-1rem)] flex-1 bg-white">
                        {children}
                    </section>
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

function Sidebar() {
    return (
        <aside className="w-20 shrink-0 p-3">
            <nav aria-label="Database tools" className="space-y-1">
                <SidebarItem to="/" label="Tables" exact />
                <SidebarItem to="/diagrams" label="Diagrams" />
                <SidebarItem to="/queries" label="Queries" />
            </nav>
        </aside>
    )
}

const sidebarIcons = {
    Tables: TableCellsIcon,
    Diagrams: ShareIcon,
    Queries: CodeBracketIcon,
} as const

type SidebarItemProps = {
    to: LinkProps['to']
    label: keyof typeof sidebarIcons
    exact?: boolean
}

function SidebarItem({ to, label, exact = false }: SidebarItemProps) {
    const Icon = sidebarIcons[label]

    return (
        <Link
            to={to}
            activeOptions={{ exact }}
            className="flex w-full flex-col items-center gap-2 rounded-md px-2 py-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            activeProps={{ className: 'bg-accent text-foreground' }}
            inactiveProps={{
                className: 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
            }}
        >
            <Icon className="size-4" aria-hidden="true" />
            {label}
        </Link>
    )
}
