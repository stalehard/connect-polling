var config = require('./config/config.json');
var util = require('util');

var conn =  config;
var connString = util.format("pg://%s:%s@%s:%d/%s", conn.user, conn.password, conn.host, conn.port, conn.database);

var GPSconnect = require('./pgclient');

function Balanser(minCountConnect, maxCountConnect, arrayTybes) {                                               // конструктор класса балансировщика, который будет распределять запросы
    this._maxCountConnect = maxCountConnect;                                                                    // записываем в свойство максимальный предел открытых коннектов до базы
    this._minCountConnect = minCountConnect;                                                                    // записываем в свойство минимальный предел открытых коннектов до базы
    this._connectArray = [];                                                                                    // массив коннектов
    this._closedConnect = [];                                                                                   // закрываемые коннекты
    this._taskArray = [];                                                                                       // массив задач
    this._run = false;                                                                                          // служебный флаг
    this._emitter = new (require('events').EventEmitter);                                                       // движок класса

    this._init();                                                                                               // запускаем инициализацию
}

Balanser.prototype._init = function() {                                                                         // метод инициализации класса, открывающий коннекты
    this._cursor = 0;                                                                                           // последовательно, один за другим
    this.activQuery = 0;
    var self = this;

    var i=0;
    var cycle = function() {                                                                                    // рекурсивный вызов функции, добавляющей новый коннект
        i++;
        if(i<self._minCountConnect) {
            self._addNewConnect(cycle);
        }   else {
            self._emitter.emit('ready');
        }
    };

    this._addNewConnect(cycle);
};

Balanser.prototype._addNewConnect = function(cb) {                                                              // собственно метод, открывающий соединение, используем класс коннекта
    var self = this;

    var connect = new GPSconnect(connString);
    connect.on('open', function() {
        self._connectArray.push(connect);
        cb();
    });
};

Balanser.prototype._cycle = function(pos) {                                                                     // метод, по проверке на "загруженности" коннекта
    for (var i=pos;i<this._connectArray.length;i++) {
        if( !(this._connectArray[i].isFull()) )
            break;
    }
    return i;
};

Balanser.prototype._next = function(connect, el) {                                                              // метод, заполняющий коннект запросами
    connect.addQuery(el.query, el.params, el.cb);
    connect.start();
    this._distribution();
};

Balanser.prototype._distribution = function() {                                                                 // главный метод класса - распределяет запросы между коннектами
    if(this._taskArray.length>0) {                                                                              // распределение проходит по принципу "Round-robin"
        var el = this._taskArray.shift();                                                                       // с проверкой на загруженность коннекта. Это нужно в случае, если какой то запрос оказался "тяжелым",
        this._cursor = this._cycle(this._cursor);                                                               // чтобы снять нагрузку с этого коннекта и перераспределить запросы на другие коннекты

        var self = this;
        if(this._cursor<this._connectArray.length) {                                                            // код оформлен конечно криво, надеюсь в скором времени поправить
            var connect = this._connectArray[this._cursor];
            this._next(connect, el);
            this._cursor++;
        }   else {
            this._cursor = this._cycle(0);
            if(this._cursor<this._connectArray.length) {
                var connect = this._connectArray[this._cursor];
                this._next(connect, el);
                this._cursor++;
            } else if(this._connectArray.length<this._maxCountConnect) {
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

Balanser.prototype.on = function(typeEvent, func) {                                                             // метод, который предоставляет функционал по "навешиванию" обработчиков на события
    this._emitter.addListener(typeEvent, func);
};

Balanser.prototype._removeLoad = function() {                                                                   // метод, вызываемый для проверки количества открытых коннектов, и если необходимости в таком количестве нет
    var self = this;                                                                                            // "лишние" коннекты исключается из системы распределения

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

Balanser.prototype.addQuery = function(tube, query, params, cb) {                                               // собственно метод, который предоставляет вход-трубу, через который добавляются все запросы
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

var balancer = new Balanser(10,100, []);
balancer.on('ready', function() {

    var y=0;
    var time = +new Date();
    for(var i=0;i<1000; i++) {
        balancer.addQuery('gps', 'select pg_sleep(1)', [], function(err, result) {
            if(err) console.log(err);
            y++;
//            console.log(result.rows);
            if(y==1000) {
                console.log(balancer._connectArray.length)
                console.log(+new Date()-time);



                balancer.addQuery('gps', 'select pg_sleep(1)', [], function(err, result) {
                    if(err) console.log(err);
                    console.log(result.rows);
                    console.log(balancer._connectArray.length)
                });
            }

        });
    }
});



















