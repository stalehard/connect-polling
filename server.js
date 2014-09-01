var config = require('./config/config.json');
var util = require('util');

var conn =  config;
var connString = util.format("pg://%s:%s@%s:%d/%s", conn.user, conn.password, conn.host, conn.port, conn.database);

var Connect = require('./pgclient');

function GPSconnect(connString) {
    Connect.apply(this, arguments);
}

GPSconnect.prototype = Object.create(Connect.prototype);
GPSconnect.prototype.priority = 5;



function Balanser(minCountConnect, maxCountConnect, arrayTybes) {
    this._maxQueryCount = maxCountConnect;
    this._minCountConnect = minCountConnect;
    this._connectArray = [];
    this._emitter = new (require('events').EventEmitter);

    this._emitter.on('ready', function() {

    });

    this._init();
}

Balanser.prototype._init = function() {
    this._cursor = 0;
    this.activQuery = 0;
    var self = this;

    var i=0;
    var cycle = function() {
        i++;
        if(i<self._minCountConnect+1) {
            self._addNewConnect(cycle);
        }   else {
            self._emitter.emit('ready');
        }
    };

    this._addNewConnect(cycle);
};

Balanser.prototype._addNewConnect = function(cb) {
    //


    var self = this;
    var connect = new GPSconnect(connString);
    connect.on('open', function() {
        self._connectArray.push(connect);
        cb();
    });
};

Balanser.prototype.on = function(typeEvent, func) {
    this._emitter.addListener(typeEvent, func);
};

Balanser.prototype.addQuery = function(tube, query, params, cb) {
    this.activQuery++;
    var self = this;
    var connect = this._connectArray[this._cursor];

    var wrappCb = function() {
        self.activQuery--;
        cb.apply(this, arguments);
    };

    connect.addQuery(query, params, wrappCb);
    this._cursor++;

    connect.start();
};

var balancer = new Balanser(10,100, []);
balancer.on('ready', function() {

    balancer.addQuery('gps', 'select * from test', [], function(err, result) {
        console.log(result);
    });


    balancer.addQuery('gps', 'select * from test', [], function(err, result) {
        console.log(result);
    });


    balancer.addQuery('gps', 'select * from test', [], function(err, result) {
        console.log(result);
    });

    console.log(balancer.activQuery);

    setTimeout(function() {
        console.log(balancer.activQuery);
    }, 2000);

});



//var gps = new GPSconnect(connString);
//gps.on('open', function() {
//    gps.addQuery('select * from test', [], function(err, result) {
//        console.log(result);
//    });
//
//    gps.addQuery('select * from test', [], function(err, result) {
//        console.log(result);
//    });
//
//    gps.addQuery('select  from test', [], function(err, result) {
//        if(err) console.log(err);
//        console.log(result);
//    });
//
////    gps.start();
//});
//
//gps.on('maxCount', function(message) {
//    console.log(message);
//});
//
//gps.on('minCount', function(message) {
//    console.log(message);
//});
















