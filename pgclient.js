var pg = require('pg');
pg.defaults.poolSize = 200;

module.exports = Connect;

function Connect(connString) {
    this._connString = connString;                                   // сохраняем параметры в свойстве объекта
    this._isRun = false;                                             // свойство отвечающее, за запуск обработки запросов
    this._maxQueryCount = 10;                                        // максимальное количество запросов помещенных в сокет, после которого будет вызвано событие ""
    this._worked = false;                                            //
    this._queryCount = 0;                                            // свойство хранящее общее количество запросов

    this._emitter  =  new (require('events').EventEmitter);          // "движок" класса
    var self = this;                                                 // делаем "селфи" :)

    this._emitter.on('open', function() {                            // на открытие коннекта создаем обработчик "open"
        self._arrayQuery = [];                                       // в котором регистрируем массив коннектов
    });

    this._emitter.on('error', function(err) {                        // на событие ошибки будет сгенерирована ошибка, которая если не навесить обработчик,
        throw err;                                                   // повалит выполнение скрипта
    });

    this._emitter.on('maxCount', function(message) {                 // на событие достижения лимита этого коннекта, пометим его флагом
        self._setMax = true;
    });

    pg.connect(this._connString, function(err, client, done) {       // при создании экземпляра класса открываем коннект до базы, здесь может быть открытие любого
        if (err) {                                                   // коннекта, который представляет сам по себе net.Socket
            return self._emitter.emit('error', err);
        }

        self._client = client;                                       // запишем в "внутреннее" свойство ссылку на клиент, который общается с базой
        self._done = done;                                           // "мягкое закрытие" клиента
        self._emitter.emit('open');                                  // вызываем событие готовности (передаем событие далее по цепочке)
    });
}

Connect.prototype.on = function(typeEvent, func) {                   // метод, который предоставляет функционал по "навешиванию" обработчиков на события
    if(typeEvent == 'error') {
        this._emitter.removeAllListeners('error');                   // если это обработчик на ошибки подменяем стандартный обработчик пользовательским
    }

    this._emitter.addListener(typeEvent, func);
};

Connect.prototype.start = function() {                               // метод, которые запускает работу по обработке запросов
    this._isRun = true;
    this._nextTick();
};

Connect.prototype.stop = function() {                                // метод, которые останавливает работу по обработке запросов
    this._isRun = false;
};

Connect.prototype.isFull = function() {                              // метод, возвращающий состоянии коннекта (заполнен оли он)
    return this._setMax;
};

Connect.prototype.close = function () {                              // метод, закрывающий мягко коннект (т.е. если на коннекте висят запросы, программа дождется их
    if(this._done) {                                                 // выполнения и закроет коннект)
        this._emitter.emit('close');
        this._done();
    } else {
        console.error('connect is not active');                      // коннект по каким-то причинам еще не открыт
    }
};

Connect.prototype.queryQueue = function () {                         // метод, возвращающий массив обрабатываемых запросов
    return this._arrayQuery;
};

Connect.prototype.addQuery = function (query, params, cb) {          // главный рабочий метод класса, добавление запроса - в качестве параметров зам запрос в виде строки, параметры запроса, каллбэк ена завершении запроса
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

Connect.prototype.maxQueryCount = function (count) {                  // метод по манипулированию максимальным количеством запросов в коннекте
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