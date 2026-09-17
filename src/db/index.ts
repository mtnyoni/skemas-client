import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const pool = new Pool({
    host: requiredEnv('DB_HOST'),
    port: databasePort(),
    user: requiredEnv('DB_USER'),
    password: requiredEnv('DB_PASSWORD'),
    database: requiredEnv('DB_NAME'),
})

export const db = drizzle(pool)

function requiredEnv(name: string) {
    const value = process.env[name]
    if (!value) throw new Error(`Missing required environment variable: ${name}`)
    return value
}

function databasePort() {
    const port = Number(requiredEnv('DB_PORT'))
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
        throw new Error('DB_PORT must be a valid TCP port')
    }
    return port
}
