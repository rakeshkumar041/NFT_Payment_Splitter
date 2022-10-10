const Web3 = require('web3')
const HDWalletProvider = require("@truffle/hdwallet-provider")
const paymentSplitter = require('../build/contracts/NovaDoxPaymentSplitter.json');
require('dotenv').config({path: '../.env'})
const novaDoxABI = require('../NOVA_DOX.json');

//Network Configurations
const MNEMONIC = process.env.MNEMONIC
const NETWORK = process.env.NETWORK || 'goerli'
const INFURA_KEY = process.env.INFURA_KEY
const METAMASK_ACCOUNT_INDEX = process.env.METAMASK_ACCOUNT_INDEX || 0

//Contract and Payment Address
const NFT_CONTRACT_ADDRESS = process.env.NFT_CONTRACT_ADDRESS
const PAYMENT_SPLITTER_CONTRACT_ADDRESS = process.env.PAYMENT_SPLITTER_CONTRACT_ADDRESS
const CHARITY_WALLET_ADDRESS = process.env.CHARITY_WALLET_ADDRESS
const SOFTWARE_PAYMENT_ADDRESS = process.env.SOFTWARE_PAYMENT_ADDRESS
const MARKETING_ADDRESS = process.env.MARKETING_ADDRESS
const BUSINESS_MODEL_ADDRESS = process.env.BUSINESS_MODEL_ADDRESS

//Share percentage
const SHARE_PERCENT_NFT_HOLDERS = Number(process.env.SHARE_PERCENT_NFT_HOLDERS) || 50
const SHARE_PERCENT_CHARITY_WALLET = Number(process.env.SHARE_PERCENT_CHARITY_WALLET) || 20
const SHARE_PERCENT_SOFTWARE_PAYMENT = Number(process.env.SHARE_PERCENT_SOFTWARE_PAYMENT) || 10
const SHARE_PERCENT_MARKETING = Number(process.env.SHARE_PERCENT_MARKETING) || 10
const SHARE_PERCENT_BUSINESS_MODEL = Number(process.env.SHARE_PERCENT_BUSINESS_MODEL) || 10

// other
const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000'
// Keccak256 hash value of transfer function signature
const NFT_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


if (!MNEMONIC || !INFURA_KEY) {
    console.error("Please set a valid MNEMONIC and INFURA_KEY") 
}

// Create a provider to interact with smart contract
const provider = new HDWalletProvider({
    mnemonic: MNEMONIC,
    providerOrUrl: 'https://' + NETWORK + '.infura.io/v3/' + INFURA_KEY,
    pollingInterval: 15000,
    chainId : 4
});

// Use the provider in web3
const web3 = new Web3(provider);

// Get the account address from the metamask wallet. This will be the sender address
const senderAccount = provider.getAddress(METAMASK_ACCOUNT_INDEX)
console.log("Sender address:", senderAccount)

function addAddressAndShares(paymentAddress, individualSharePercentage) {
    paymentAddress.push(CHARITY_WALLET_ADDRESS)
    paymentAddress.push(SOFTWARE_PAYMENT_ADDRESS)
    paymentAddress.push(MARKETING_ADDRESS)
    paymentAddress.push(BUSINESS_MODEL_ADDRESS)

    individualSharePercentage.push(SHARE_PERCENT_CHARITY_WALLET*100)
    individualSharePercentage.push(SHARE_PERCENT_SOFTWARE_PAYMENT*100)
    individualSharePercentage.push(SHARE_PERCENT_MARKETING*100)
    individualSharePercentage.push(SHARE_PERCENT_BUSINESS_MODEL*100)

    return {
        'Owners': paymentAddress,
        'Share': individualSharePercentage
    }; 
}

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}

function initializeContract() {
    const instance = new web3.eth.Contract(paymentSplitter.abi, PAYMENT_SPLITTER_CONTRACT_ADDRESS);
    return instance
}

async function estimateGas(method) {
    try {
        let estimateGas = await web3.eth.estimateGas({
            "value": '0x0', // Only tokens
            "data": method.encodeABI(),
            "from": senderAccount,
            "to": PAYMENT_SPLITTER_CONTRACT_ADDRESS
        });
        return estimateGas
    } catch (error) {
        provider.engine.stop();
        console.error(error)
    }
}

async function processData(response) {
    //An array of price list of NFTs bought by the NFT owners
    var NFTSales = []   
    var tokenOwner = new Map()  // Mapping between TokenId and NFTOwner
    var tokenTranx= new Map()   // Mapping between TokenId and Transaction hash
    let sumOfEther = 0;        //  Variable to calculate the total ethers of all NFT
    try {
        // Iterate through all the data and filter it step by step
        for( var i = 0; i < response.length; i++ ) {
            var tx = response[i];
            // Filter data whose from address is not empty(If empty, it means it was minted)
            if (tx.returnValues.from != EMPTY_ADDRESS && tx.raw.topics[0] == NFT_TRANSFER_TOPIC) {
                // topics[3] represents the tokenId
                tokenTranx.set(tx.raw.topics[3], tx.transactionHash);
                tokenOwner.set(tx.raw.topics[3], tx.returnValues.to);
            }   
        }

        // Iterate through the transaction hash and get the NFT value in that transaction
        for (var txTopic of Array.from(tokenTranx.keys())) {
            let response = await web3.eth.getTransaction(tokenTranx.get(txTopic))
            // convert the value of each NFT to Big Number
            let ether = web3.utils.toBN(response.value)
            NFTSales[tokenOwner.get(txTopic)] = NFTSales[tokenOwner.get(txTopic)] ? NFTSales[tokenOwner.get(txTopic)].add(ether) : ether
            sumOfEther = sumOfEther ? sumOfEther.add(ether) : ether
        }
        var NFTOwnerAddress = new Set(Array.from(tokenOwner.values()));  // Holds the a set of address of all NFT owners
    } catch(err) {
        provider.engine.stop();
        console.error(err);
    }

    var sharePercentage = []       // An array that holds all the shares in %
    var individualSharePercentage = 0; // Individual share %
    // loop through the array of NFT owners and calculate the share % for each address
    for (var owner of NFTOwnerAddress) {
        //Multiply and divide by 1e18 to avoid rounding error
        individualSharePercentage = Number((((NFTSales[owner] * 1e18 / (sumOfEther)) * 100 * (SHARE_PERCENT_NFT_HOLDERS * 100 / 100))/1e20).toFixed(2));
        console.log(`NFT Address: ${owner}, Ether: ${web3.utils.fromWei(NFTSales[owner], 'ether')}, share: ${individualSharePercentage}`)
        sharePercentage.push(Number((individualSharePercentage*100).toFixed(0)))
    }

    //Calculation to make percentage add upto 100%
    var totalPercentage = Number(sharePercentage.reduce((a, b) => a + b, 0)/100);
    sharePercentage[sharePercentage.length-1] += Number(((SHARE_PERCENT_NFT_HOLDERS - totalPercentage) * 100).toFixed(0))
    console.log("totalPercentage", Number(sharePercentage.reduce((a, b) => a + b, 0)/100))
    
    return {
        'Owners': Array.from(NFTOwnerAddress),
        'Share': sharePercentage
    };
}

async function fetchNFTData() {
    try {
        var instance = new web3.eth.Contract(novaDoxABI, NFT_CONTRACT_ADDRESS);
        // get all Transfer events of the NFT contract
        let response = await instance.getPastEvents('Transfer', {
            fromBlock: 0,
            toBlock: 'latest'
        })        
        var NFTData = await processData(response)   
        return {
            'Owners': NFTData.Owners,
            'Share': NFTData.Share
        };     
    } catch (err) {
        provider.engine.stop();
        console.error(err);
    }
}

async function main() {
    try {
        var NFTData = await fetchNFTData();
        var processedData = addAddressAndShares(NFTData.Owners, NFTData.Share)
        console.log("Owners", processedData.Owners)
        console.log("Shares", processedData.Share)
        
        // Get an instance to the Payment splitter smart contract
        var contractInstance = initializeContract()
        var tx = await contractInstance.methods.getBalance().call({ from: senderAccount });
        console.log("The totalSupply is: ", tx)

        // Invoke the addRecipients function of the smart contract
        let estimatedGas = await estimateGas(contractInstance.methods.addRecipients(processedData.Owners, processedData.Share));
        tx = await contractInstance.methods.addRecipients(processedData.Owners, processedData.Share).send({ from: senderAccount, gas : estimatedGas });
        console.log("TransactionHash of addRecipients",tx.transactionHash)

        await sleep(4000)
        // Invoke the payRecipients function of the smart contract
        estimatedGas = await estimateGas(contractInstance.methods.payRecipients());
        tx = await contractInstance.methods.payRecipients().send({ from: senderAccount, gas : estimatedGas });
        console.log("TransactionHash of payRecipients",tx.transactionHash)

        tx = await contractInstance.methods.getBalance().call({ from: senderAccount });
        console.log("The totalSupply after payment split is: ", tx)
      
        provider.engine.stop();
    } catch(error) {
        provider.engine.stop();
        console.error(error)
    }
}

main()