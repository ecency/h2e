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

const getHeadBlockNumber = async (retries = 5, delay = 2000) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const info = await hiveTx.call('condenser_api.get_dynamic_global_properties', []);
            const head = parseInt(info?.result?.head_block_number);
            if (!isNaN(head)) return head;
            throw new Error('Invalid head_block_number');
        } catch (err) {
            console.error(`⚠️ Failed to get head block (attempt ${attempt}):`, err.message);
            if (attempt === retries) throw err;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
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
            try {
                const headBlock = await getHeadBlockNumber();

                if (block <= headBlock) {
                    await processBlock(Number(block));
                    block = Number(block)+1;
                } else {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }
            } catch (err) {
                console.error('❌ Fatal error in main loop:', err.message);
                await new Promise(resolve => setTimeout(resolve, 5000)); // wait before retrying
            }
        }
    }

}

main().catch(console.error);
