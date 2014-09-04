var pg = require('pg');
pg.defaults.poolSize = 200;

module.exports = Connect;

function Connect(connString) {
    this._connString = connString;
    this._isRun = false;
    this._maxQueryCount = 10;
    this._worked = false;
    this._queryCount = 0;

    this._emitter  =  new (require('events').EventEmitter);
    var self = this;

    this._emitter.on('open', function() {
        self._arrayQuery = [];
    });

    this._emitter.on('close', function() {

    });

    this._emitter.on('error', function(err) {
        throw err;
    });

    this._emitter.on('maxCount', function(message) {
        self._setMax = true;
    });

    this._emitter.on('minCount', function(message) {

    });

    pg.connect(this._connString, function(err, client, done) {
        if (err) {
            console.error(err);
        }

        self._client = client;
        self._done = done;
        self._emitter.emit('open');
    });
}

Connect.prototype.on = function(typeEvent, func) {
    if(typeEvent == 'error') {
        this._emitter.removeAllListeners('error');
    }

    this._emitter.addListener(typeEvent, func);
};

Connect.prototype.start = function() {
    this._isRun = true;
    this._nextTick();
};

Connect.prototype.stop = function() {
    this._isRun = false;
};

Connect.prototype.isFull = function() {
    return this._setMax;
};

Connect.prototype.close = function () {
    if(this._done) {
        this._emitter.emit('close');
        this._done();
    } else {
        console.error('connect is not active');
    }
};

Connect.prototype.queryQueue = function () {
    return this._arrayQuery;
};

Connect.prototype.addQuery = function (query, params, cb) {
    if(!(typeof query == 'string')) {
        return this._emitter.emit('error', new Error('not valid query'));
    }

    if( !(typeof params == "object") || !(params instanceof Array) ) {
        return this._emitter.emit('error', new Error('not valid argument'));
    }

    this._queryCount++;
    this._arrayQuery.push({ query: query, params: params, callback: cb });
    if(this._queryCount>this._maxQueryCount) {
        this._emitter.emit('maxCount', 'in queue added too many requests, the waiting time increases');
    }

    this._nextTick();
};

Connect.prototype.maxQueryCount = function (count) {
    if(count) {
        this._maxQueryCount = count;
    } else {
        return this._maxQueryCount;
    }
};

Connect.prototype.queryCount = function () {
    return this._queryCount;
};

Connect.prototype._nextTick = function() {
    var self = this;
    if(this._worked) {
        return;
    }

    while(this._isRun && this._arrayQuery.length>0) {
        this._worked = true;
        var el = this._arrayQuery.shift();

        this._client.query(el.query, el.params, function(err, result) {
            self._queryCount--;
            if(err) {
                return el.callback(err);
            }
            el.callback(null, result);

            if(self._queryCount==0) {
                self._emitter.emit('minCount', 'in queue empty');
                self._setMax = false;
            }

        })
    }

    this._worked = false;
};