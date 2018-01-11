# winston-sumologic-transport
A transport for the Winston logger for logging to a SumoLogic endpoint

## Usage
```javascript
  var winston = require('winston');
  
  require('winston-sumologic-transport').SumoLogic;
  
  winston.add(winston.transports.SumoLogic, options);
```

## Options

```
accessKeyId     : your AWS access key id
secretAccessKey : your AWS secret access key
region          : the region where the domain is hosted
useEnvironment  : use process.env values for AWS access, secret, & region
tableName       : DynamoDB table name
dynamoDoc       : if this is set to true, the *meta* parameter will be stored as a subobject using DynamoDB's DocumentClient rather than as a JSON string.
```