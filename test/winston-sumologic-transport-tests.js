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

  it('sends logs to the given url every second', function() {
    const scope = nock('http://sumologic.com')
      .post('/logs', '{"level":"info","message":"foo","meta":{"extra":"something"}}\n{"level":"error","message":"bar","meta":{"something":"different"}}\n')
      .reply(200, {});
    const transport = new SumoLogic({
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

  it('calls onError when there is an error sending to sumo', function() {
    const scope = nock('http://sumologic.com')
      .post('/logs', '{"level":"info","message":"foo","meta":{"extra":"something"}}\n{"level":"error","message":"bar","meta":{"something":"different"}}\n')
      .replyWithError(new Error('Uh oh'));
    const onError = sinon.spy();
    const transport = new SumoLogic({
      url: 'http://sumologic.com/logs',
      onError
    });
    winston.add(transport, null, true);
    winston.info('foo', { extra: 'something' });
    // shouldn't get logged as the default log level is info
    winston.verbose('hello', { totally: 'different' });
    winston.error('bar', { something: 'different' });
    this.clock.tick(1050);
    return transport._promise.then(() => {
      assert.ok(scope.isDone(), 'ensure all requests were handled');
      sinon.assert.calledWithMatch(onError, sinon.match.instanceOf(Error));
      sinon.assert.calledWithMatch(onError, sinon.match({
        message: 'Uh oh'
      }));
    });
  });

  it('obeys the interval setting', function() {
    const scope = nock('http://sumologic.com')
      .post('/logs', '{"level":"info","message":"foo","meta":{"extra":"something"}}\n{"level":"error","message":"bar","meta":{"something":"different"}}\n')
      .reply(200, {});
    const transport = new SumoLogic({
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
    const transport = new SumoLogic({
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
    const transport = new SumoLogic({
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

  it('obeys the label setting', () => {
    const transport = new SumoLogic({
      url: 'http://sumologic.com/logs',
      label: 'test'
    });
    winston.add(transport, null, true);
    winston.info('this message has a label');
    assert.strictEqual(transport._waitingLogs[0].message, '[test] this message has a label');
  });

  it('obeys the meta setting', () => {
    const transport = new SumoLogic({
      url: 'http://sumologic.com/logs',
      label: 'test',
      meta: {
        myMetaKey1: 'val',
        myMetaKey2: 123
      }
    });
    winston.add(transport, null, true);
    winston.info('this message has a meta', {
      myMetaKey3: true,
      myMetaKey2: 124
    });
    winston.info('this message does not have a meta');
    assert.deepStrictEqual(transport._waitingLogs[0].meta, {
      myMetaKey1: 'val',
      myMetaKey2: 124,
      myMetaKey3: true
    });
    assert.deepStrictEqual(transport._waitingLogs[1].meta, {
      myMetaKey1: 'val',
      myMetaKey2: 123
    });
  });
});