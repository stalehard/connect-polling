module.exports = Connect;

function Connect() {
    this._isRun = false;
    this._maxQueryCount = 100;
    this._worked = false;
    this._queryCount = 0;
    this._setMax = false;


    var self = this;
    this.on('open', function() {
        self._arrayQuery = [];
    });

    this.on('maxCount', function(message) {
        self._setMax = true;
    });

    var wrapFn = this.emit;
    var bindFn = wrapFn.bind(self, 'open');

    this.open(bindFn, function(client) {
        self.client = client;
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

Connect.prototype.end = function () {
    var self = this;
    var wrapFn = this.emit;
    var bindFn = wrapFn.bind(self, 'close');

    this.close(bindFn, self.client);
};

Connect.prototype.queryQueue = function () {
    return this._arrayQuery;
};

Connect.prototype.addQuery = function (arg, cb) {
    var self = this;
    this._queryCount++;
    this._arrayQuery.push({ arg: arg, callback: cb });

    if(this._queryCount > this._maxQueryCount) {
        this.emit('maxCount', 'in queue added too many requests, the waiting time increases');
    }

    var bindFn = this._nextTick.bind(self);

    setImmediate(bindFn);
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

        var wrappCb = function(err, result) {
            self._queryCount--;

            el.callback.apply(this, arguments);
            if(self._queryCount==0) {
                self.emit('drain');
                self._setMax = false;
            }
        };

        el.arg[el.arg.length] = wrappCb;
        this.send(el.arg, self.client);
    }

    this._worked = false;
};