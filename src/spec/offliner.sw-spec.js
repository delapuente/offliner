
importScripts('/base/src/offliner.js');
var Offliner = self.off.Offliner;

describe('Offliner instances', function () {

  it('should be able of store information in separated namespaces',
  function (done) {
    var off1 = new Offliner('namespace1');
    var off2 = new Offliner('namespace2');

    Promise.all([
      off1.set('key', 'value for namespace1'),
      off2.set('key', 'value for namespace2')
    ])
    .then(function () {
      return Promise.all([
        off1.get('key'),
        off2.get('key')
      ]);
    })
    .then(function (values) {
      expect(values[0]).to.equal('value for namespace1');
      expect(values[1]).to.equal('value for namespace2');
      done();
    })
    .catch(done);
  });

});
