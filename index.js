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
            await processBlock(Number(block));
            block = Number(block)+1;
            //await new Promise(resolve => setTimeout(resolve, 10)); // throttle to 1 block/sec
        }
    }

}

main().catch(console.error);
