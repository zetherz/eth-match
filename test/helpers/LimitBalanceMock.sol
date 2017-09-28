pragma solidity ^0.4.15;


import 'zeppelin-solidity/contracts/LimitBalance.sol';


// mock class using LimitBalance
contract LimitBalanceMock is LimitBalance(1000) {

  function limitedDeposit() payable limitedPayable {
  }

}
