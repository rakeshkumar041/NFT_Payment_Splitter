const paymentSplitter = artifacts.require("NovaDoxPaymentSplitter");

module.exports = function (deployer) {
  deployer.deploy(paymentSplitter);
};
