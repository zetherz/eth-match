import {advanceBlock} from './helpers/advanceToBlock'
import latestTime from './helpers/latestTime'

const LibMock = artifacts.require("LibMock");
const EthMatch = artifacts.require("EthMatch");

contract('Lib', function(accounts) {

  let lib;
  let now;

  before(async function() {
    //Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock()

    lib = await LibMock.new();
    now = latestTime() + 1;
  });

  it("isContract works correctly", async function() {
    let ethMatch = await EthMatch.new(now);
    let isContractTrue = await lib.checkContract(ethMatch.address);
    isContractTrue.should.equal(true);

    let isContractFalse = await lib.checkContract(accounts[0]);
    isContractFalse.should.equal(false);
  });

});
