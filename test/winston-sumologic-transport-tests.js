const { assert } = require('chai');
const winston = require('winston');
const sinon = require('sinon');
const nock = require('nock');
const { SumoLogic } = require('../lib/winston-sumologic-transport');

describe('winston-sumologic-transport', () => {
  beforeEach(function() {
    this.clock = sinon.useFakeTimers();
    winston.clear();
  });
  afterEach(function() {
    this.clock.restore();
  });

  it('adds itself to the set of transports', () => {
    assert.strictEqual(winston.transports.SumoLogic, SumoLogic);
  });

  it('sends logs to the given url every second', function() {
    const scope = nock('http://sumologic.com')
      .post('/logs', '{"level":"info","message":"foo","meta":{"extra":"something"}}\n{"level":"error","message":"bar","meta":{"something":"different"}}\n')
      .reply(200, {});
    const transport = new winston.transports.SumoLogic({
      url: 'http://sumologic.com/logs'
    });
    winston.add(transport, null, true);
    winston.info('foo', { extra: 'something' });
    // shouldn't get logged as the default log level is info
    winston.verbose('hello', { totally: 'different' });
    winston.error('bar', { something: 'different' });
    this.clock.tick(1050);
    return transport._promise.then(() => {
      assert.ok(scope.isDone(), 'ensure all requests were handled');
      // set up next request
      scope.post('/logs', '{"level":"info","message":"moo","meta":{"extra":"something"}}\n{"level":"error","message":"far","meta":{"something":"different"}}\n')
        .reply(200, {});
      this.clock.tick(1050);
      return transport._promise;
    }).then(() => {
      // No request was sent because there were no messages
      assert.notOk(scope.isDone(), 'a request is still waiting');
      winston.info('moo', { extra: 'something' });
      winston.error('far', { something: 'different' });
      this.clock.tick(1050);
      return transport._promise;
    }).then(() => {
      assert.ok(scope.isDone(), 'ensure all requests were handled');
    });
  });

  it('obeys the interval setting', function() {
    const scope = nock('http://sumologic.com')
      .post('/logs', '{"level":"info","message":"foo","meta":{"extra":"something"}}\n{"level":"error","message":"bar","meta":{"something":"different"}}\n')
      .reply(200, {});
    const transport = new winston.transports.SumoLogic({
      url: 'http://sumologic.com/logs',
      interval: 4000
    });
    winston.add(transport, null, true);
    winston.info('foo', { extra: 'something' });
    winston.error('bar', { something: 'different' });
    this.clock.tick(1050);
    return transport._promise.then(() => {
      assert.notOk(scope.isDone(), 'a request is still waiting');
      this.clock.tick(1050);
      return transport._promise;
    }).then(() => {
      assert.notOk(scope.isDone(), 'a request is still waiting');
      this.clock.tick(1050);
      return transport._promise;
    }).then(() => {
      assert.notOk(scope.isDone(), 'a request is still waiting');
      this.clock.tick(1050);
      return transport._promise;
    }).then(() => {
      assert.ok(scope.isDone(), 'ensure all requests were handled');
    });
  });

  it('obeys the level setting', () => {
    const transport = new winston.transports.SumoLogic({
      url: 'http://sumologic.com/logs',
      level: 'error'
    });
    winston.add(transport, null, true);
    winston.info('this won\'t be logged');
    winston.silly('neither will this');
    winston.warn('not even this one');
    winston.error('finally something to log');
    assert.strictEqual(transport._waitingLogs.length, 1);
    assert.strictEqual(transport._waitingLogs[0].message, 'finally something to log');
  });

  it('obeys the silent setting', () => {
    const transport = new winston.transports.SumoLogic({
      url: 'http://sumologic.com/logs',
      silent: true
    });
    winston.add(transport, null, true);
    winston.info('this won\'t be logged');
    winston.silly('neither will this');
    winston.warn('not even this one');
    winston.error('nada');
    assert.strictEqual(transport._waitingLogs.length, 0);
  });
});