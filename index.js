import * as hiveTx from 'hive-tx';
import { savePostToDB } from './save-post.js';
import { getLastProcessedBlock, updateLastProcessedBlock } from './last-block.js';
import { initDB } from './init-db.js';

hiveTx.config.node = [
    'https://hive-api.arcange.eu',
    'https://api.openhive.network',
    'https://api.deathwing.me',
    'https://techcoderx.com',
    'https://api.hive.blog',
    'https://rpc.mahdiyari.info'
]

const getHeadBlockNumber = async () => {
    const info = await hiveTx.call('condenser_api.get_dynamic_global_properties', []);
    return parseInt(info.result.head_block_number);
}
const processBlock = async (blockNum) => {
    try {
        const res = await hiveTx.call('account_history_api.get_ops_in_block', [blockNum, false]);
        const ops = res.result?.ops || [];
        for (const op of ops) {
            if (op.op['type'] === 'comment_operation') {
                const { author, permlink } = op.op['value'];
                const post = await hiveTx.call('condenser_api.get_content', [author, permlink]);
                await savePostToDB(post.result);
            }
        }
        await updateLastProcessedBlock(blockNum);
        console.log(`✅ Processed block ${blockNum}`);
    } catch (err) {
        console.error(`❌ Error processing block ${blockNum}:`, err.message);
    }
};

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('-initdb')) {
        await initDB();
    } else {
        let block = await getLastProcessedBlock();
        while (true) {
            const headBlock = await getHeadBlockNumber();
            if (block <= headBlock) {
                await processBlock(Number(block));
                block = Number(block)+1;
            } else {
                // Wait for new block (Hive blocks ~ every 3 sec)
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
    }

}

main().catch(console.error);
