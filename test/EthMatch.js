import BigNumberInt from './helpers-my/BigNumberInt'
import ether from './helpers/ether'
import {advanceBlock} from './helpers/advanceToBlock'
import {increaseTimeTo, duration} from './helpers/increaseTime'
import latestTime from './helpers/latestTime'
import EVMThrow from './helpers/EVMThrow'

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const EthMatch = artifacts.require('EthMatch');

contract('EthMatch', function ([owner, matchmaker, newmaster]) {

  const THRESHOLD = ether(.01);

  before(async function() {
    //Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock()
  })

  beforeEach(async function () {
    this.startTime = latestTime() + duration.weeks(1);

    this.contract = await EthMatch.new(this.startTime);
    this.contract.fund({value: THRESHOLD});
    this.PAYOUT_PCT = await this.contract.PAYOUT_PCT();
  });


  it('should create contract with correct parameters', async function () {
    this.contract.should.exist;

    (await this.contract.startTime()).should.be.bignumber.equal(this.startTime);
    (await this.contract.owner()).should.be.equal(owner);
    (await this.contract.master()).should.be.equal(owner);
    (await web3.eth.getBalance(this.contract.address)).should.be.bignumber.equal(THRESHOLD);
  });

  it('should not accept matches before start', async function () {
    const paymentAmount = ether(1);
    await this.contract.send(paymentAmount).should.be.rejectedWith(EVMThrow);
    await this.contract.sendTransaction({value: paymentAmount, from: matchmaker}).should.be.rejectedWith(EVMThrow);
    await this.contract.maker(matchmaker, {value: paymentAmount}).should.be.rejectedWith(EVMThrow);
    await this.contract.maker(matchmaker, {from: matchmaker, value: paymentAmount}).should.be.rejectedWith(EVMThrow);
  });

  it('should succeed when matchmaker loses and master (as owner) wins', async function () {
    await increaseTimeTo(this.startTime);

    const ownerBal = (await web3.eth.getBalance(owner));
    const matchmakerBal = (await web3.eth.getBalance(matchmaker));
    const contractBal = (await web3.eth.getBalance(this.contract.address));
    const paymentAmount = ether(1);
    const ownerBalAfterExpected = ownerBal.add(paymentAmount);
    const matchmakerBalAfterExpected = matchmakerBal.sub(paymentAmount);
    const contractBalAfterExpected = contractBal;

    await this.contract.sendTransaction({value: paymentAmount, from: matchmaker, gasPrice: 0}).should.be.fulfilled;

    (await web3.eth.getBalance(owner)).should.be.bignumber.equal(ownerBalAfterExpected);
    (await web3.eth.getBalance(matchmaker)).should.be.bignumber.equal(matchmakerBalAfterExpected);
    (await web3.eth.getBalance(this.contract.address)).should.be.bignumber.equal(contractBalAfterExpected);
  });

  it('should succeed when matchmaker wins and master (as owner) loses', async function () {
    await increaseTimeTo(this.startTime);

    const ownerBal = (await web3.eth.getBalance(owner));
    const matchmakerBal = (await web3.eth.getBalance(matchmaker));
    const contractBal = (await web3.eth.getBalance(this.contract.address));
    const paymentAmount = THRESHOLD;
    const paymentAmountHalf = paymentAmount.div(2);
    const winnings = paymentAmount.add(paymentAmountHalf);
    const payout = winnings.mul(this.PAYOUT_PCT).div(100);
    const remainder = winnings.sub(payout);
    const ownerBalAfterExpected = ownerBal.add(remainder);
    const matchmakerBalAfterExpected = matchmakerBal.sub(paymentAmount).add(payout);
    const contractBalAfterExpected = contractBal.sub(paymentAmountHalf);

    await this.contract.sendTransaction({value: paymentAmount, from: matchmaker, gasPrice: 0}).should.be.fulfilled;

    (await web3.eth.getBalance(owner)).should.be.bignumber.equal(ownerBalAfterExpected);
    (await web3.eth.getBalance(matchmaker)).should.be.bignumber.equal(matchmakerBalAfterExpected);
    (await web3.eth.getBalance(this.contract.address)).should.be.bignumber.equal(contractBalAfterExpected);
  });

  it('should accept and reject new master at correct times', async function () {
    await increaseTimeTo(this.startTime);

    await this.contract.mastery({value: THRESHOLD, from: newmaster, gasPrice: 0}).should.be.rejectedWith(EVMThrow);

    // deplete contract below threshold
    await this.contract.sendTransaction({value: THRESHOLD, from: matchmaker, gasPrice: 0}).should.be.fulfilled;

    await this.contract.mastery({value: THRESHOLD, from: newmaster, gasPrice: 0}).should.be.fulfilled;
  });

  it('should succeed when new master and matchmaker loses and master (as newmaster) wins', async function () {
    await increaseTimeTo(this.startTime);

    // deplete contract below threshold
    await this.contract.sendTransaction({value: THRESHOLD, from: matchmaker, gasPrice: 0}).should.be.fulfilled;

    // new master
    await this.contract.mastery({value: THRESHOLD, from: newmaster, gasPrice: 0}).should.be.fulfilled;

    const newmasterBal = (await web3.eth.getBalance(newmaster));
    const ownerBal = (await web3.eth.getBalance(owner));
    const matchmakerBal = (await web3.eth.getBalance(matchmaker));
    const contractBal = (await web3.eth.getBalance(this.contract.address));
    const paymentAmount = ether(1);
    const winnings = paymentAmount;
    const payout = winnings.mul(this.PAYOUT_PCT).div(100);
    const remainder = winnings.sub(payout);
    const newmasterBalAfterExpected = newmasterBal.add(payout);
    const ownerBalAfterExpected = ownerBal.add(remainder);
    const matchmakerBalAfterExpected = matchmakerBal.sub(paymentAmount);
    const contractBalAfterExpected = contractBal;

    await this.contract.sendTransaction({value: paymentAmount, from: matchmaker, gasPrice: 0}).should.be.fulfilled;

    (await web3.eth.getBalance(newmaster)).should.be.bignumber.equal(newmasterBalAfterExpected);
    (await web3.eth.getBalance(owner)).should.be.bignumber.equal(ownerBalAfterExpected);
    (await web3.eth.getBalance(matchmaker)).should.be.bignumber.equal(matchmakerBalAfterExpected);
    (await web3.eth.getBalance(this.contract.address)).should.be.bignumber.equal(contractBalAfterExpected);
  });

  it('should succeed when new master and matchmaker wins and master (as newmaster) loses', async function () {
    await increaseTimeTo(this.startTime);

    // deplete contract below threshold
    await this.contract.sendTransaction({value: THRESHOLD, from: matchmaker, gasPrice: 0}).should.be.fulfilled;

    // new master
    await this.contract.mastery({value: THRESHOLD, from: newmaster, gasPrice: 0}).should.be.fulfilled;

    const newmasterBal = (await web3.eth.getBalance(newmaster));
    const ownerBal = (await web3.eth.getBalance(owner));
    const matchmakerBal = (await web3.eth.getBalance(matchmaker));
    const contractBal = (await web3.eth.getBalance(this.contract.address));
    const paymentAmount = THRESHOLD;
    const paymentAmountHalf = paymentAmount.div(2);
    const winnings = paymentAmount.add(paymentAmountHalf);
    const payout = winnings.mul(this.PAYOUT_PCT).div(100);
    const remainder = winnings.sub(payout);
    const newmasterBalAfterExpected = newmasterBal;
    const ownerBalAfterExpected = ownerBal.add(remainder);
    const matchmakerBalAfterExpected = matchmakerBal.sub(paymentAmount).add(payout);
    const contractBalAfterExpected = contractBal.sub(paymentAmountHalf);

    await this.contract.sendTransaction({value: paymentAmount, from: matchmaker, gasPrice: 0}).should.be.fulfilled;

    (await web3.eth.getBalance(newmaster)).should.be.bignumber.equal(newmasterBalAfterExpected);
    (await web3.eth.getBalance(owner)).should.be.bignumber.equal(ownerBalAfterExpected);
    (await web3.eth.getBalance(matchmaker)).should.be.bignumber.equal(matchmakerBalAfterExpected);
    (await web3.eth.getBalance(this.contract.address)).should.be.bignumber.equal(contractBalAfterExpected);
  });

});
