const assert = require('assert');
const LDPoSChainCrypto = require('../index');
const Channel = require('./utils/channel');


describe('DEX (ChainCrypto) API tests', async () => {
  let options;
  let chainCrypto;
  let channel;
  let preparedTxn;
  let signaturePacket;
  let store;

  beforeEach(async () => {
    store = {};
    options = {
      chainSymbol: 'ldpos',
      chainOptions: {
        passphrase: 'clerk aware give dog reopen peasant duty cheese tobacco trouble gold angle',
        keyIndexDirPath: './test/data/'
      },
      store: {
        saveItem: async (key, value) => {
          store[key] = value;
        },
        loadItem: async (key) => {
          return store[key];
        }
      }
    };
    channel = new Channel();
    chainCrypto = new LDPoSChainCrypto(options);
    await chainCrypto.load(channel);
  });

  afterEach(async () => {
    await chainCrypto.unload();
  });

  describe('prepareTransaction', async () => {

    it('should prepare and sign transaction and return transaction and signature objects with all required properties', async () => {
      let { transaction, signature } = await chainCrypto.prepareTransaction({
        recipientAddress: 'ldposd41fc93c5627f105a818aa86d2650850af7644b0',
        amount: '10000000000',
        fee: '10000000',
        timestamp: 1609544665570,
        message: ''
      });

      assert.notEqual(transaction, null);
      assert.equal(typeof transaction.id, 'string');

      // The signatures property should be an empty array.
      // The DEX module will use the signatures array to store signature packets
      // from the current DEX node and also other DEX nodes.
      assert.equal(Array.isArray(transaction.signatures), true);
      assert.equal(transaction.signatures.length, 0);

      // The signature should be an object with a signerAddress property which holds
      // the wallet address of the signer.
      // Apart from that, the schema of the signature object is flexible; whatever
      // is supported by the verifyTransactionSignature method.
      assert.notEqual(signature, null);
      assert.equal(typeof signature.signerAddress, 'string');
    });

  });

  describe('verifyTransactionSignature', async () => {

    beforeEach(async () => {
      let { transaction, signature } = await chainCrypto.prepareTransaction({
        recipientAddress: 'ldposd41fc93c5627f105a818aa86d2650850af7644b0',
        amount: '10000000000',
        fee: '10000000',
        timestamp: 1609544665570,
        message: ''
      });
      preparedTxn = transaction;
      signaturePacket = signature;
    });

    it('should return true if the signature belongs to the correct account and is valid', async () => {
      let isValid = await chainCrypto.verifyTransactionSignature(preparedTxn, signaturePacket);
      assert.equal(isValid, true);
    });

    it('should return false if the signature belongs to the correct account but is not valid', async () => {
      signaturePacket.signature = signaturePacket.signature.replace(/a/g, 'b');
      let isValid = await chainCrypto.verifyTransactionSignature(preparedTxn, signaturePacket);
      assert.equal(isValid, false);
    });

    it('should return false if the signature is valid but does not belong to the correct account', async () => {
      signaturePacket.signerAddress = 'ldposa949caca90cebae80d70c72d6c4e2580f2e51232';
      let isValid = await chainCrypto.verifyTransactionSignature(preparedTxn, signaturePacket);
      assert.equal(isValid, false);
    });

    it('should throw an error if the operation fails for any unexpected reason', async () => {
      chainCrypto.ldposClient.adapter.getAccount = async (walletAddress) => {
        throw new Error('Network failure');
      };
      let caughtError;
      try {
        await chainCrypto.verifyTransactionSignature(preparedTxn, signaturePacket);
      } catch (error) {
        caughtError = error;
      }
      assert.notEqual(caughtError, null);
      assert.equal(caughtError.message, 'Network failure');
    });

  });

});
