import type { Config } from 'drizzle-kit';

const host = process.env.MYSQL_HOST;
const port = process.env.MYSQL_PORT;
const user = process.env.MYSQL_USER;
const password = process.env.MYSQL_PASSWORD;
const database = process.env.MYSQL_DATABASE;

if (!host || !port || !user || !password || !database) {
	throw new Error('Missing required MySQL environment variables. Please check your .env.local file.');
}

export default {
	schema: './src/lib/db/schema.ts',
	out: './drizzle',
	dialect: 'mysql',
	dbCredentials: {
		url: `mysql://${user}:${password}@${host}:${port}/${database}`
	}
} satisfies Config;
