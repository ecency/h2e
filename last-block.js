import 'dotenv/config';
import { query } from './db.js';

export const getLastProcessedBlock = async () => {
    const res = await query('SELECT block_num FROM last_processed_block ORDER BY id DESC LIMIT 1');
    return res.rows[0]?.block_num ?? process.env.START_BLOCK;
};

export const updateLastProcessedBlock = async (blockNum) => {
    await query('UPDATE last_processed_block SET block_num = $1 WHERE id = 1', [blockNum]);
};
