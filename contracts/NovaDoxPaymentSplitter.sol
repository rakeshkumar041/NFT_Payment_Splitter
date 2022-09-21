// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract NovaDoxPaymentSplitter is Ownable {
    using SafeMath for uint256;

    // VARIABLES
    uint256 internal amountForCalc;
    uint256 totalRecipients = 0;

    // MAPPING (manages the users and their shares)
    mapping (uint256 => address) public recipients;
    mapping (uint256 => uint256) internal shares;

    constructor() {

    }

    receive() external payable {
        require(msg.value > 0, "The amount must be higher than 0");
    }

    function getBalance() public view onlyOwner returns(uint256) {
        return address(this).balance;
    }

    function addRecipients(address payable[] calldata _address, uint256[] calldata _percentage) external onlyOwner returns (bool success) {
        totalRecipients = 0;
        uint256 percentageSum = 0;
        // Make sure that the added recipient doesn't hurt the integrity of the data constraint
        require(_percentage.length == _address.length, "The number of Shares and Owners didn't match");
        
        for (uint256 i = 0; i < _percentage.length; i++) {           
            recipients[totalRecipients] = _address[i];
            shares[i] = _percentage[i];
            totalRecipients++;
            // Update the total percentage monitoring    
            percentageSum = percentageSum.add(_percentage[i]);
        }

        percentageSum = percentageSum.div(100);
        // 1% rounding error can be considered at the worst case
        require(percentageSum  >= 99 && percentageSum <= 100, "Percentages are not valid");                
        return true;
    }

    function payRecipients() external onlyOwner payable returns (bool success) {
        uint256 contractBalance = address(this).balance;

        // Validate that funds have been deposited in the contract
        require (contractBalance > 0, "No funds have been sent to the contract");

        //Multiply by 10^18 to avoid floating point error. 
        //Then divide by 100 to get 1% of contract balance
        amountForCalc = contractBalance.mul(1e18).div(100);

        // Go over each mapping item and trasfer the relative percentage of funds to its supplied address
        // divide by 10^18 as we have considered 18 decimal places to avoid floating point rounding errors
        for (uint256 i = 0; i < totalRecipients; i++) {
            payable(recipients[i]).transfer(amountForCalc.mul(shares[i]).div(100).div(1e18));
            // Clean up mappings
            delete recipients[i];
            delete shares[i];
        }
        return true;
    }
}