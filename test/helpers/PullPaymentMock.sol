pragma solidity ^0.4.15;


import 'zeppelin-solidity/contracts/payment/PullPayment.sol';


// mock class using PullPayment
contract PullPaymentMock is PullPayment {

  function PullPaymentMock() payable { }

  // test helper function to call asyncSend
  function callSend(address dest, uint256 amount) {
    asyncSend(dest, amount);
  }

}
