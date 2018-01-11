# winston-sumologic-transport
A transport for the Winston logger for logging to a SumoLogic endpoint

## Installation
```
npm install --save winston-sumologic-transport
```

## Usage
```javascript
  var winston = require('winston');
  
  require('winston-sumologic-transport').SumoLogic;
  
  winston.add(winston.transports.SumoLogic, options);
```

## Options

```
url             : The SumoLogic HTTP collector URL. See https://help.sumologic.com/Send-Data/Sources/02Sources-for-Hosted-Collectors/HTTP-Source/zGenerate-a-new-URL-for-an-HTTP-Source
level           : The minimum logging level to send to SumoLogic
silent          : A boolean flag to suppress output
```