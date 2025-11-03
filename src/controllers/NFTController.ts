import type { Request, Response } from 'express';
import { createNFT, getNFTMetadata, type CreateNFTParams } from '../services/nftService';
import { config } from '../config';

export class NFTController {
  /**
   * Handler for creating NFTs on Sui blockchain
   * POST /nft-handler
   */
  public static async createNFT(req: Request, res: Response): Promise<void> {
    const {
      name,
      description,
      imageUrl,
      image_url, // Support both snake_case and camelCase
      recipientAddress,
      recipient_address, // Support both formats
      senderAddress,
      sender_address, // Support both formats
      network,
      packageId,
      package_id, // Support both formats
      moduleName,
      module_name, // Support both formats
      typeName,
      type_name, // Support both formats
      metadata,
    } = req.body ?? {};

    // Normalize field names (support both snake_case and camelCase)
    const finalName = name;
    const finalDescription = description;
    const finalImageUrl = imageUrl || image_url;
    const finalRecipientAddress = recipientAddress || recipient_address;
    const finalSenderAddress = senderAddress || sender_address;
    const finalPackageId = packageId || package_id;
    const finalModuleName = moduleName || module_name;
    const finalTypeName = typeName || type_name;

    // Validate required fields
    if (!finalName || typeof finalName !== 'string' || finalName.trim().length === 0) {
      res.status(400).json({ error: 'name is required and must be a non-empty string' });
      return;
    }

    if (!finalRecipientAddress || typeof finalRecipientAddress !== 'string') {
      res.status(400).json({ error: 'recipientAddress (or recipient_address) is required and must be a string' });
      return;
    }

    if (!finalRecipientAddress.startsWith('0x')) {
      res.status(400).json({ error: 'recipientAddress must start with 0x' });
      return;
    }

    if (!finalSenderAddress || typeof finalSenderAddress !== 'string') {
      res.status(400).json({ error: 'senderAddress (or sender_address) is required and must be a string' });
      return;
    }

    if (!finalSenderAddress.startsWith('0x')) {
      res.status(400).json({ error: 'senderAddress must start with 0x' });
      return;
    }

    // Validate network if provided
    const validNetworks = ['mainnet', 'testnet', 'devnet'];
    const networkParam = typeof network === 'string' ? network.toLowerCase() : undefined;
    if (networkParam && !validNetworks.includes(networkParam)) {
      res.status(400).json({ error: `Invalid network. Must be one of: ${validNetworks.join(', ')}` });
      return;
    }

    // Validate package/module/type if provided (all or none)
    if (finalPackageId || finalModuleName || finalTypeName) {
      if (!finalPackageId || !finalModuleName || !finalTypeName) {
        res.status(400).json({
          error: 'If using a custom package, all of packageId, moduleName, and typeName must be provided',
        });
        return;
      }
    }

    try {
      const networkToUse = networkParam
        ? (networkParam as 'mainnet' | 'testnet' | 'devnet')
        : (config.suiNetwork as 'mainnet' | 'testnet' | 'devnet');

      const params: CreateNFTParams = {
        name: finalName,
        description: finalDescription,
        imageUrl: finalImageUrl,
        recipientAddress: finalRecipientAddress,
        senderAddress: finalSenderAddress,
        network: networkToUse,
        packageId: finalPackageId,
        moduleName: finalModuleName,
        typeName: finalTypeName,
        metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
      };

      const result = await createNFT(params);

      // Extract created NFT object ID from the transaction result
      const objectChanges = result.objectChanges || [];
      const createdNFT = objectChanges.find(
        (change: any) =>
          change.type === 'created' &&
          (change as any).objectId &&
          (change.objectType?.includes('NFT') ||
            change.objectType?.includes('nft') ||
            finalTypeName
            ? change.objectType?.includes(finalTypeName)
            : true)
      );

      const nftObjectId = createdNFT && 'objectId' in createdNFT ? (createdNFT as any).objectId : null;

      res.json({
        ok: true,
        transactionDigest: result.digest,
        nftObjectId,
        transaction: result,
      });
    } catch (err) {
      res.status(400).json({ ok: false, error: (err as Error).message });
    }
  }

  /**
   * Get NFT metadata by object ID
   * POST /nft-metadata
   */
  public static async getNFT(req: Request, res: Response): Promise<void> {
    const { objectId, object_id, network } = req.body ?? {};
    const finalObjectId = objectId || object_id;

    if (!finalObjectId || typeof finalObjectId !== 'string') {
      res.status(400).json({ error: 'objectId (or object_id) is required and must be a string' });
      return;
    }

    // Validate network if provided
    const validNetworks = ['mainnet', 'testnet', 'devnet'];
    const networkParam = typeof network === 'string' ? network.toLowerCase() : undefined;
    if (networkParam && !validNetworks.includes(networkParam)) {
      res.status(400).json({ error: `Invalid network. Must be one of: ${validNetworks.join(', ')}` });
      return;
    }

    try {
      const networkToUse = networkParam
        ? (networkParam as 'mainnet' | 'testnet' | 'devnet')
        : (config.suiNetwork as 'mainnet' | 'testnet' | 'devnet');

      const nft = await getNFTMetadata(finalObjectId, networkToUse);
      res.json({ ok: true, nft });
    } catch (err) {
      res.status(400).json({ ok: false, error: (err as Error).message });
    }
  }
}

