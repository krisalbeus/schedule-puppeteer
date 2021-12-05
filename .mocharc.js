module.exports = {
  exit: true,
  require: ['ts-node/register', 'source-map-support/register'],
  reporter: 'mochawesome',
  'reporter-option': ['reportDir=tests/reports/Mocha,reportFilename=index.html']
};
