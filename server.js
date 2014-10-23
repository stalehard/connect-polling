var config = require('./config/config.json');
var util = require('util');

var conn =  config;
var connString = util.format("pg://%s:%s@%s:%d/%s", conn.user, conn.password, conn.host, conn.port, conn.database);

var GPSconnect = require('./pgclient');

function Balancer(minCountConnect, maxCountConnect) {
    this._maxCountConnect = maxCountConnect;
    this._minCountConnect = minCountConnect;
    this._connectArray = [];
    this._closedConnect = [];
    this._taskArray = [];
    this._run = false;
    this._emitter = new (require('events').EventEmitter);
    this._init();
}

Balancer.prototype._init = function() {
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

Balancer.prototype._addNewConnect = function(cb) {
    var self = this;

    var connect = new GPSconnect(connString);
    connect.on('open', function() {
        self._connectArray.push(connect);
        cb();
    });
};

Balancer.prototype._cycle = function(pos) {
    for (var i=pos;i<this._connectArray.length;i++) {
        if( !(this._connectArray[i].isFull()) )
            break;
    }
    return i;
};

Balancer.prototype._next = function(connect, el) {
    connect.addQuery(el.query, el.params, el.cb);
    connect.start();
    this._distribution();
};

Balancer.prototype._distribution = function() {
    if(this._taskArray.length>0) {
        var el = this._taskArray.shift();
        this._cursor = this._cycle(this._cursor);
        var self = this;

        if(this._cursor<this._connectArray.length) {
            var connect = this._connectArray[this._cursor];
            this._next(connect, el);
            this._cursor++;

        }   else {
            this._cursor = this._cycle(0);

            if(this._cursor<this._connectArray.length) {
                var connect = this._connectArray[this._cursor];
                this._next(connect, el);
                this._cursor++;
            } else if( this._connectArray.length<this._maxCountConnect) {
                self._addNewConnect(function() {
                    self._cursor = self._connectArray.length-1;
                    var connect = self._connectArray[self._cursor];
                    self._next(connect, el);
                });
            } else {
                for (var i=0;i<this._connectArray.length;i++) {
                    if( this.activQuery/this._connectArray.length > this._connectArray[i].queryCount() ) {
                        break;
                    }
                }
                if(i==this._connectArray.length) {
                    i = 0;
                }
                this._cursor = i;

                var connect = this._connectArray[this._cursor];
                this._next(connect, el);
            }
        }
    }   else {
        this._run = false;
    }
};


Balancer.prototype.on = function(typeEvent, func) {
    this._emitter.addListener(typeEvent, func);
};

Balancer.prototype._removeLoad = function() {
    var self = this;

    var temp = this._connectArray[0].maxQueryCount().toFixed();
    var currentCount = (this.activQuery/temp < this._minCountConnect) ? this._minCountConnect : temp;

    if(currentCount< this._connectArray.length ) {
        while( this._connectArray.length  != currentCount  ) {
            var poppedConnect = this._connectArray.pop();
            if(poppedConnect.queryCount()==0) {
                poppedConnect.close();
            }   else {
                poppedConnect.index = self._closedConnect.length;
                poppedConnect.on('drain', function() {
                    poppedConnect.close();
                    self._closedConnect.slice(poppedConnect.index, 1);
                });
                self._closedConnect.push(poppedConnect);
            }
        }
    }
};

Balancer.prototype.addQuery = function(tube, query, params, cb) {
    this.activQuery++;
    var self = this;

    this._removeLoad();
    var wrappCb = function() {
        self.activQuery--;
        cb.apply(this, arguments);
    };

    this._taskArray.push({ query: query, params: params, cb: wrappCb });
    if(!this._run) {
        this._run = true;
        this._distribution();
    }
};

var balancer = new Balancer(10,100);
balancer.on('ready', function() {

    var y=0;
    var time = +new Date();
    for(var i=0;i<10000; i++) {
        balancer.addQuery('gps', 'select pg_sleep(1)', [], function(err, result) {
            if(err) console.log(err);
            y++;
            if(y==10000) {
                console.log(balancer._connectArray.length);
                console.log(+new Date()-time);
            }
        });
    }
});



















