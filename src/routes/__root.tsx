import { HeadContent, Link, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import { CircleStackIcon, CodeBracketIcon, TableCellsIcon } from '@heroicons/react/24/outline'

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
        <aside className="flex h-screen w-12 shrink-0 flex-col items-center bg-mist-100 pt-3">
            <Link
                to="/"
                aria-label="Skemas home"
                className="rounded-lg p-1.5 transition-colors duration-150 bg-amber-900 text-mist-100"
            >
                <CircleStackIcon className="size-5 stroke-2 stroke-mist-100" />
            </Link>

            <nav className="flex w-full flex-col items-center gap-1 border-mist-200 pt-3">
                <SidebarItem to="/" label="Tables" exact />
                <SidebarItem to="/diagrams" label="Diagrams" />
                <SidebarItem to="/queries" label="Queries" />
            </nav>
        </aside>
    )
}

function DiagramIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
            data-slot="icon"
            {...props}
        >
            <rect
                x="9"
                y="2"
                width="6"
                height="5"
                rx="1"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <rect
                x="2"
                y="15"
                width="6"
                height="5"
                rx="1"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <rect
                x="16"
                y="15"
                width="6"
                height="5"
                rx="1"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v4m-7 4v-4h14v4" />
        </svg>
    )
}

const sidebarIcons = {
    Tables: TableCellsIcon,
    Diagrams: DiagramIcon,
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
            title={label}
            className="flex size-8 flex-col items-center justify-center rounded transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            activeProps={{ className: 'bg-mist-200 text-primary' }}
            inactiveProps={{
                className: 'text-muted-foreground hover:bg-mist-200 hover:text-foreground',
            }}
        >
            <Icon className="size-4 text-mist-700" aria-hidden="true" />
            <span className="sr-only">{label}</span>
        </Link>
    )
}
