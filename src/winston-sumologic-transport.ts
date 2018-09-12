import * as winston from 'winston';
import * as request from 'request';

import { TransportInstance } from 'winston';

export interface SumoLogicTransportOptions {
  url?: string;
  level?: string;
  silent?: boolean;
  interval?: number;
  label?: string;
}

export interface SumoLogicTransportInstance extends TransportInstance {
  new (options?: SumoLogicTransportOptions): SumoLogicTransportInstance;
}

export interface SumoLogicLogEntry {
  level: string;
  message: string;
  meta: any;
}

export class SumoLogic extends winston.Transport implements SumoLogicTransportInstance {
  url: string;
  _timer: any;
  _waitingLogs: Array<SumoLogicLogEntry>;
  _isSending: boolean;
  _promise: Promise<void>;

  constructor(options?: SumoLogicTransportOptions) {
    super();

    if (!options) {
      options = <SumoLogicTransportOptions> {};
    }
    if (!options.url) {
      throw new Error('Need SumoLogic URL. See https://help.sumologic.com/Send-Data/Sources/02Sources-for-Hosted-Collectors/HTTP-Source/zGenerate-a-new-URL-for-an-HTTP-Source');
    }

    this.name = 'SumoLogic';
    this.url = options.url;
    this.level = options.level || 'info';
    this.silent = options.silent || false;
    this.label = options.label;
    this._timer = setInterval(() => {
      if (!this._isSending) {
        this._isSending = true;
        this._promise = this._sendLogs()
          .then(() => { this._isSending = false; })
          .catch((e) => { this._isSending = false; throw e; });
      }
    }, options.interval || 1000);
    this._waitingLogs = [];
    this._isSending = false;
    this._promise = Promise.resolve();
  }

  _request(content: string) {
    return new Promise((resolve, reject) => {
      request(this.url, {
        body: content,
        method: 'POST'
      }, (err, response) => {
        if (!!err || response.statusCode !== 200) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  _sendLogs() {
    try {
      if (this._waitingLogs.length === 0) {
        return Promise.resolve(undefined);
      }
      const numBeingSent = this._waitingLogs.length;
      let content = '';
      for (let i = 0; i < numBeingSent; i++) {
        content += JSON.stringify(this._waitingLogs[i]) + '\n';
      }
      return this._request(content)
        .then(() => {
          this._waitingLogs.splice(0, numBeingSent);
        });
    } catch (e) {
      return Promise.reject(e);
    }
  }

  log(level: string, msg: string, meta: any, callback: Function) {
    try {
      if (this.silent) {
        callback(undefined, true);
        return;
      }
      if (typeof meta === 'function') {
        callback = meta;
        meta = {};
      }
      if(this.label) {
        msg = `[${this.label}] ${msg}`
    }
      const content = {
        level: level,
        message: msg,
        meta: meta
      };
      this._waitingLogs.push(content);
    } catch (e) {
      callback(e);
    }
  }
}