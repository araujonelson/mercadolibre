const redis        = require('redis');
const rsmQueue     = require('rsmq');
const rsmqWorker   = require('rsmq-worker');

//Conexión a Redis
const redisQueueName  = "myqueue"
const redisHost       = "10.0.1.69";
const redisPort       = "6379";
const redisClient     = redis.createClient(redisPort, redisHost);

//RSMQ (Redis Simple Queue Message)
const redisQueue  = new rsmQueue({host: redisHost, port: redisPort, ns: "rsmq"});
const redisWorker = new rsmqWorker(redisQueueName, { timeout: '0', host: redisHost });

module.exports = {
    redisQueue: redisQueue,
    redisWorker: redisWorker,
    redisQueueName: redisQueueName,
    redisClient: redisClient
}
