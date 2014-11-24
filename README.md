pgClientClass
=============

A high level of abstraction, allows you to manage TCP connection pool


API


First step

First connect the class that provides an abstraction of a connection and is determined by three main methods for its work: OPEN, CLOSE, QUERY. 

var Connect = require('./client');

// OPEN method
Connect.prototype.open = function(open, cb) {
    pg.connect(connString, function(err, client, done) {
        if (err) {
            return err;
        }
        open();
        cb(client);
    });
};

// CLOSE method
Connect.prototype.close = function(close, client) {
    client.end();
    close();
};

// QUERY method
Connect.prototype.send = function(arg, client) {
    client.query(arg[0], arg[1], arg[2]);
};


