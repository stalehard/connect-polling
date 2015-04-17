connect-polling
=============

A high level of abstraction, allows you to manage TCP connection pool

#####**First step**

First connect the class that provides an abstraction of a connection and is determined by three main methods for its work: **open**, **close**, **send**. 

#####**Second step**

Import our extended class ```Connect``` into pooling manager. It's all.

###**API**
```
var Balancer = require('connect-polling');

var balancer = new Balancer(min, max);
```
* **max** : maximum number of open connections (default is 1)
* **min** : minimum number of open connections (default is 1)

```
balancer.addQuery(arg0, arg1, ... argN,);
```
```arg0, arg1, ... ,argN``` - query arguments. Last argument (```argN```) must be **callback** (This is rule).
These arguments will be passed to the method **send**. And you must determine how to use them in this method (They are available as elements of an array ```arg```):
```
Connect.prototype.send = function(arg, client) {
    client.query(arg[0], arg[1], ..., arg[arg.length-1]);
};
```

###**Example**

Using our library for pool management to PostgreSQL. To open, close and query a tcp-socket used [node-postgres](https://github.com/brianc/node-postgres) client.

Connect our library (class ```Connect``` and  class ```Balancer```) and PostgreSQL client
```
var Balancer = require('connect-polling');
var Connect = Balancer.client

var pg = require('pg');
```
Define a method **open**
```
Connect.prototype.open = function(open, cb) {
    pg.connect(connString, function(err, client, done) {
        if (err) {
            return err;
        }
        cb(client);
        open();
    });
};
```
**сb** need call with argument - class client(connect) abstraction, e.g. cb(client), callback **open** emit "open" connect event 

Define a method **close**
```
Connect.prototype.close = function(close, client) {
    client.end();
    close();
};
```
**close** emit "close" connect event, **client** is a exemplar class client(connect) abstraction transmited in the method **open** with callback

Define a method **send**
```
Connect.prototype.send = function(arg, client) {
    client.query(arg[0], arg[1], arg[2]);
};
```
```arg``` is an array of arguments , which is transmitted via the method **addQuery**. Determine how to use them.


Import our extended class ```Connect``` into pooling manager.
```
Balancer.import(Connect);
```
enjoy!
```
var balancer = new Balancer(10,50);
balancer.on('ready', function() {
    balancer.addQuery('select pg_sleep(1)', [], function(err, result) {
    if(err) {
        return console.log(err);
    }
    console.log(result);
    });
});
```
(The MIT License)
