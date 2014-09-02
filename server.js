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
    this._maxCountConnect = maxCountConnect;
    this._minCountConnect = minCountConnect;
    this._connectArray = [];
    this._closedConnect = [];
    this._syncAdd = false;
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
        if(i<self._minCountConnect) {
            self._addNewConnect(cycle);
        }   else {
            self._emitter.emit('ready');
        }
    };

    this._addNewConnect(cycle);
};

Balanser.prototype._addNewConnect = function(cb) {
    if(this._syncAdd) {
        return;
    }

    this._syncAdd = true;
    var self = this;

    var connect = new GPSconnect(connString);
    connect.on('open', function() {
        connect.on('maxCount', function() {
            if(self._connectArray.length < self._maxCountConnect) {
                self._addNewConnect();
            }
            console.log('this connect has max count');
        });
        connect.on('minCount', function() {
//            self._removeConnect();
            console.log('this connect has min count');
        });

        self._connectArray.push(connect);
        self._syncAdd = false;
        if(cb) {
            cb();
        }
    });
};

Balanser.prototype._removeConnect = function() {
    var connect = this._connectArray.pop();
    this._closedConnect.push(connect);
};

Balanser.prototype._distribution = function() {
    for (var i=0;i<this._connectArray.length;i++) {
        if( this.activQuery/this._connectArray.length > this._connectArray[i].queryQueue().length )
            break;
    }
    this._cursor = i;
    var connect = this._connectArray[this._cursor];
    this._cursor++;
    if(this._cursor==this._connectArray.length) {
        this._cursor = 0;
    }
    return connect;
};


Balanser.prototype.on = function(typeEvent, func) {
    this._emitter.addListener(typeEvent, func);
};

Balanser.prototype.addQuery = function(tube, query, params, cb) {
    this.activQuery++;
    var self = this;

    var connect = self._distribution();
    var wrappCb = function() {
        self.activQuery--;
        cb.apply(this, arguments);
    };

    connect.addQuery(query, params, wrappCb);
    connect.start();

//    setTimeout(function() {
//        connect.start();
//    }, 2000);
};

var balancer = new Balanser(10,100, []);
balancer.on('ready', function() {

    var y=0;
    for(var i=0;i<10; i++) {
        balancer.addQuery('gps', 'select pg_sleep(1)', [], function(err, result) {
            if(err) console.log(err);
            console.log(y++)
        });
    }

    setTimeout(function() {
        for(var i=0;i<balancer._connectArray.length;i++) {
            console.log(balancer._connectArray[i].queryQueue().length);
        }
    },1000)



});



















