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

        try {
            this.pathsToExpire = JSON.parse(config.pathsToExpire);
        } catch (err) {
            this.pathsToExpire = false;
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

        this.timeout = (Number(config.timeout) || 15000) * (Number(config.timeoutUnits) || 1);
        this.firstMsg = (config.firstMsg === 'true');
        this.mapPayload = (config.mapPayload === 'true');
        this.ignoreUnmatched = config.ignoreUnmatched;
        this.disableComplete = config.disableComplete;

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

            //
            // error checking
            //

            if (!msg[node.pathTopic]) {
                node.error(`join-wait "msg.${node.pathTopic}" is undefined, must be msg.${node.pathTopic}["path"]=value.`, [msg, null]);
                return;
            }

            if (typeof msg[node.pathTopic] === 'string') {
                msg[node.pathTopic] = {
                    [msg[node.pathTopic]]: true
                };
            }

            if (typeof msg[node.pathTopic] !== 'object') {
                node.error(`join-wait "msg.${node.pathTopic}" must be a string or an object, e.g., msg.${node.pathTopic}["path"] = value.`, [msg, null]);
                return;
            }

            node.pathsToWait = msg.pathsToWait || node.pathsToWait;
            if (!node.pathsToWait && !Array.isArray(node.pathsToWait)) {
                node.error('join-wait pathsToWait must be a defined array.', [msg, null]);
                return;
            }

            node.pathsToExpire = msg.pathsToExpire || node.pathsToExpire;
            if (node.pathsToExpire && !Array.isArray(node.pathsToExpire)) {
                node.error('join-wait pathsToExpire must be undefined or an array.', [msg, null]);
                return;
            }

            const pathKeys = Object.keys(msg[node.pathTopic]);
            const hasExpirePath = node.pathsToExpire && findOnePath(pathKeys, node.pathsToExpire);

            if (!hasExpirePath && !findOnePath(pathKeys, node.pathsToWait)) {
                if (!node.ignoreUnmatched) {
                    node.error(`join-wait msg.${node.pathTopic}["${pathKeys}"] doesn't exist in pathsToWait or pathsToExpire!`, [msg, null]);
                }
                return;
            }

            //
            // start processing
            //

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
                makeNewTimeout(topic, node.timeout);
            }

            node.paths[topic].queue.push([Date.now(), msg]);

            if (hasExpirePath || removeExpiredByTime(topic)) {
                resetQueue(topic, true);
                return;
            }

            const pathData = getReceivedPaths(topic);
            if (findAllPaths(Object.keys(pathData), node.pathsToWait, node.exactOrder)) {
                const num = (node.firstMsg) ? 0 : node.paths[topic].queue.length - 1;
                let msg = node.paths[topic].queue[num][1];
                msg[node.pathTopic] = pathData;
                node.send([msg, null]);

                resetQueue(topic, false);
            } else if (!node.disableComplete && Object.prototype.hasOwnProperty.call(msg, 'complete')) {
                resetQueue(topic, true);
            }
        });

        function findOnePath(haystack, arr) {
            return haystack.some(function(p) {
                return arr.includes(p);
            });
        }

        function findAllPaths(haystack, arr, exact) {
            const found = [];

            return arr.every(function(p, index) {
                const val = haystack.indexOf(p);
                if (val === -1) {
                    return false;
                }

                found.push(val);
                const lastIndex = index - 1;
                return (exact && lastIndex in found) ? (val > found[lastIndex]) : true;
            });
        }

        function makeNewTimeout(topic, timeout) {
            node.paths[topic].timeOut = setTimeout(function() {
                if (removeExpiredByTime(topic)) {
                    resetQueue(topic, true);
                } else {
                    const nextCheck = (node.paths[topic].queue[0][0] + node.timeout) - Date.now();
                    makeNewTimeout(topic, nextCheck);
                }
            }, timeout);
        }

        function removeExpiredByTime(topic) {
            const minStartTime = Date.now() - node.timeout;
            while (node.paths[topic].queue.length > 0 &&
                node.paths[topic].queue[0][0] < minStartTime) {
                const expired = node.paths[topic].queue.shift();
                node.send([null, expired[1]]);
            }

            return (node.paths[topic].queue.length == 0);
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

        function resetQueue(topic, sendExpired) {
            if (sendExpired) {
                node.paths[topic].queue.forEach(function(q) {
                    node.send([null, q[1]]);
                });
            }
            clearTimeout(node.paths[topic].timeOut);
            delete node.paths[topic];
        }
    });
};
