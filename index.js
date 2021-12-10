const fs = require('fs');
const path = require('path');
const util = require('util');
const mkdir = util.promisify(fs.mkdir);
const { createClient } = require('ldpos-client');

const {
  LDEX_LDPOS_MULTISIG_KEY_INDEX
} = process.env;

class LDPoSChainCrypto {
  constructor({ chainSymbol, chainOptions }) {
    this.chainSymbol = chainSymbol;
    this.chainModuleAlias = chainOptions.moduleAlias;
    this.passphrase = chainOptions.passphrase;
    this.multisigAddress = chainOptions.multisigAddress;
    this.memberAddress = chainOptions.memberAddress;
    this.keyIndexDirPath = path.resolve(chainOptions.keyIndexDirPath);
    if (this.keyIndexDirPath == null) {
      throw new Error(
        `A keyIndexDirPath must be specified as part of the ${
          this.chainSymbol
        } chain config`
      );
    }
  }

  async load(channel) {
    await mkdir(this.keyIndexDirPath, { recursive: true });

    this.ldposClient = createClient({
      networkSymbol: this.chainSymbol,
      adapter: {
        getNetworkSymbol: async () => {
          return this.chainSymbol;
        },
        getAccount: async (walletAddress) => {
          return channel.invoke(`${this.chainModuleAlias}:getAccount`, { walletAddress });
        }
      },
      keyIndexDirPath: this.keyIndexDirPath
    });
    await this.ldposClient.connect({
      passphrase: this.passphrase,
      walletAddress: this.memberAddress,
      multisigKeyIndex: LDEX_LDPOS_MULTISIG_KEY_INDEX == null ? null : Number(LDEX_LDPOS_MULTISIG_KEY_INDEX)
    });
    await this.ldposClient.syncKeyIndex('multisig');
  }

  async unload() {
    this.ldposClient.disconnect();
  }

  // This method checks that:
  // 1. The signerAddress corresponds to the publicKey.
  // 2. The publicKey corresponds to the signature.
  async verifyTransactionSignature(transaction, signaturePacket) {
    let { signerAddress, multisigPublicKey } = signaturePacket;
    let account = await this.ldposClient.getAccount(signerAddress);
    if (
      multisigPublicKey !== account.multisigPublicKey &&
      multisigPublicKey !== account.nextMultisigPublicKey
    ) {
      return false;
    }

    return this.ldposClient.verifyMultisigTransactionSignature(transaction, signaturePacket);
  }

  async prepareTransaction(transactionData) {
    let {
      recipientAddress,
      amount,
      fee,
      timestamp,
      message
    } = transactionData;

    if (!this.ldposClient.validateWalletAddress(recipientAddress)) {
      throw new Error(
        'Failed to prepare the transaction because the recipientAddress was invalid'
      );
    }

    let unsignedTransaction = {
      type: 'transfer',
      senderAddress: this.multisigAddress,
      recipientAddress,
      amount,
      fee,
      timestamp,
      message
    };

    let transaction = this.ldposClient.prepareMultisigTransaction(unsignedTransaction);
    let signature = await this.ldposClient.signMultisigTransaction(transaction);

    return {
      transaction,
      signature
    };
  }
}

module.exports = LDPoSChainCrypto;
