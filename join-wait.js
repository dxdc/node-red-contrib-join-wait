module.exports = function(RED) {
    'use strict';
    let jsonata = require('jsonata');

    RED.nodes.registerType('join-wait', function(config) {
        RED.nodes.createNode(this, config);

        try {
            this.pathsToWait = JSON.parse(config.paths);
        } catch (err) {
            this.pathsToWait = false;
        }

        this.exactOrder = (config.exactOrder === 'true');
        this.topic = config.correlationTopic || false;
        this.topicType = config.correlationTopicType;
        if (this.topicType === 'jsonata') {
            try {
                this.topic = jsonata(this.topic);
            } catch (err) {
                this.error(`join-wait.invalid-expr ${err.message}`);
                return;
            }
        }

        this.pathTopic = config.pathTopic || 'paths';
        // this.pathTopicType = config.pathTopicType;

        this.timeout = Number(config.timeout) || 15000;
        this.firstMsg = (config.firstMsg === 'true');
        this.mapPayload = (config.mapPayload === 'true');

        this.paths = [];
        let node = this;

        node.on('close', function(removed, done) {
            node.paths.forEach(function() {
                clearTimeout(this.timeOut);
            });
            node.paths = [];
            done();
        });

        node.on('input', function(msg) {
            if (!msg[node.pathTopic]) {
                node.error(`join-wait "msg.${node.pathTopic}" undefined, must be msg.${node.pathTopic}["path"]=value.`, [msg, null]);
                return;
            }

            if (typeof msg[node.pathTopic] === 'string') {
                msg[node.pathTopic] = {
                    [msg[node.pathTopic]]: true
                };
            }

            if (typeof msg[node.pathTopic] !== 'object') {
                node.error(`join-wait "msg.${node.pathTopic}" must be a string or object, e.g., msg.${node.pathTopic}["path"]=value.`, [msg, null]);
                return;
            }

            node.pathsToWait = msg.pathsToWait || node.pathsToWait;
            if (!node.pathsToWait) {
                node.error('join-wait pathsToWait must be defined.', [msg, null]);
                return;
            }

            if (!findOne(Object.keys(msg[node.pathTopic]), node.pathsToWait)) {
                node.error(`join-wait msg.${node.pathTopic}["path"] doesn't exist in pathsToWait!`, [msg, null]);
                return;
            }

            let topic;
            if (node.topicType === 'jsonata') {
                topic = node.topic.evaluate({
                    msg: msg
                });
            } else {
                topic = (node.topic) ? RED.util.evaluateNodeProperty(node.topic, node.topicType, node, msg) : '_join-wait-node';
            }

            if (!node.paths[topic] || typeof node.paths[topic] !== 'object') {
                node.paths[topic] = {};
                node.paths[topic].queue = [];
                node.paths[topic].timeOutRunning = false;
            }

            node.paths[topic].queue.push([Date.now(), msg]);

            if (!testPathsComplete(topic) && !node.paths[topic].timeOut) {
                makeNewTimeout(topic, node.timeout);
            }
        });

        function findOne(haystack, arr) {
            return haystack.some(function(p) {
                return arr.includes(p);
            });
        }

        function findAll(haystack, arr, exact) {
            const found = [];

            return haystack.every(function(p, index) {
                const val = arr.indexOf(p);
                if (val === -1) {
                    return false;
                }

                found.push(val);
                const lastIndex = index - 1;
                return (exact && lastIndex in found) ? (val > found[lastIndex]) : true;
            });
        }

        function makeNewTimeout(topic, timeout) {
            if (node.paths[topic].timeOutRunning) {
                return; // avoid race condition
            }
            node.paths[topic].timeOut = setTimeout(function() {
                node.paths[topic].timeOutRunning = true;
                removeExpired(topic);

                if (node.paths[topic].queue.length > 0) {
                    if (!testPathsComplete(topic)) {
                        const nextCheck = (node.paths[topic].queue[0][0] + node.timeout) - Date.now();
                        node.paths[topic].timeOutRunning = false;
                        makeNewTimeout(topic, nextCheck);
                    }
                } else {
                    delete node.paths[topic];
                }
            }, timeout);
        }

        function removeExpired(topic) {
            const minStartTime = Date.now() - node.timeout;
            while (node.paths[topic].queue.length > 0 &&
                node.paths[topic].queue[0][0] < minStartTime) {
                const expired = node.paths[topic].queue.shift();
                node.send([null, expired[1]]);
            }
        }

        function getReceivedPaths(topic) {
            return node.paths[topic].queue.map(function(q) {
                if (node.mapPayload) {
                    Object.keys(q[1][node.pathTopic]).forEach(function(item) {
                        q[1][node.pathTopic][item] = q[1].payload;
                    });
                }
                return q[1][node.pathTopic];
            }).reduce(function(a, b) {
                return Object.assign(a, b);
            }, {});
        }

        function testPathsComplete(topic) {
            const allPaths = getReceivedPaths(topic);
            if (findAll(node.pathsToWait, Object.keys(allPaths), node.exactOrder)) {
                clearTimeout(node.paths[topic].timeOut);
                const num = (node.firstMsg) ? 0 : node.paths[topic].queue.length - 1;
                let msg = node.paths[topic].queue[num][1];
                msg[node.pathTopic] = allPaths;
                node.send([msg, null]);
                delete node.paths[topic];

                return true;
            }

            return false;
        }
    });
};
