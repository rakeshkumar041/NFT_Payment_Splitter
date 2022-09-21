# NFT_Payment_Splitter

Prerequsites
Configure .env file
    1) Rename file .env.example to .env
    2) Update Mnemonic and account index of metamask or any wallet
    3) Configure the Infura api key and Network details
    4) Provide the address for NFT contract address and Payment Splitter contract address
    5) Update the payment and business address
    6) Also update the share% each accounts will be getting

Configure truffle-config.js
    Update the configuration needed for the deployment in truffle-config.js


Compile the smart contract
    Run  "truffle compile"

Deploy the smart contract
    Run  "truffle migrate --network {networkName} --reset"
    Pass networkName defined in truffle-config.js
    Once the contract is deployed, fetch the contract address and update it in the .env file

Run the script
    navigate to Src folder and Run node "index.js"    

