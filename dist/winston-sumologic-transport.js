"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const winston = require("winston");
const requestPromise = require("request-promise");
class SumoLogic extends winston.Transport {
    constructor(options) {
        super();
        if (!options) {
            options = {};
        }
        if (!options.url) {
            throw new Error('Need SumoLogic URL. See https://help.sumologic.com/Send-Data/Sources/02Sources-for-Hosted-Collectors/HTTP-Source/zGenerate-a-new-URL-for-an-HTTP-Source');
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
            callback(undefined, true);
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
            .then(() => callback(undefined, true))
            .catch((err) => callback(err));
    }
}
exports.SumoLogic = SumoLogic;
winston.transports.SumoLogic = SumoLogic;
//# sourceMappingURL=winston-sumologic-transport.js.map