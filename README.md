connect-polling
=============

A high level of abstraction, allows you to manage TCP connection pool

#####**First step**

First connect the class that provides an abstraction of a connection and is determined by three main methods for its work: **OPEN**, **CLOSE**, **QUERY**. 

#####**Second step**

Import our extended class ```Connect``` into pooling manager. It's all.

###**API**
```
var Balancer = require('./');

var balancer = new Balancer(min, max);
```
* **max** : the maximum number of resources to create at any given time (default is 1) 
* **min** : the minimum number of resources always open (default is 1)

```
balancer.addQuery(arg[0], arg[1], ... arg[N],);
```
arg[0], arg[1], ... ,arg[N] - query arguments. Last argument (arg[N]) must be **callback** (This is rule).
These arguments will be passed to the method **send**. And you must determine how to use them in this method:
```
Connect.prototype.send = function(arg, client) {
    client.query(arg[0], arg[1], arg[2]);
};
```

###**Example**

Using our library for pool management to PostgreSQL. To open, close and query a tcp-socket used [node-postgres](https://github.com/brianc/node-postgres) client.

Connect our library (class ```Connect``` and  class ```Balancer```) and PostgreSQL client
```
var Connect = require('./client');
var Balancer = require('./');
var pg = require('pg');
```
Define a method **OPEN**
```
Connect.prototype.open = function(open, cb) {
    pg.connect(connString, function(err, client, done) {
        if (err) {
            return err;
        }
        open();
        cb(client);
    });
};
```
**open** emits an event when the connect is opened, **сb** need to call with argument - connect(client)

Define a method **CLOSE**
```
Connect.prototype.close = function(close, client) {
    client.end();
    close();
};
```
**close** emits an event when the connect is closed, **client** is a exemplar induced in the method **OPEN**

Define a method **QUERY**
```
Connect.prototype.send = function(arg, client) {
    client.query(arg[0], arg[1], arg[2]);
};
```
Import our extended class ```Connect``` into pooling manager.
```
Balancer.import(Connect);
```

```
var balancer = new Balancer(10,50, connString);
balancer.on('ready', function() {
    run();

    function run() {
        var y=0;
        var time = +new Date();
        for(var i=0;i<1200; i++) {
            balancer.addQuery('select pg_sleep(1)', [], function(err, result) {
                if(err) console.log(err);
                console.log(y);
                y++;
                if(y==1200) {
                    console.log(balancer._connectArray.length);
                    console.log(+new Date()-time, 1);
                    run1();

                }
            });
        }
    }

    function run1() {

        var y=0;
        var time = +new Date();
        for(var i=0;i<1200; i++) {
            balancer.addQuery('select pg_sleep(1)', [], function(err, result) {
                if(err) console.log(err);
                console.log(y);
                y++;
                if(y==1200) {
                    console.log(balancer._connectArray.length);
                    console.log(+new Date()-time, 2);
                }
            });
        }
    }
});
```
