import request from 'request';
import TransportStream from 'winston-transport';

export interface SumoLogicTransportOptions {
  url?: string;
  level?: string;
  silent?: boolean;
  interval?: number;
  label?: string;
  meta?: any;
  onError?: (error: Error) => Promise<void>;
}

export interface SumoLogicLogEntry {
  level: string;
  message: string;
  meta: any;
}

export class SumoLogic extends TransportStream {
  name: string;
  url: string;
  label: string;
  meta?: any;
  onError?: (error: Error) => Promise<void>;
  _timer: any;
  _waitingLogs: Array<SumoLogicLogEntry>;
  _isSending: boolean;
  _promise: Promise<void>;
  _timerInterval: number;

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
    this.label = options.label || '';
    this.meta = options.meta || {};
    this.onError = options.onError;
    this._timerInterval = options.interval || 1000;
    this._waitingLogs = [];
    this._isSending = false;
    this._promise = Promise.resolve();
  }

  _startTimer() {
    this._timer = setInterval(() => {
      if (!this._isSending) {
        this._isSending = true;
        this._promise = this._sendLogs()
          .then(() => { this._isSending = false; })
          .catch((e) => { this._isSending = false; throw e; });
      }
    }, this._timerInterval);
  }

  _clearTimer() {
    clearInterval(this._timer);
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

  _handleError(e: Error) {
    if (this.onError) {
      return Promise.resolve(this.onError(e));
    }
    return Promise.reject(e);
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
          if (this._waitingLogs.length === 0) {
            this._clearTimer();
          }
        })
        .catch(e => this._handleError(e));
    } catch (e) {
      return this._handleError(e);
    }
  }

  log(info: any, callback: Function) {
    try {
      if (this.silent) {
        callback();
        return;
      }
      const { level, message, ...meta } = info;

      let _meta = meta || {};
      if (typeof _meta === 'function') {
        callback = meta;
        _meta = {};
      }
      _meta = {...this.meta, ..._meta};
      _meta = Object.keys(_meta).length === 0 ? undefined : _meta;
      let _message = message;
      if (this.label) {
        _message = `[${this.label}] ${message}`;
      }
      const content = {
        level,
        message: _message,
        meta: _meta
      };
      if (this._waitingLogs.length === 0) {
        this._startTimer();
      }
      this._waitingLogs.push(content);
      callback();

    } catch (e) {
      callback(e);
    }
  }
}
