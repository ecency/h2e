import { readFile } from 'fs/promises';
import { query } from './db.js';
import 'dotenv/config';

export const initDB = async () => {
    try {
        const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf-8');
        await query(schema);
        // Insert initial block value
        const startBlock = parseInt(process.env.START_BLOCK ?? '0');
        await query(`
            INSERT INTO last_processed_block (id, block_num)
            VALUES (1, $1)
            ON CONFLICT (id) DO UPDATE SET block_num = EXCLUDED.block_num;
        `, [startBlock]);

        console.log(`✅ Database initialized successfully at block ${startBlock}`);
    } catch (err) {
        console.error('❌ Error initializing DB:', err);
        process.exit(1);
    }
};
