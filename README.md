# winston-sumologic-transport
A transport for the Winston logger for logging to a SumoLogic endpoint

[![Version npm](https://img.shields.io/npm/v/winston-sumologic-transport.svg?style=flat-square)](https://www.npmjs.com/package/winston-sumologic-transport)[![Build Status](https://img.shields.io/travis/avens19/winston-sumologic-transport/master.svg?style=flat-square)](https://travis-ci.org/avens19/winston-sumologic-transport)

## Installation
```
npm install --save winston-sumologic-transport
```

## Usage
```javascript
  var winston = require('winston');
  var { SumoLogic } = require('winston-sumologic-transport');

  var options = {
    url: 'http://example.com'
  };
  
  winston.add(SumoLogic, options);
```

## Options

```
url     : The SumoLogic HTTP collector URL. See https://help.sumologic.com/Send-Data/Sources/02Sources-for-Hosted-Collectors/HTTP-Source/zGenerate-a-new-URL-for-an-HTTP-Source
level   : The minimum logging level to send to SumoLogic [default: 'info']
silent  : A boolean flag to suppress output [default: false]
interval: The interval (in mills) between posts to SumoLogic [default: 1000]
label: A custom label associated with each message
```