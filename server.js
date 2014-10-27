var config = require('./config/config.json');
var util = require('util');

var conn =  config;
var connString = util.format("pg://%s:%s@%s:%d/%s", conn.user, conn.password, conn.host, conn.port, conn.database);

var GPSconnect = require('./pgclient');

function Balancer(minCountConnect, maxCountConnect) {
    var self = this;

    this._maxCountConnect = maxCountConnect;
    this._minCountConnect = minCountConnect;
    this._connectArray = [];
    this._closedConnect = {};
    this._taskArray = [];
    this._run = false;
    this._init();

    this.on('_ready', function() {
        self._status = 'ready';
        if(!self._run) {
            self._run = true;
            self._distribution();
        }
    });
}

Balancer.prototype = Object.create(require('events').EventEmitter.prototype);

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
            self.emit('ready');
            self.emit('_ready');
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

    connect.on('maxCount', function() {
        self._equalize();
    });

    connect.on('close', function() {
        self._equalize();
    });

    connect.on('error', function() {
        self._equalize();
    });

    connect.on('drain', function() {
        self._equalize();
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
    var self = this;
    connect.addQuery(el.query, el.params, el.cb);
    connect.start();
    var bindFn = this._distribution.bind(self);

    setImmediate(bindFn);
};

/*
    private method for regulation number of connections
*/
Balancer.prototype._equalize = function() {
    var self = this;
    /*
     Calculate for all or only take the value of the first element  (maxQueryCount) ?!
    */

    var numberConnect = this.activQuery / this._connectArray[0].maxQueryCount(); // necessary number of connections
    numberConnect = ( numberConnect < this._minCountConnect ) ? this._minCountConnect : numberConnect;
    numberConnect = ( numberConnect < this._maxCountConnect ) ? numberConnect : this._maxCountConnect;
    numberConnect = numberConnect.toFixed();
    if(numberConnect > this._connectArray.length) {
        this._status = 'regulation';
        var cycle = function() {
            if(self._connectArray.length < numberConnect) {
                self._addNewConnect(cycle);
            }   else {
                self.emit('_ready');
            }
        };

        this._addNewConnect(cycle);
    }   else if(numberConnect < this._connectArray.length) {

        this._status = 'regulation';
        while( this._connectArray.length  != numberConnect  ) {
//            console.log(numberConnect, this._connectArray.length );
            var poppedConnect = this._connectArray.pop();
            var hashKey = +new Date() + Math.random();
            close(hashKey, poppedConnect);
        }
        self.emit('_ready');
    }

    function close(hashKey, poppedConnect) {
        if(poppedConnect.queryCount()==0) {
            poppedConnect.close();
        }   else {
            self._closedConnect[hashKey] = poppedConnect;
            self._closedConnect[hashKey].on('drain', function() {
                if(self._closedConnect[hashKey]) {
                    self._closedConnect[hashKey].close();
                }
                delete self._closedConnect[hashKey];
            });
        }
    }
};

Balancer.prototype._distribution = function() {
    var self = this;

    if(this._taskArray.length>0 && this._status == 'ready') {
        var el = this._taskArray.shift();
        this._cursor = this._cycle(this._cursor);

        if(this._cursor<this._connectArray.length) {
            var connect = this._connectArray[this._cursor];
            this._next(connect, el);
            this._cursor++;
        }   else {
            this._cursor = this._cycle(0);

            connect = this._connectArray[this._cursor];
            this._next(connect, el);
            this._cursor++;
        }
    }   else {
        this._run = false;
    }
};

Balancer.prototype.addQuery = function(tube, query, params, cb) {
    this.activQuery++;
    var self = this;

    var wrappCb = function() {
        self.activQuery--;
        cb.apply(this, arguments);
    };

    this._taskArray.push({ query: query, params: params, cb: wrappCb });
    if(!this._run && this._status == 'ready') {
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
            console.log(y);
            y++;
            if(y==10000) {
                console.log(balancer._connectArray.length);
                console.log(+new Date()-time);
            }
        });
    }
});



















