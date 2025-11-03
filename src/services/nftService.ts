import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { normalizeSuiAddress, isValidSuiObjectId } from '@mysten/sui.js/utils';
import { createSuiClient, getKeypairFromEnv } from './suiService';
import { config } from '../config';

export type CreateNFTParams = {
  name: string;
  description?: string;
  imageUrl?: string;
  recipientAddress: string;
  senderAddress: string;
  network?: 'mainnet' | 'testnet' | 'devnet';
  // Optional: custom package/module/type for NFT
  packageId?: string;
  moduleName?: string;
  typeName?: string;
  // Additional metadata fields
  metadata?: Record<string, string>;
};

export type NFTMetadata = {
  name: string;
  description?: string;
  image_url?: string;
  [key: string]: string | undefined;
};

/**
 * Builds a transaction to create an NFT on Sui
 * Uses the standard NFT pattern or custom package if provided
 */
export async function buildCreateNFTTx(params: CreateNFTParams): Promise<TransactionBlock> {
  const {
    name,
    description,
    imageUrl,
    recipientAddress,
    senderAddress,
    packageId,
    moduleName,
    typeName,
    metadata = {},
  } = params;

  const tx = new TransactionBlock();
  tx.setSender(senderAddress);

  // Normalize addresses
  const recipient = normalizeSuiAddress(recipientAddress);
  const sender = normalizeSuiAddress(senderAddress);

  // If custom package/module/type is provided, use it
  if (packageId && moduleName && typeName) {
    // Custom NFT type from published package
    const nftType = `${packageId}::${moduleName}::${typeName}`;
    
    // Build metadata object
    const metadataFields: any[] = [
      { key: 'name', value: tx.pure(name) },
    ];
    
    if (description) {
      metadataFields.push({ key: 'description', value: tx.pure(description) });
    }
    if (imageUrl) {
      metadataFields.push({ key: 'image_url', value: tx.pure(imageUrl) });
    }
    
    // Add custom metadata fields
    Object.entries(metadata).forEach(([key, value]) => {
      metadataFields.push({ key, value: tx.pure(value) });
    });

    // Call the custom NFT mint function
    // This assumes the package has a mint function that takes metadata and recipient
    const nft = tx.moveCall({
      target: `${packageId}::${moduleName}::mint`,
      arguments: [
        tx.pure(metadataFields),
        tx.pure(recipient),
      ],
      typeArguments: [],
    });

    tx.transferObjects([nft], tx.pure(recipient));
  } else {
    // For a simple NFT creation without a custom package,
    // we'll use the object::new function to create a basic object
    // Note: This requires a published Move package that defines the NFT type
    // 
    // Alternative approach: Use the Display object standard for metadata
    // This is a common pattern for NFTs on Sui
    
    // Since we don't have a Move package, we'll create a transaction that
    // can work with a standard NFT package or provide instructions for publishing one
    
    // For now, we'll prepare metadata that can be used with Display standard
    const metadataFields: string[] = [];
    metadataFields.push(`name: ${name}`);
    if (description) {
      metadataFields.push(`description: ${description}`);
    }
    if (imageUrl) {
      metadataFields.push(`image_url: ${imageUrl}`);
    }
    Object.entries(metadata).forEach(([key, value]) => {
      metadataFields.push(`${key}: ${value}`);
    });

    // Create a simple object with metadata
    // Note: In production, you should publish a Move package with:
    // - A struct that implements the NFT traits
    // - A mint function that creates and transfers the NFT
    // 
    // Example Move code structure:
    // module nft::my_nft {
    //   struct MyNFT has key, store {
    //     id: UID,
    //     name: String,
    //     description: String,
    //     image_url: String,
    //   }
    //   
    //   public fun mint(name: vector<u8>, description: vector<u8>, image_url: vector<u8>, recipient: address, ctx: &mut TxContext): MyNFT {
    //     MyNFT {
    //       id: object::new(ctx),
    //       name: string::utf8(name),
    //       description: string::utf8(description),
    //       image_url: string::utf8(image_url),
    //     }
    //   }
    // }
    
    // For now, we'll throw an error asking for a package ID
    throw new Error(
      'To create NFTs, please provide a published Move package. ' +
      'Set packageId, moduleName, and typeName parameters, or publish a Move package ' +
      'that defines your NFT type and minting function.'
    );
  }

  tx.setGasBudget(100_000_000);
  return tx;
}

/**
 * Creates an NFT on the Sui blockchain
 */
export async function createNFT(params: CreateNFTParams) {
  const network = params.network ?? (config.suiNetwork as 'mainnet' | 'testnet' | 'devnet');
  const client = createSuiClient(network);
  const keypair = getKeypairFromEnv();

  const derived = normalizeSuiAddress(keypair.getPublicKey().toSuiAddress());
  const provided = normalizeSuiAddress(params.senderAddress);
  
  if (derived !== provided) {
    throw new Error(
      `Sender address does not match derived keypair address (provided=${provided}, derived=${derived})`
    );
  }

  // Validate recipient address
  if (!params.recipientAddress.startsWith('0x')) {
    throw new Error('recipientAddress must start with 0x');
  }

  // Validate name
  if (!params.name || typeof params.name !== 'string' || params.name.trim().length === 0) {
    throw new Error('name is required and must be a non-empty string');
  }

  const tx = await buildCreateNFTTx(params);

  // Execute the transaction
  const result = await client.signAndExecuteTransactionBlock({
    transactionBlock: tx,
    signer: keypair,
    options: {
      showInput: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
      showBalanceChanges: true,
    },
    requestType: 'WaitForLocalExecution',
  });

  return result;
}

/**
 * Gets NFT metadata by object ID
 */
export async function getNFTMetadata(
  objectId: string,
  network?: 'mainnet' | 'testnet' | 'devnet'
) {
  const networkToUse = network ?? (config.suiNetwork as 'mainnet' | 'testnet' | 'devnet');
  const client = createSuiClient(networkToUse);

  if (!isValidSuiObjectId(objectId)) {
    throw new Error(`Invalid object ID: ${objectId}`);
  }

  try {
    const object = await client.getObject({
      id: objectId,
      options: {
        showContent: true,
        showDisplay: true,
        showType: true,
        showOwner: true,
      },
    });

    return object;
  } catch (error: any) {
    const errorMsg = error?.message?.toLowerCase() || '';
    if (errorMsg.includes('not found') || errorMsg.includes('could not find')) {
      throw new Error(`NFT object "${objectId}" not found on ${networkToUse} network`);
    }
    throw error;
  }
}

