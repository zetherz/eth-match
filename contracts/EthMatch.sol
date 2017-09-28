pragma solidity ^0.4.15;

import "./base/ERC23Contract.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";

// Ethereum match, simple social experiment. Because game theory is fun :)
// If you send ETH in the exact same amount as the contract balance, you get yours back plus half the contract balance (minus 5%).
// If you send ETH NOT in the exact same amount as the contract balance (i.e. someone else beat you to the punch),
//   current Matchmaster gets to keep it (minus 5%).
// Any time the contract balance falls below the "mastery threshold" (10 finney aka .01 ETH), someone else can become new Matchmaster
//   by sending >= 10 finney w/ a mastery() tx, and they will then receive the Matchmaster payouts.
// The creator's 5% is necessary, else current Matchmaster could just repeatedly send balance amount to contract
//   and never lose to other matchmakers.
contract EthMatch is Ownable, ERC23Contract {
  using SafeMath for uint256;

  uint256 public constant MASTERY_THRESHOLD = 10 finney; // new master allowed if balance falls below this (10 finney == .01 ETH)
  uint256 public constant PAYOUT_PCT = 95; // % to winner (rest to creator)

  uint256 public startTime; // start timestamp when matches may begin
  address public master; // current Matchmaster
  uint256 public gasReq; // only a var in case it ever needs to be updated for future Ethereum releases

  event MatchmakerPrevails(address indexed matchmaster, address indexed matchmaker, uint256 sent, uint256 actual, uint256 winnings);
  event MatchmasterPrevails(address indexed matchmaster, address indexed matchmaker, uint256 sent, uint256 actual, uint256 winnings);
  event MatchmasterTakeover(address indexed matchmasterPrev, address indexed matchmasterNew, uint256 balanceNew);

  function EthMatch(uint256 _startTime) public {
    require(_startTime >= now);

    startTime = _startTime;
    master = msg.sender; // initial
    gasReq = 21000;
  }

  // fallback function
  // make a match
  function () public payable {
    maker(msg.sender);
  }

  // make a match (and specify payout address)
  function maker(address _payoutAddr) public payable {
    require(this.balance > 0); // else we haven't started yet
    require(msg.gas >= gasReq); // require same amount every time (overages auto-returned)

    require(now >= startTime);
    require(_payoutAddr != 0x0);

    uint256 weiPaid = msg.value;
    require(weiPaid > 0);

    uint256 balPrev = this.balance.sub(weiPaid);

    if (balPrev == weiPaid) {
      // maker wins
      uint256 winnings = weiPaid.add(balPrev.div(2));
      pay(_payoutAddr, winnings);
      MatchmakerPrevails(master, _payoutAddr, weiPaid, balPrev, winnings);
    } else {
      // master wins
      pay(master, weiPaid);
      MatchmasterPrevails(master, _payoutAddr, weiPaid, balPrev, weiPaid);
    }
  }

  // send proceeds
  function pay(address _payoutAddr, uint256 _amount) internal {
    require(_amount > 0);

    uint256 payout = _amount.mul(PAYOUT_PCT).div(100);
    _payoutAddr.transfer(payout);

    uint256 remainder = _amount.sub(payout);
    owner.transfer(remainder);
  }

  // become the new master
  function mastery() public payable {
    mastery(msg.sender);
  }

  // become the new master (and specify payout address)
  function mastery(address _payoutAddr) public payable {
    require(this.balance > 0); // else we haven't started yet
    require(now >= startTime);
    require(_payoutAddr != 0x0);

    uint256 weiPaid = msg.value;
    require(weiPaid >= MASTERY_THRESHOLD);

    uint256 balPrev = this.balance.sub(weiPaid);
    require(balPrev < MASTERY_THRESHOLD);

    pay(master, balPrev);

    MatchmasterTakeover(master, _payoutAddr, weiPaid); // called before new master set

    master = _payoutAddr; // set after event
  }

  // in case it ever needs to be updated for future Ethereum releases
  function setGasReq(uint256 _gasReq) onlyOwner external {
    gasReq = _gasReq;
  }

  // initial funding
  function fund() onlyOwner external payable {
    require(this.balance == msg.value); // ensures balance was 0 before this, i.e. uninitialized
    require(msg.value >= MASTERY_THRESHOLD);
  }

}
