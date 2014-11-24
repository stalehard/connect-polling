module.exports = Balancer;

function Balancer(minCountConnect, maxCountConnect) {
    var self = this;

    this._maxCountConnect = maxCountConnect;
    this._minCountConnect = minCountConnect;
    this._connectArray = [];
    this._closedConnect = {};
    this._taskArray = [];
    this._run = false;
    this._regulation = true;
    this._buffered = true;
    this._statusEqualize = false;
    this._init();

    this.on('calibrated', function() {
        self._statusEqualize = false;
        self._regulation = true;

        if(!self._run) {
            self._run = true;
            self._distribution();
        }
    });
}

Balancer.prototype = Object.create(require('events').EventEmitter.prototype);
Balancer.import = function(clientClass) {
    Balancer.prototype.client = clientClass;
};

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
        }
    };

    this._addNewConnect(cycle);
};

Balancer.prototype._addNewConnect = function(cb) {
    var self = this;

    var connect = new this.client();

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

    connect.on('error', function(err) {
        self._equalize();
    });

    connect.on('drain', function() {
        self._equalize();
    });
};

Balancer.prototype._removeConnect = function(cb) {
    var self = this;

    var poppedConnect = this._connectArray.pop();
    var hashKey = +new Date() + Math.random();

    if(poppedConnect.queryCount()==0) {
        poppedConnect.end();
        cb()
    }   else {
        this._closedConnect[hashKey] = poppedConnect;
        this._closedConnect[hashKey].on('drain', function() {
            self._closedConnect[hashKey].end();
            cb();
        });
    }
};

/*
    private method for regulation number of connections
*/

Balancer.prototype._equalize = function() {
    var self = this;
    if(this._statusEqualize) {
        return;
    }
    /*
     Calculate for all or only take the value of the first element  (maxQueryCount) ?!
    */

    var numberConnect = this.activQuery / this._connectArray[0].maxQueryCount(); // necessary number of connections
    numberConnect = ( numberConnect < this._minCountConnect ) ? this._minCountConnect : numberConnect;
    numberConnect = ( numberConnect < this._maxCountConnect ) ? numberConnect : this._maxCountConnect;
    numberConnect = numberConnect.toFixed();
    if(numberConnect != this._connectArray.length) {
        this._statusEqualize = true;
    }

    if(numberConnect > this._connectArray.length) {
        this._regulation = false;

        var cycle = function() {
            if(self._connectArray.length < numberConnect) {
                self._addNewConnect(cycle);
            }   else {
                self.emit('calibrated');
            }
        };

        this._addNewConnect(cycle);
    }   else if(numberConnect < this._connectArray.length) {
        this._regulation = false;
        cycle = function() {
            if(self._connectArray.length > numberConnect) {
                self._removeConnect(cycle);
            }   else {
                self.emit('calibrated');
            }
        };

        this._removeConnect(cycle);
    }
};

Balancer.prototype._next = function(index, el) {
    this._connectArray[index].addQuery(el.arg, el.cb);
    this._connectArray[index].start();

    var bindFn = this._distribution.bind(this);
    setImmediate(bindFn);
};

Balancer.prototype._cycle = function(pos) {
    for (var i=pos;i<this._connectArray.length;i++) {
        if( !(this._connectArray[i].isFull()) )
            break;
    }

//    console.log(i);
    return i;
};

Balancer.prototype._distribution = function() {
    var self = this;

    if(this._taskArray.length>0 && this._regulation ) {
        this._cursor = this._cycle(this._cursor);
        if(this._cursor<this._connectArray.length) {
            var el = this._taskArray.shift();
            this._next(this._cursor, el);
            this._cursor++;

        }   else {
            this._cursor = this._cycle(0);
            if(this._cursor > this._maxCountConnect - 1) {
                this._cursor = 0;
                this._run = false;
                this._buffered = true;
            }   else {
                this._cursor = (this._cursor == this._connectArray.length) ? this._cursor-1 : this._cursor;
                el = this._taskArray.shift();
                this._next(this._cursor, el);
                this._cursor++;
            }
        }
    }   else {
        this._run = false;
    }
};

Balancer.prototype.addQuery = function() {
    this.activQuery++;
    var self = this;

    var cb = [].splice.apply(arguments, [arguments.length-1])[0];
    var wrappCb = function() {
        self.activQuery--;
        cb.apply(self, arguments);
        if(self._buffered && !self._run) {
            self._run = true;
            self._buffered = false;
            self._distribution();
        }
    };

    this._taskArray.push({ arg: arguments, cb: wrappCb });
    if(!this._run) {
        this._run = true;
        this._distribution();
    }
};