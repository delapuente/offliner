
var offClient = window.off;
var sinon = window.sinon;
var expect = window.chai.expect;

describe('Offliner Client', function () {

  it('calls the listeners registered with on()', function () {
    var spy = sinon.spy();
    var evt = {};

    offClient.on('testEvent', spy);
    offClient._runListeners('testEvent', evt);

    expect(spy.called).to.be.true;
    expect(spy.calledWith(evt)).to.be.true;
  });

});
