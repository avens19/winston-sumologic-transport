import { jest, describe, expect, it, beforeEach } from "@jest/globals";
import winston from "winston";
import nock from "nock";
import { SumoLogic } from "./winston-sumologic-transport";
import { AxiosError } from "axios";

jest.useFakeTimers();

beforeEach(() => {
  nock.cleanAll();
  jest.clearAllTimers();
});

describe("winston-sumologic-transport", () => {
  it("sends logs to the given url every second", async function () {
    const scope = nock("http://sumologic.com", {
      badheaders: ["X-Sumo-Name", "X-Sumo-Category", "X-Sumo-Host"]
    })
      .post(
        "/logs",
        '{"level":"info","message":"foo","meta":{"extra":"something"}}\n{"level":"error","message":"bar","meta":{"something":"different"}}\n'
      )
      .reply(200, {});
    const transport = new SumoLogic({
      url: "http://sumologic.com/logs"
    });
    const logger = winston.createLogger({ transports: [transport] });
    logger.info("foo", { extra: "something" });
    // shouldn't get logged as the default log level is info
    logger.verbose("hello", { totally: "different" });
    logger.error("bar", { something: "different" });
    jest.advanceTimersByTime(1050);
    await transport._promise;
    expect(scope.isDone()).toBeTruthy();
    // set up next request
    scope
      .post(
        "/logs",
        '{"level":"info","message":"moo","meta":{"extra":"something"}}\n{"level":"error","message":"far","meta":{"something":"different"}}\n'
      )
      .reply(200, {});
    jest.advanceTimersByTime(1050);
    await transport._promise;
    // No request was sent because there were no messages
    expect(scope.isDone()).toBeFalsy();
    logger.info("moo", { extra: "something" });
    logger.error("far", { something: "different" });
    jest.advanceTimersByTime(1050);
    await transport._promise;
    expect(scope.isDone()).toBeTruthy();
  });

  it("supports profiling", async function () {
    const scope = nock("http://sumologic.com", {
      badheaders: ["X-Sumo-Name", "X-Sumo-Category", "X-Sumo-Host"]
    })
      .post(
        "/logs",
        '{"level":"info","message":"foo","meta":{"durationMs":500}}\n'
      )
      .reply(200, {});
    const transport = new SumoLogic({
      url: "http://sumologic.com/logs"
    });
    const logger = winston.createLogger({ transports: [transport] });
    logger.profile("foo", { extra: "something" });
    jest.advanceTimersByTime(500);
    logger.profile("foo", { extra: "something" });
    jest.advanceTimersByTime(1050);
    await transport._promise;
    expect(scope.isDone()).toBeTruthy();
  });

  it("sends custom headers if specified", async function () {
    const scope = nock("http://sumologic.com", {
      reqheaders: {
        "X-Sumo-Host": "host",
        "X-Sumo-Category": "category",
        "X-Sumo-Name": "name"
      }
    })
      .post(
        "/logs",
        '{"level":"info","message":"foo","meta":{"extra":"something"}}\n{"level":"error","message":"bar","meta":{"something":"different"}}\n'
      )
      .reply(200, {});
    const transport = new SumoLogic({
      url: "http://sumologic.com/logs",
      customSourceCategory: "category",
      customSourceHost: "host",
      customSourceName: "name"
    });
    const logger = winston.createLogger({ transports: [transport] });
    logger.info("foo", { extra: "something" });
    // shouldn't get logged as the default log level is info
    logger.verbose("hello", { totally: "different" });
    logger.error("bar", { something: "different" });
    jest.advanceTimersByTime(1050);
    await transport._promise;
    expect(scope.isDone()).toBeTruthy();
    // set up next request
    scope
      .post(
        "/logs",
        '{"level":"info","message":"moo","meta":{"extra":"something"}}\n{"level":"error","message":"far","meta":{"something":"different"}}\n'
      )
      .reply(200, {});
    jest.advanceTimersByTime(1050);
    await transport._promise;
    // No request was sent because there were no messages
    expect(scope.isDone()).toBeFalsy();
    logger.info("moo", { extra: "something" });
    logger.error("far", { something: "different" });
    jest.advanceTimersByTime(1050);
    await transport._promise;
    expect(scope.isDone()).toBeTruthy();
  });

  it("calls onError when there is an error sending to sumo", async function () {
    const scope = nock("http://sumologic.com")
      .post(
        "/logs",
        '{"level":"info","message":"foo","meta":{"extra":"something"}}\n{"level":"error","message":"bar","meta":{"something":"different"}}\n'
      )
      .reply(500, '"Uh oh"');
    const onError = jest
      .fn<(error: Error) => Promise<void>>()
      .mockResolvedValue();
    const transport = new SumoLogic({
      url: "http://sumologic.com/logs",
      onError
    });
    const logger = winston.createLogger({ transports: [transport] });
    logger.info("foo", { extra: "something" });
    // shouldn't get logged as the default log level is info
    logger.verbose("hello", { totally: "different" });
    logger.error("bar", { something: "different" });
    jest.advanceTimersByTime(1050);
    await transport._promise;
    expect(scope.isDone()).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
    expect(
      (jest.mocked(onError).mock.calls[0][0] as AxiosError).response?.data
    ).toEqual("Uh oh");
  });

  it("doesn't crash when there is an error sending to sumo", async function () {
    try {
      const scope = nock("http://sumologic.com")
        .post(
          "/logs",
          '{"level":"info","message":"foo","meta":{"extra":"something"}}\n{"level":"error","message":"bar","meta":{"something":"different"}}\n'
        )
        .reply(500, '"Uh oh"');
      const transport = new SumoLogic({
        url: "http://sumologic.com/logs"
      });
      const logger = winston.createLogger({ transports: [transport] });
      logger.info("foo", { extra: "something" });
      // shouldn't get logged as the default log level is info
      logger.verbose("hello", { totally: "different" });
      logger.error("bar", { something: "different" });
      jest.advanceTimersByTime(1050);
      await transport._promise;
      expect(scope.isDone()).toBeTruthy();
    } catch (e) {
      expect(e).toBeUndefined();
    }
  });

  it("obeys the interval setting", async function () {
    const scope = nock("http://sumologic.com")
      .post(
        "/logs",
        '{"level":"info","message":"foo","meta":{"extra":"something"}}\n{"level":"error","message":"bar","meta":{"something":"different"}}\n'
      )
      .reply(200, {});
    const transport = new SumoLogic({
      url: "http://sumologic.com/logs",
      interval: 4000
    });
    const logger = winston.createLogger({ transports: [transport] });
    logger.info("foo", { extra: "something" });
    logger.error("bar", { something: "different" });
    jest.advanceTimersByTime(1050);
    await transport._promise;
    expect(scope.isDone()).toBeFalsy();
    jest.advanceTimersByTime(1050);
    await transport._promise;
    expect(scope.isDone()).toBeFalsy();
    jest.advanceTimersByTime(1050);
    await transport._promise;
    expect(scope.isDone()).toBeFalsy();
    jest.advanceTimersByTime(1050);
    await transport._promise;
    expect(scope.isDone()).toBeTruthy();
  });

  it("obeys the level setting", () => {
    const transport = new SumoLogic({
      url: "http://sumologic.com/logs",
      level: "error"
    });
    const logger = winston.createLogger({ transports: [transport] });
    logger.info("this won't be logged");
    logger.silly("neither will this");
    logger.warn("not even this one");
    logger.error("finally something to log");
    expect(transport._waitingLogs.length).toBe(1);
    expect(transport._waitingLogs[0].message).toBe("finally something to log");
  });

  it("obeys the silent setting", () => {
    const transport = new SumoLogic({
      url: "http://sumologic.com/logs",
      silent: true
    });
    const logger = winston.createLogger({ transports: [transport] });
    logger.info("this won't be logged");
    logger.silly("neither will this");
    logger.warn("not even this one");
    logger.error("nada");
    expect(transport._waitingLogs.length).toBe(0);
  });

  it("obeys the label setting", () => {
    const transport = new SumoLogic({
      url: "http://sumologic.com/logs",
      label: "test"
    });
    const logger = winston.createLogger({ transports: [transport] });
    logger.info("this message has a label");
    expect(transport._waitingLogs.length).toBe(1);
    expect(transport._waitingLogs[0].message).toBe(
      "[test] this message has a label"
    );
  });

  it("obeys the meta setting", () => {
    const transport = new SumoLogic({
      url: "http://sumologic.com/logs",
      label: "test",
      meta: {
        myMetaKey1: "val",
        myMetaKey2: 123
      }
    });
    winston.add(transport);
    winston.info("this message has a meta", {
      myMetaKey3: true,
      myMetaKey2: 124
    });
    winston.info("this message does not have a meta");
    expect(transport._waitingLogs.length).toBe(2);
    expect(transport._waitingLogs[0].meta).toEqual({
      myMetaKey1: "val",
      myMetaKey2: 124,
      myMetaKey3: true
    });
    expect(transport._waitingLogs[1].meta).toEqual({
      myMetaKey1: "val",
      myMetaKey2: 123
    });
  });

  it("exits cleanly when no logs are pending", async function () {
    nock("http://sumologic.com")
      .post(
        "/logs",
        '{"level":"info","message":"foo","meta":{"extra":"something"}}\n'
      )
      .reply(200, {});
    const transport = new SumoLogic({
      url: "http://sumologic.com/logs"
    });
    const logger = winston.createLogger({ transports: [transport] });
    logger.info("foo", { extra: "something" });
    jest.advanceTimersByTime(1050);
    await transport._promise;
    expect(transport._waitingLogs.length).toBe(0);
  });
});
