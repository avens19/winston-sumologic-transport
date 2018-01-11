import * as winston from 'winston';
import * as requestPromise from 'request-promise';

import { Transport, TransportOptions } from 'winston';
import { TransportInstance } from 'winston';

export interface SumoLogicTransportOptions {
  url?: string;
  level?: string;
  silent?: boolean;
}

export interface SumoLogicTransportInstance extends TransportInstance {
  new (options?: SumoLogicTransportOptions): SumoLogicTransportInstance;
}

export class SumoLogic extends winston.Transport implements SumoLogicTransportInstance {
  url: string;
  
  constructor(options?: SumoLogicTransportOptions) {
    super();

    if (options == null) {
      options = <SumoLogicTransportOptions> {};
    }
    if (options.url == null) {
      throw new Error("Need SumoLogic URL. See https://help.sumologic.com/Send-Data/Sources/02Sources-for-Hosted-Collectors/HTTP-Source/zGenerate-a-new-URL-for-an-HTTP-Source");
    }

    this.name = 'SumoLogic';
    this.url = options.url;
    this.level = options.level || 'info';
    this.silent = options.silent || false;
  }

  _request(content) {
    return requestPromise(this.url, {
      body: content,
      json: true,
      method: 'POST'
    });
  }

  log(level, msg, meta, callback) {
    if (this.silent) {
      callback(null, true);
    }
    if (typeof meta === 'function') {
      callback = meta;
      meta = {};
    }
    const content = {
      level: level,
      message: msg,
      meta: meta
    };
    this._request(content)
      .then(() => callback(null, true))
      .catch((err) => callback(err));
  }
}

import { Transports } from 'winston';
declare module "winston" {
  export interface Transports {
    SumoLogic: typeof SumoLogic;
  }
}

winston.transports.SumoLogic = SumoLogic;