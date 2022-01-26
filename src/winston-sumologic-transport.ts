import axios from 'axios';
import TransportStream from 'winston-transport';

export interface SumoLogicTransportOptions {
  url?: string;
  level?: string;
  silent?: boolean;
  interval?: number;
  label?: string;
  meta?: object;
  onError?: (error: Error) => Promise<void>;
}

export interface SumoLogicLogEntry {
  level: string;
  message: string;
  meta: object;
}

export class SumoLogic extends TransportStream {
  name: string;
  url: string;
  label: string;
  meta?: object;
  onError?: (error: Error) => Promise<void>;
  _timer: NodeJS.Timeout | undefined;
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
    this._timer = setInterval(async() => {
      if (!this._isSending) {
        this._isSending = true;
        try {
          this._promise = this._sendLogs();
          await this._promise;
        } catch (e) {
          throw e;
        } finally {
          this._isSending = false;
        }
      }
    }, this._timerInterval);
  }

  _clearTimer() {
    if (this._timer) {
      clearInterval(this._timer);
    }
  }

  _request(content: string) {
      return axios.post(this.url, content);
  }

  _handleError(e: Error): Promise<void> {
    if (this.onError) {
      return Promise.resolve(this.onError(e));
    }
    return Promise.reject(e);
  }

  async _sendLogs(): Promise<void> {
    try {
      if (this._waitingLogs.length === 0) {
        return undefined;
      }
      const numBeingSent = this._waitingLogs.length;
      let content = '';
      for (let i = 0; i < numBeingSent; i++) {
        content += JSON.stringify(this._waitingLogs[i]) + '\n';
      }
      await this._request(content);
      this._waitingLogs.splice(0, numBeingSent);
      if (this._waitingLogs.length === 0) {
        this._clearTimer();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      return this._handleError(e);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(info: any, callback: (error?: any) => void) {
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
