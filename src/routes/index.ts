import { Router } from 'express';
import { HomeController } from '../controllers/HomeController';
import { TransferController, TransferQueryController } from '../controllers/TransferController';
import { NFTController } from '../controllers/NFTController';

const router = Router();

router.get('/', HomeController.index);
router.get('/health', (_req, res) => res.json({ ok: true }));
router.post('/simulate-transfer', TransferController.simulateTransfer);
router.post('/digest', TransferQueryController.getTransfer);
router.post('/ai-digest', TransferQueryController.getAiDigest);
// Temporary alias to avoid breakage if someone still calls the old path
router.post('/get-transfer', TransferQueryController.getTransfer);

// NFT endpoints
router.post('/nft-handler', NFTController.createNFT);
router.post('/nft-metadata', NFTController.getNFT);

export default router;


