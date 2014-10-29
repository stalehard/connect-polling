var pg = require('pg');
pg.defaults.poolSize = 200;

module.exports = Connect;

function Connect(connString) {
    this._connString = connString;
    this._isRun = false;
    this._maxQueryCount = 10;
    this._worked = false;
    this._queryCount = 0;


    var self = this;
    this.on('open', function() {
        self._arrayQuery = [];
    });

    this.on('maxCount', function(message) {
        self._setMax = true;
    });


    pg.connect(this._connString, function(err, client, done) {
        if (err) {
            return self.emit('error', err);
        }

        self.emit('open');
        self._client = client;
        self._done = done;
    });
}

Connect.prototype = Object.create(require('events').EventEmitter.prototype);

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
    this._client.end();
    this.emit('close');
};

Connect.prototype.queryQueue = function () {
    return this._arrayQuery;
};

Connect.prototype.addQuery = function (query, params, cb) {
    if(typeof query !== 'string') {
        return this.emit('error', new Error('not valid query'));
    }

    if( typeof params !== "object" || !(params instanceof Array) ) {
        return this.emit('error', new Error('not valid argument'));
    }

    this._queryCount++;
    this._arrayQuery.push({ query: query, params: params, callback: cb });

    if(this._queryCount > this._maxQueryCount) {
        this.emit('maxCount', 'in queue added too many requests, the waiting time increases');
    }

    setImmediate(this._nextTick);
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
                self.emit('drain');
                self._setMax = false;
            }

        })
    }

    this._worked = false;
};
