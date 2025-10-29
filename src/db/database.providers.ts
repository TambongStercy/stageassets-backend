import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

export const databaseProviders = [
  {
    provide: DATABASE_CONNECTION,
    useFactory: async () => {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });

      return drizzle(pool, { schema });
    },
  },
];